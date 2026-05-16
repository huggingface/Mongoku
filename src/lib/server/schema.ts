import type { MongoClientWithMappings } from "$lib/server/mongo";
import { ReadPreference } from "mongodb";
import { z } from "zod";

export interface CollectionSchemaInfo {
	hasSchema: boolean;
	validator: Record<string, unknown> | null;
	validationLevel: string | null;
	validationAction: string | null;
}

export interface SchemaAuditResult {
	nrecords: number;
	nInvalidDocuments: number;
	nValidDocuments: number;
	compliancePct: number;
	errors: Array<{
		message: string;
		docId?: unknown;
		/** The full document that failed validation (encoded via JsonEncoder) */
		document?: unknown;
	}>;
	warnings: string[];
	hasSchema: boolean;
	tookMs: number;
}

/**
 * Fetch the JSON Schema validator configuration for a collection.
 */
export async function getCollectionSchema(
	client: MongoClientWithMappings,
	dbName: string,
	colName: string,
): Promise<CollectionSchemaInfo> {
	const db = client.db(dbName);
	const collections = await db.listCollections({ name: colName }, { nameOnly: false }).toArray();

	const colInfo = collections[0];
	if (!colInfo) {
		return { hasSchema: false, validator: null, validationLevel: null, validationAction: null };
	}

	const options = (colInfo as { options?: Record<string, unknown> }).options ?? {};

	const validator = (options.validator as Record<string, unknown>) ?? null;
	const validationLevel = (options.validationLevel as string) ?? "strict";
	const validationAction = (options.validationAction as string) ?? "error";

	return {
		hasSchema: !!validator && Object.keys(validator).length > 0,
		validator,
		validationLevel,
		validationAction,
	};
}

/**
 * Extract the inner JSON Schema object from a MongoDB validator document.
 * Validators are typically `{ $jsonSchema: { ... } }` but may also be wrapped
 * in `$and`/`$or` or combined with other operators.
 */
function extractJsonSchema(validator: Record<string, unknown>): Record<string, unknown> | null {
	// Direct $jsonSchema (most common)
	if (validator.$jsonSchema && typeof validator.$jsonSchema === "object") {
		return validator.$jsonSchema as Record<string, unknown>;
	}
	// $and: [{ $jsonSchema: ... }, ...]
	if (Array.isArray(validator.$and)) {
		for (const clause of validator.$and) {
			const extracted = extractJsonSchema(clause as Record<string, unknown>);
			if (extracted) {
				return extracted;
			}
		}
	}
	return null;
}

/** Standard JSON Schema type names that zod's fromJSONSchema supports. */
const STANDARD_TYPES = new Set(["string", "number", "integer", "boolean", "object", "array", "null"]);

/** Map MongoDB bsonType aliases to standard JSON Schema types. */
const BSON_TYPE_MAP: Record<string, string> = {
	int: "integer",
	long: "integer",
	double: "number",
	bool: "boolean",
	decimal: "number",
	objectId: "objectId",
	date: "date",
};

/**
 * JSON Schema keywords that, when present, give the schema actual semantics.
 * If none of these are set, the schema is `z.any()`-equivalent under zod's
 * `fromJSONSchema`, which means it silently accepts `undefined` even when
 * the parent's `required` list includes the property.
 */
const CONSTRAINT_KEYWORDS = [
	"type",
	"bsonType",
	"enum",
	"const",
	"anyOf",
	"oneOf",
	"allOf",
	"$ref",
	"properties",
	"patternProperties",
	"additionalProperties",
	"items",
	"prefixItems",
	"additionalItems",
	"not",
	"required",
	"propertyNames",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isEffectivelyAnySchema(schema: any): boolean {
	if (typeof schema !== "object" || schema === null) {
		return false;
	}
	return !CONSTRAINT_KEYWORDS.some((k) => schema[k] !== undefined);
}

/**
 * Replacement for empty `{}` sub-schemas under a required property: a union
 * of every JSON-representable type. This lets the value be anything (mirroring
 * the original "any" intent) while still rejecting `undefined`, so the parent
 * object's `required` check fires when the field is missing.
 */
const ANY_NON_UNDEFINED_SCHEMA = {
	anyOf: [
		{ type: "string" },
		{ type: "number" },
		{ type: "boolean" },
		{ type: "object" },
		{ type: "array" },
		{ type: "null" },
	],
};

/**
 * Convert a MongoDB $jsonSchema (which uses `bsonType` instead of `type`) into
 * standard JSON Schema Draft-07 that zod's `fromJSONSchema` can enforce.
 *
 * MongoDB-specific types are mapped to EJSON wrapper shapes so zod can
 * perform precise structural validation:
 *   bsonType: "objectId"  →  { type: "object", required: ["$oid"], properties: { $oid: { type: "string" } } }
 *   bsonType: "date"      →  { type: "object", required: ["$date"], properties: { $date: { type: "string" } } }
 *
 * Documents are likewise normalized via `normalizeBsonValue()` so ObjectId
 * instances become `{ $oid: "hex" }` and Date instances become `{ $date: "ISO" }`
 * before validation.
 *
 * Supports bsonType as a string or array (e.g., `["string", "null"]` for nullable).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bsonSchemaToStandard(schema: any): any {
	if (typeof schema !== "object" || schema === null) {
		return schema;
	}
	const out: Record<string, unknown> = { ...schema };
	if (out.bsonType) {
		const bsonTypeVal = out.bsonType;
		delete out.bsonType;
		// Handle array of types (nullable fields): bsonType: ["string", "null"]
		const types: string[] = Array.isArray(bsonTypeVal) ? bsonTypeVal : [bsonTypeVal as string];
		const mapped = types
			.map((t) => BSON_TYPE_MAP[t] ?? (STANDARD_TYPES.has(t) ? t : null))
			.filter((t): t is string => t !== null);
		if (mapped.length === 0) {
			// All types were unknown (binData, regex, etc.) — drop type constraint
		} else if (mapped.length === 1) {
			const bson = mapped[0];
			if (bson === "objectId") {
				out.type = "object";
				out.required = ["$oid"];
				out.properties = { $oid: { type: "string" } };
				return out;
			}
			if (bson === "date") {
				out.type = "object";
				out.required = ["$date"];
				out.properties = { $date: { type: "string" } };
				return out;
			}
			out.type = bson;
		} else {
			// Multiple types — use anyOf. Don't return early; still need to recurse
			// into properties/items/etc. for any object types in the union.
			out.anyOf = mapped.map((t) => {
				if (t === "objectId") {
					return { type: "object", required: ["$oid"], properties: { $oid: { type: "string" } } };
				}
				if (t === "date") {
					return { type: "object", required: ["$date"], properties: { $date: { type: "string" } } };
				}
				return { type: t };
			});
		}
		// binData, regex, timestamp, etc. — drop the type so zod uses z.any()
	}
	if (out.properties) {
		const requiredKeys = new Set(Array.isArray(out.required) ? (out.required as string[]) : []);
		out.properties = Object.fromEntries(
			Object.entries(out.properties as Record<string, unknown>).map(([k, v]) => {
				const converted = bsonSchemaToStandard(v);
				// If a required property has no real constraints, zod's
				// fromJSONSchema collapses it to `z.any()` — which silently
				// accepts `undefined` and defeats the `required` check.
				// Replace with an explicit any-of-any-non-undefined union.
				if (requiredKeys.has(k) && isEffectivelyAnySchema(converted)) {
					return [k, ANY_NON_UNDEFINED_SCHEMA];
				}
				return [k, converted];
			}),
		);
	}
	if (out.additionalProperties && typeof out.additionalProperties === "object") {
		out.additionalProperties = bsonSchemaToStandard(out.additionalProperties);
	}
	if (Array.isArray(out.oneOf)) {
		out.oneOf = (out.oneOf as Array<unknown>).map((v) => bsonSchemaToStandard(v));
	}
	if (Array.isArray(out.anyOf)) {
		out.anyOf = (out.anyOf as Array<unknown>).map((v) => bsonSchemaToStandard(v));
	}
	if (Array.isArray(out.allOf)) {
		out.allOf = (out.allOf as Array<unknown>).map((v) => bsonSchemaToStandard(v));
	}
	if (out.items) {
		out.items = Array.isArray(out.items)
			? (out.items as Array<unknown>).map((v) => bsonSchemaToStandard(v))
			: bsonSchemaToStandard(out.items);
	}
	return out;
}

/**
 * Recursively normalise BSON types in a document to their EJSON wrapper
 * representations so zod can structurally validate them against a schema
 * that has been converted to expect those wrappers.
 *
 *   ObjectId  →  { $oid: "...hex..." }
 *   Date      →  { $date: "...ISO..." }
 *   Decimal128 →  { $numberDecimal: "...string..." }
 *   Long      →  { $numberLong: "...string..." }
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBsonValue(value: any): any {
	if (value === null || value === undefined) {
		return value;
	}
	if (typeof value !== "object") {
		return value;
	}
	if (value instanceof Date) {
		return { $date: value.toISOString() };
	}
	// ObjectId
	if (value.constructor?.name === "ObjectId" && typeof value.toHexString === "function") {
		return { $oid: value.toHexString() };
	}
	// Decimal128
	if (value.constructor?.name === "Decimal128" && typeof value.toString === "function") {
		return { $numberDecimal: value.toString() };
	}
	// Long
	if (value.constructor?.name === "Long" && typeof value.toString === "function") {
		return { $numberLong: value.toString() };
	}
	if (Array.isArray(value)) {
		return value.map(normalizeBsonValue);
	}
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value)) {
		out[k] = normalizeBsonValue(v);
	}
	return out;
}

/**
 * BSON numeric types that have no faithful representation in JavaScript:
 * MongoDB distinguishes int/long/double/decimal at the storage layer, but
 * when a document is returned through the Node driver they all surface as
 * `number` (or wrapped Long/Decimal128 for ranges that don't fit).
 *
 * If a validator constrains a field to one of these, our zod-based audit
 * cannot reliably detect violations — so we use this to produce a more
 * helpful fallback message when we know specific feedback isn't possible.
 */
const PRECISE_BSON_NUMERIC_TYPES = new Set(["int", "long", "double", "decimal"]);

/** Walk the schema tree and check whether any field uses a precise BSON numeric type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function schemaUsesPreciseBsonTypes(schema: any): boolean {
	if (typeof schema !== "object" || schema === null) {
		return false;
	}
	if (schema.bsonType) {
		const types = Array.isArray(schema.bsonType) ? schema.bsonType : [schema.bsonType];
		if (types.some((t: unknown) => typeof t === "string" && PRECISE_BSON_NUMERIC_TYPES.has(t))) {
			return true;
		}
	}
	for (const key of ["properties", "patternProperties"]) {
		const props = schema[key];
		if (props && typeof props === "object") {
			for (const v of Object.values(props)) {
				if (schemaUsesPreciseBsonTypes(v)) {
					return true;
				}
			}
		}
	}
	for (const key of ["items", "additionalProperties", "additionalItems"]) {
		const v = schema[key];
		if (v && typeof v === "object" && schemaUsesPreciseBsonTypes(v)) {
			return true;
		}
	}
	for (const key of ["oneOf", "anyOf", "allOf"]) {
		const arr = schema[key];
		if (Array.isArray(arr) && arr.some((v) => schemaUsesPreciseBsonTypes(v))) {
			return true;
		}
	}
	return false;
}

/**
 * Validate a single document against a $jsonSchema and return human-readable
 * failure messages for each violated constraint.
 *
 * Converts the MongoDB bsonType schema to standard JSON Schema, then uses
 * zod's z.fromJSONSchema() which handles nested schemas, oneOf/anyOf,
 * patternProperties, and all other JSON Schema keywords.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateDocument(schema: Record<string, unknown>, doc: any): string[] {
	try {
		const standardSchema = bsonSchemaToStandard(schema);
		const validator = z.fromJSONSchema(standardSchema);
		const normalized = normalizeBsonValue(doc);
		const result = validator.safeParse(normalized);
		if (result.success) {
			return [];
		}
		return [z.prettifyError(result.error)];
	} catch {
		return ["document does not match schema (could not parse schema with zod)"];
	}
}

/**
 * Audit schema compliance for a collection.
 *
 * Uses aggregation with the `$jsonSchema` operator rather than `db.validate()`
 * because validate() does not reliably return `nInvalidDocuments` counts in
 * MongoDB 8.x (always returns 0, only logs a warning to the server log).
 */
export async function auditSchemaCompliance(
	client: MongoClientWithMappings,
	dbName: string,
	colName: string,
	opts?: {
		readPreference?: ReadPreference;
		maxTimeMS?: number;
	},
): Promise<SchemaAuditResult> {
	const coll = client.db(dbName).collection(colName);

	const schemaInfo = await getCollectionSchema(client, dbName, colName);

	if (!schemaInfo.hasSchema || !schemaInfo.validator) {
		return {
			nrecords: 0,
			nInvalidDocuments: 0,
			nValidDocuments: 0,
			compliancePct: 100,
			errors: [],
			warnings: [],
			hasSchema: false,
			tookMs: 0,
		};
	}

	const jsonSchema = extractJsonSchema(schemaInfo.validator);
	if (!jsonSchema) {
		return {
			nrecords: 0,
			nInvalidDocuments: 0,
			nValidDocuments: 0,
			compliancePct: 100,
			errors: [],
			warnings: [
				"Validator is present but could not extract a $jsonSchema for auditing — validator may use non-schema operators",
			],
			hasSchema: true,
			tookMs: 0,
		};
	}

	const start = performance.now();

	const aggOptions: Record<string, unknown> = {};
	if (opts?.readPreference) {
		aggOptions.readPreference = opts.readPreference;
	}
	if (opts?.maxTimeMS) {
		aggOptions.maxTimeMS = opts.maxTimeMS;
	}

	const total = await coll.countDocuments({}, aggOptions);

	// Count non-matching documents.
	// $nor + $jsonSchema identifies docs that don't conform.
	const nonMatchingResult = await coll
		.aggregate([{ $match: { $nor: [{ $jsonSchema: jsonSchema }] } }, { $count: "c" }], aggOptions)
		.next()
		.then((r) => (r as { c: number } | null)?.c ?? 0)
		.catch(() => null);

	if (nonMatchingResult === null) {
		return {
			nrecords: total,
			nInvalidDocuments: 0,
			nValidDocuments: total,
			compliancePct: 100,
			errors: [],
			warnings: ["Unable to count non-matching documents (aggregation failed)"],
			hasSchema: true,
			tookMs: Math.round(performance.now() - start),
		};
	}

	const nInvalidDocuments = nonMatchingResult;
	const nValidDocuments = total - nInvalidDocuments;
	const compliancePct = total > 0 ? Math.round((nValidDocuments / total) * 10000) / 100 : 100;

	// Sample non-matching documents (up to 20)
	const sampleDocs = await coll
		.aggregate([{ $match: { $nor: [{ $jsonSchema: jsonSchema }] } }, { $limit: 20 }], aggOptions)
		.toArray();

	// Compare each non-matching doc against individual $jsonSchema constraints
	// to produce specific error messages rather than a generic "does not match".
	// When zod can't pinpoint the failure (returns no issues), it usually means
	// the violation is a BSON-specific type distinction that isn't visible from
	// the JS value alone (e.g. `bsonType: "double"` where the doc has an int).
	const fallbackMessage = schemaUsesPreciseBsonTypes(jsonSchema)
		? "The validator uses BSON-specific numeric types (int/long/double/decimal) which cannot be distinguished from a JavaScript value alone — try inspecting the document directly in MongoDB."
		: "Failed to detect validation error";

	const errors: SchemaAuditResult["errors"] = sampleDocs.map((doc) => {
		const failures = validateDocument(jsonSchema, doc);
		return {
			message: failures.length > 0 ? failures.join("; ") : fallbackMessage,
			docId: doc._id,
			document: doc,
		};
	});

	const tookMs = Math.round(performance.now() - start);

	return {
		nrecords: total,
		nInvalidDocuments,
		nValidDocuments,
		compliancePct,
		errors,
		warnings: [],
		hasSchema: true,
		tookMs,
	};
}
