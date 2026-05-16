import type { MongoClientWithMappings } from "$lib/server/mongo";
import JsonEncoder from "$lib/server/JsonEncoder";
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

/**
 * Convert a MongoDB $jsonSchema (which uses `bsonType` instead of `type`) into
 * standard JSON Schema Draft-07 that zod's `fromJSONSchema` can enforce.
 *
 * MongoDB-specific type names (objectId, date, binData, decimal, etc.) are
 * mapped to their closest standard equivalent or stripped so zod doesn't throw
 * "Unsupported type". The MongoDB aggregation already identified these docs as
 * non-matching — this conversion is only used to produce better error messages,
 * so a slight loss of type precision on these exotic types is acceptable.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bsonSchemaToStandard(schema: any): any {
	if (typeof schema !== "object" || schema === null) {
		return schema;
	}
	const out: Record<string, unknown> = { ...schema };
	if (out.bsonType) {
		const bson = out.bsonType as string;
		delete out.bsonType;
		// Map MongoDB-only types to standard equivalents.
		// objectId / date are objects in JS; decimal maps to number.
		if (bson === "objectId" || bson === "date") {
			out.type = "object";
		} else if (bson === "decimal") {
			out.type = "number";
		} else if (STANDARD_TYPES.has(bson)) {
			out.type = bson;
		}
		// binData, regex, timestamp, etc. — drop the type so zod uses z.any()
	}
	if (out.properties) {
		out.properties = Object.fromEntries(
			Object.entries(out.properties as Record<string, unknown>).map(([k, v]) => [k, bsonSchemaToStandard(v)]),
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
		const result = validator.safeParse(doc);
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
	const errors: SchemaAuditResult["errors"] = sampleDocs.map((doc) => {
		const failures = validateDocument(jsonSchema, doc);
		return {
			message: failures.length > 0 ? failures.join("; ") : "Document does not match schema",
			docId: JsonEncoder.encode(doc._id),
			document: JsonEncoder.encode(doc),
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
