import type { MongoClientWithMappings } from "$lib/server/mongo";
import { ReadPreference } from "mongodb";

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
	errors: Array<{ message: string; docId?: string }>;
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

	const total = await coll.countDocuments({});

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

	const errors: SchemaAuditResult["errors"] = sampleDocs.map((doc) => ({
		message: "Document does not match schema",
		docId: String(doc._id),
	}));

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
