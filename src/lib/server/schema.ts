import type { MongoClientWithMappings } from "$lib/server/mongo";
import { ReadPreference } from "mongodb";

export interface CollectionSchemaInfo {
	/** Whether a JSON Schema validator is set on the collection */
	hasSchema: boolean;
	/** The JSON Schema document (if any) */
	validator: Record<string, unknown> | null;
	/** The validation level: "off" | "strict" | "moderate" */
	validationLevel: string | null;
	/** The validation action: "error" | "warn" */
	validationAction: string | null;
}

export interface SchemaAuditResult {
	/** Total number of documents scanned */
	nrecords: number;
	/** Number of documents that fail validation */
	nInvalidDocuments: number;
	/** Number of documents that pass validation */
	nValidDocuments: number;
	/** Percentage of documents that pass validation (0-100) */
	compliancePct: number;
	/** Validation errors (sampled, if any) */
	errors: Array<{
		message: string;
		/** The document ID that failed validation (if available) */
		docId?: string;
	}>;
	/** Warnings from validation (sampled, if any) */
	warnings: string[];
	/** Whether the collection has a validator at all */
	hasSchema: boolean;
	/** How long validation took in milliseconds */
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
		return {
			hasSchema: false,
			validator: null,
			validationLevel: null,
			validationAction: null,
		};
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
 * Audit schema compliance for a collection.
 * Runs the MongoDB `validate` command with `full: false` for faster validation.
 * Optionally uses a read preference to target analytics/secondary nodes.
 */
export async function auditSchemaCompliance(
	client: MongoClientWithMappings,
	dbName: string,
	colName: string,
	opts?: {
		/** Read preference mode to target specific nodes */
		readPreference?: ReadPreference;
		/** Max time in ms for the validate command */
		maxTimeMS?: number;
	},
): Promise<SchemaAuditResult> {
	const db = client.db(dbName);

	// First, check if there's a schema at all
	const schemaInfo = await getCollectionSchema(client, dbName, colName);

	if (!schemaInfo.hasSchema) {
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

	const start = performance.now();

	// Run the validate command. Pass readPreference directly so it routes to the
	// configured node (e.g. analytics/secondary) if specified.
	const result = (await db.command(
		{
			validate: colName,
			full: false,
		},
		{
			...(opts?.readPreference ? { readPreference: opts.readPreference } : {}),
			...(opts?.maxTimeMS ? { maxTimeMS: opts.maxTimeMS } : {}),
		},
	)) as {
		ns: string;
		nrecords: number;
		nInvalidDocuments?: number;
		errors?: string[];
		warnings?: string[];
		valid?: boolean;
	};

	const tookMs = Math.round(performance.now() - start);

	const nrecords = result.nrecords ?? 0;
	const nInvalidDocuments = result.nInvalidDocuments ?? 0;
	const nValidDocuments = nrecords - nInvalidDocuments;
	const compliancePct = nrecords > 0 ? Math.round((nValidDocuments / nrecords) * 10000) / 100 : 100;

	// Parse errors into structured form
	const errors: SchemaAuditResult["errors"] = [];
	for (const errMsg of result.errors ?? []) {
		// Try to extract document ID from error messages like:
		// "Document failed validation -- <docId>: <reason>"
		const match = errMsg.match(/Document failed validation\s*--\s*(\S+):?\s*(.*)/);
		if (match) {
			errors.push({
				message: match[2] || errMsg,
				docId: match[1],
			});
		} else {
			errors.push({ message: errMsg });
		}
	}

	return {
		nrecords,
		nInvalidDocuments,
		nValidDocuments,
		compliancePct,
		errors,
		warnings: result.warnings ?? [],
		hasSchema: true,
		tookMs,
	};
}
