import { command, query } from "$app/server";
import { validateAggregationPipeline } from "$lib/server/aggregation";
import JsonEncoder from "$lib/server/JsonEncoder";
import { logger } from "$lib/server/logger";
import { getMongo } from "$lib/server/mongo";
import { isEmptyObject } from "$lib/utils/isEmptyObject";
import { parseJSON } from "$lib/utils/jsonParser";
import { error } from "@sveltejs/kit";
import { ObjectId, ReadPreference, type Document } from "mongodb";
import { z } from "zod";

// Check if read-only mode is enabled
function checkReadOnly() {
	if (process.env.MONGOKU_READ_ONLY_MODE === "true") {
		error(403, "Read-only mode is enabled");
	}
}

// Sanitize MongoDB connection string by removing credentials
function sanitizeMongoUrl(url: string): string {
	try {
		const urlObj = new URL(url.startsWith("mongodb") ? url : `mongodb://${url}`);
		if (urlObj.username || urlObj.password) {
			urlObj.username = "***";
			urlObj.password = "***";
		}
		return urlObj.toString();
	} catch {
		// If URL parsing fails, just mask the whole thing
		return "***";
	}
}

// Add a new server
export const addServer = command(
	z.object({
		url: z.string(),
	}),
	async ({ url }) => {
		logger.log("addServer called with payload:", { url: sanitizeMongoUrl(url) });
		const mongo = await getMongo();
		await mongo.addServer(url);
		return { ok: true };
	},
);

// Remove a server
export const removeServer = command(z.string(), async (serverName) => {
	logger.log("removeServer called with payload:", { serverName });
	const mongo = await getMongo();
	await mongo.removeServer(serverName);
	return { ok: true };
});

// Update a document
export const updateDocument = command(
	z.object({
		server: z.string(),
		database: z.string(),
		collection: z.string(),
		document: z.string(),
		value: z.unknown(),
		partial: z.boolean().optional().default(false),
		upsert: z.boolean().optional().default(false),
	}),
	async ({ server, database, collection, document, value, partial, upsert }) => {
		logger.log("updateDocument called with payload:", { server, database, collection, document, partial, upsert });
		checkReadOnly();

		const mongo = await getMongo();
		const client = mongo.getClient(server);
		const coll = client.db(database).collection(collection);

		const newValue = JsonEncoder.decode(value);

		// TODO: For now it makes it impossible to remove fields from object with a projection
		// Todo: handle multiple ID types
		const _id = /^[0-9a-fA-F]{24}$/.test(document) ? new ObjectId(document) : document;
		if (partial) {
			await coll.updateOne(
				{
					_id: _id as unknown as ObjectId,
				},
				{ $set: newValue },
				{ upsert: upsert },
			);
		} else {
			await coll.replaceOne(
				{
					_id: _id as unknown as ObjectId,
				},
				JsonEncoder.decode(newValue),
				{ upsert: upsert },
			);
		}

		if (collection === "mongoku.mappings") {
			client.clearMappingsCache(database, document);
		}

		return {
			ok: true,
			update: JsonEncoder.encode(newValue),
		};
	},
);

// Insert a document
export const insertDocument = command(
	z.object({
		server: z.string(),
		database: z.string(),
		collection: z.string(),
		document: z.string().nullable().optional(),
		value: z.unknown(),
	}),
	async ({ server, database, collection, document, value }) => {
		logger.log("insertDocument called with payload:", { server, database, collection, document });
		checkReadOnly();

		const mongo = await getMongo();
		const client = mongo.getClient(server);
		const coll = client.db(database).collection(collection);

		const newValue = JsonEncoder.decode(value);

		// If document is provided, use it as _id; otherwise let insertOne generate it automatically
		if (document !== null && document !== undefined) {
			const _id = /^[0-9a-fA-F]{24}$/.test(document) ? new ObjectId(document) : document;
			newValue._id = _id;
		}

		const res = await coll.insertOne(newValue);

		if (collection === "mongoku.mappings" && typeof (res.insertedId as unknown) === "string") {
			client.clearMappingsCache(database, res.insertedId as unknown as string);
		}

		return {
			ok: true,
			insert: JsonEncoder.encode(newValue),
		};
	},
);

// Delete a document
export const deleteDocument = command(
	z.object({
		server: z.string(),
		database: z.string(),
		collection: z.string(),
		document: z.string(),
	}),
	async ({ server, database, collection, document }) => {
		logger.log("deleteDocument called with payload:", { server, database, collection, document });
		checkReadOnly();

		const mongo = await getMongo();
		const client = mongo.getClient(server);

		const _id = /^[0-9a-fA-F]{24}$/.test(document) ? new ObjectId(document) : document;

		await client
			.db(database)
			.collection(collection)
			.deleteOne({
				_id: _id as unknown as ObjectId,
			});

		if (collection === "mongoku.mappings") {
			client.clearMappingsCache(database, document);
		}

		return {
			ok: true,
		};
	},
);

// Update multiple documents with an arbitrary update query
export const updateMany = command(
	z.object({
		server: z.string(),
		database: z.string(),
		collection: z.string(),
		filter: z.string(),
		update: z.string(),
	}),
	async ({ server, database, collection, filter, update }) => {
		logger.log("updateMany called with payload:", { server, database, collection, filter, update });
		checkReadOnly();

		const mongo = await getMongo();
		const client = mongo.getClient(server);
		const coll = client.db(database).collection(collection);

		const filterDoc = JsonEncoder.decode(parseJSON(filter));
		const updateDoc = JsonEncoder.decode(parseJSON(update));

		const result = await coll.updateMany(filterDoc, updateDoc);

		return {
			ok: true,
			matchedCount: result.matchedCount,
			modifiedCount: result.modifiedCount,
		};
	},
);

// Count documents matching a filter - uses `command` to avoid URL length limits
export const countDocuments = command(
	z.object({
		server: z.string(),
		database: z.string(),
		collection: z.string(),
		filter: z.string(),
	}),
	async ({ server, database, collection, filter }) => {
		const mongo = await getMongo();
		const client = mongo.getClient(server);
		const coll = client.db(database).collection(collection);

		const filterDoc = JsonEncoder.decode(parseJSON(filter));

		try {
			const count = await coll.countDocuments(filterDoc, {
				maxTimeMS: mongo.getCountTimeout(),
			});

			return {
				data: count,
				error: null,
			};
		} catch (err) {
			logger.error("Error counting documents:", err);
			return {
				data: 0,
				error: `Failed to count documents: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	},
);

// Delete multiple documents with a filter query
export const deleteMany = command(
	z.object({
		server: z.string(),
		database: z.string(),
		collection: z.string(),
		filter: z.string(),
	}),
	async ({ server, database, collection, filter }) => {
		logger.log("deleteMany called with payload:", { server, database, collection, filter });
		checkReadOnly();

		const mongo = await getMongo();
		const client = mongo.getClient(server);
		const coll = client.db(database).collection(collection);

		const filterDoc = JsonEncoder.decode(parseJSON(filter));

		const result = await coll.deleteMany(filterDoc);

		return {
			ok: true,
			deletedCount: result.deletedCount,
		};
	},
);

// Hide an index
export const hideIndex = command(
	z.object({
		server: z.string(),
		database: z.string(),
		collection: z.string(),
		index: z.string(),
	}),
	async ({ server, database, collection, index }) => {
		logger.log("hideIndex called with payload:", { server, database, collection, index });
		checkReadOnly();

		const mongo = await getMongo();
		const client = mongo.getClient(server);

		await client.db(database).command({
			collMod: collection,
			index: {
				name: index,
				hidden: true,
			},
		});

		return {
			ok: true,
		};
	},
);

// Unhide an index
export const unhideIndex = command(
	z.object({
		server: z.string(),
		database: z.string(),
		collection: z.string(),
		index: z.string(),
	}),
	async ({ server, database, collection, index }) => {
		logger.log("unhideIndex called with payload:", { server, database, collection, index });
		checkReadOnly();

		const mongo = await getMongo();
		const client = mongo.getClient(server);

		await client.db(database).command({
			collMod: collection,
			index: {
				name: index,
				hidden: false,
			},
		});

		return {
			ok: true,
		};
	},
);

// Create an index
export const createIndex = command(
	z.object({
		server: z.string(),
		database: z.string(),
		collection: z.string(),
		keys: z.string(),
		name: z.string().optional(),
		unique: z.boolean().optional(),
		sparse: z.boolean().optional(),
		partialFilterExpression: z.string().optional(),
		expireAfterSeconds: z.number().optional(),
		background: z.boolean().optional(),
	}),
	async ({
		server,
		database,
		collection,
		keys,
		name,
		unique,
		sparse,
		partialFilterExpression,
		expireAfterSeconds,
		background,
	}) => {
		logger.log("createIndex called with payload:", { server, database, collection, keys, name, unique, sparse });
		checkReadOnly();

		const mongo = await getMongo();
		const client = mongo.getClient(server);
		const coll = client.db(database).collection(collection);

		// Parse keys JSON
		const keysDoc = JsonEncoder.decode(parseJSON(keys));

		// Build options object
		const options: Record<string, unknown> = {};
		if (name) options.name = name;
		if (unique) options.unique = unique;
		if (sparse) options.sparse = sparse;
		if (partialFilterExpression) {
			options.partialFilterExpression = JsonEncoder.decode(parseJSON(partialFilterExpression));
		}
		if (expireAfterSeconds !== undefined) options.expireAfterSeconds = expireAfterSeconds;
		if (background) options.background = background;

		await coll.createIndex(keysDoc, options);

		return {
			ok: true,
		};
	},
);

// Drop an index
export const dropIndex = command(
	z.object({
		server: z.string(),
		database: z.string(),
		collection: z.string(),
		index: z.string(),
	}),
	async ({ server, database, collection, index }) => {
		logger.log("dropIndex called with payload:", { server, database, collection, index });
		checkReadOnly();

		const mongo = await getMongo();
		const client = mongo.getClient(server);

		await client.db(database).command({
			dropIndexes: collection,
			index: index,
		});

		return {
			ok: true,
		};
	},
);

// Drop a collection
export const dropCollection = command(
	z.object({
		server: z.string(),
		database: z.string(),
		collection: z.string(),
	}),
	async ({ server, database, collection }) => {
		logger.log("dropCollection called with payload:", { server, database, collection });
		checkReadOnly();

		const mongo = await getMongo();
		const client = mongo.getClient(server);
		const db = client.db(database);

		await db.dropCollection(collection);

		return {
			ok: true,
		};
	},
);

// Drop a database
export const dropDatabase = command(
	z.object({
		server: z.string(),
		database: z.string(),
	}),
	async ({ server, database }) => {
		logger.log("dropDatabase called with payload:", { server, database });
		checkReadOnly();

		const mongo = await getMongo();
		const client = mongo.getClient(server);

		await client.db(database).dropDatabase();

		return {
			ok: true,
		};
	},
);

// Retry connection to a server
export const retryConnection = command(z.string(), async (serverId) => {
	logger.log("retryConnection called with payload:", { serverId });
	const mongo = await getMongo();

	// Reconnect the client (closes old connection and creates a new one)
	await mongo.reconnectClient(serverId);

	return { ok: true };
});

// Load documents from a collection - uses `command` to avoid URL length limits
export const loadDocuments = command(
	z.object({
		server: z.string(),
		database: z.string(),
		collection: z.string(),
		query: z.string().default("{}"),
		sort: z.string().default("{}"),
		project: z.string().default("{}"),
		skip: z.number().int().default(0),
		limit: z.number().int().default(20),
		mode: z.enum(["query", "distinct", "aggregation"]).default("query"),
		field: z.string().optional(),
	}),
	async ({ server, database, collection, query: queryStr, sort, project, skip, limit, mode, field }) => {
		// Parse JSON strings - return error if invalid
		let queryDoc: unknown;

		try {
			queryDoc = parseJSON(queryStr, { allowArray: true });
		} catch (err) {
			error(400, `Invalid query: ${err}`);
		}

		try {
			parseJSON(sort);
		} catch (err) {
			error(400, `Invalid sort: ${err}`);
		}

		try {
			parseJSON(project);
		} catch (err) {
			error(400, `Invalid project: ${err}`);
		}

		const sortDoc = parseJSON(sort);
		const projectDoc = parseJSON(project) as Document;

		const mongo = await getMongo();
		const client = mongo.getClient(server);
		const coll = client.db(database).collection(collection);

		// Handle distinct mode
		if (mode === "distinct") {
			if (!field) {
				error(400, "Invalid distinct query: field name is required");
			}

			try {
				const results = await coll.distinct(field, JsonEncoder.decode(queryDoc), {
					maxTimeMS: mongo.getQueryTimeout(),
				});

				return {
					data: results.map((value) => JsonEncoder.encode({ value })),
					error: null,
					isAggregation: false,
					isDistinct: true,
				};
			} catch (err) {
				logger.error("Error executing distinct:", err);
				error(500, `Failed to execute distinct: ${err instanceof Error ? err.message : String(err)}`);
			}
		}

		// Handle aggregation mode
		if (mode === "aggregation" && Array.isArray(queryDoc)) {
			try {
				validateAggregationPipeline(queryDoc);
			} catch (err) {
				error(400, `Invalid aggregation pipeline: ${err instanceof Error ? err.message : String(err)}`);
			}

			// Execute aggregation
			const pipeline = JsonEncoder.decode(queryDoc);

			try {
				const results = await coll
					.aggregate(
						[
							...pipeline,
							...(isEmptyObject(projectDoc) ? [] : [{ $project: projectDoc }]),
							...(isEmptyObject(sortDoc as object) ? [] : [{ $sort: sortDoc }]),
							{ $limit: limit },
							{ $skip: skip },
						],
						{
							maxTimeMS: mongo.getQueryTimeout(),
						},
					)
					.map((obj) => JsonEncoder.encode(obj))
					.toArray();

				return {
					data: results,
					error: null,
					isAggregation: true,
					isDistinct: false,
				};
			} catch (err) {
				logger.error("Error executing aggregation:", err);
				error(500, `Failed to execute aggregation: ${err instanceof Error ? err.message : String(err)}`);
			}
		}

		// Execute regular find query
		try {
			const results = await coll
				.find(JsonEncoder.decode(queryDoc), { maxTimeMS: mongo.getQueryTimeout() })
				.project(projectDoc)
				.sort(JsonEncoder.decode(sortDoc))
				.limit(limit)
				.skip(skip)
				.map((obj) => JsonEncoder.encode(obj))
				.toArray();

			return {
				data: results,
				error: null,
				isAggregation: false,
				isDistinct: false,
			};
		} catch (err) {
			logger.error("Error fetching query results:", err);
			error(500, `Failed to fetch query results: ${err instanceof Error ? err.message : String(err)}`);
		}
	},
);

// Fetch a document by field value (for mappings)
// Tries multiple mapping targets and returns the first one that finds a document
// Only handles document mappings; URL mappings are handled client-side
export const fetchMappedDocument = query(
	z.object({
		server: z.string(),
		database: z.string(),
		mappings: z.array(
			z.union([
				z.object({
					type: z.literal("document"),
					collection: z.string(),
					on: z.string(),
				}),
				z.object({
					type: z.literal("url"),
					template: z.string(),
				}),
				// Legacy format (backwards compatibility)
				z.object({
					collection: z.string(),
					on: z.string(),
				}),
			]),
		),
		value: z.unknown(),
	}),
	async ({ server, database, mappings, value }) => {
		const mongo = await getMongo();
		const client = mongo.getClient(server);
		const decodedValue = JsonEncoder.decode(value);

		// Filter to only document mappings (URL mappings are handled client-side)
		const documentMappings = mappings.filter((m) => {
			if ("type" in m) {
				return m.type === "document";
			}
			// Legacy format without type field is a document mapping
			return "collection" in m && "on" in m;
		});

		// Try each document mapping in order and return the first match
		for (const mapping of documentMappings) {
			try {
				// Type guard for TypeScript
				if ("type" in mapping && mapping.type !== "document") continue;

				const collection = "collection" in mapping ? mapping.collection : "";
				const on = "on" in mapping ? mapping.on : "_id";

				const coll = client.db(database).collection(collection);
				const query = { [on]: decodedValue };

				const document = await coll.findOne(query, { maxTimeMS: mongo.getQueryTimeout() });

				if (document) {
					return {
						data: JsonEncoder.encode(document),
						collection: collection,
						error: null,
					};
				}
			} catch (err) {
				const collection = "collection" in mapping ? mapping.collection : "unknown";
				const on = "on" in mapping ? mapping.on : "_id";
				logger.error(`Error fetching mapped document from ${collection}.${on}:`, err);
				// Continue to next mapping on error
				continue;
			}
		}

		// No mapping found a document
		return {
			data: null,
			collection: null,
			error: "Document not found in any mapped collection",
		};
	},
);

// Fetch index stats with read preference
export const getIndexStatsWithReadPreference = query(
	z.object({
		server: z.string(),
		database: z.string(),
		collection: z.string(),
		readPreferenceMode: z.string().optional(),
		readPreferenceTags: z.string().optional(),
	}),
	async ({ server, database, collection, readPreferenceMode, readPreferenceTags }) => {
		const mongo = await getMongo();
		const client = mongo.getClient(server);

		try {
			// Parse tags if provided
			let tags;
			if (readPreferenceTags) {
				try {
					tags = parseJSON(readPreferenceTags);
					// Ensure tags is an object or array of objects
					if (typeof tags !== "object" || tags === null) {
						error(400, "Invalid read preference tags format");
					}
					// If it's a single object, wrap it in an array
					if (!Array.isArray(tags)) {
						tags = [tags];
					}
				} catch (err) {
					error(400, `Invalid read preference tags JSON: ${err}`);
				}
			}

			// Build read preference
			let readPreference;
			if (readPreferenceMode || tags) {
				const mode = (readPreferenceMode || "nearest") as
					| "primary"
					| "primaryPreferred"
					| "secondary"
					| "secondaryPreferred"
					| "nearest";
				readPreference = tags ? new ReadPreference(mode, tags) : new ReadPreference(mode);
			}

			const coll = client.db(database).collection(collection);

			// Get index usage statistics with read preference
			const aggregateOptions = readPreference ? { readPreference } : {};
			const statsResult = await coll.aggregate([{ $indexStats: {} }], aggregateOptions).toArray();

			const indexStats = Object.fromEntries(
				statsResult.map((stat) => [
					stat.name,
					{
						ops: stat.accesses?.ops || 0,
						since: stat.accesses?.since || new Date(),
						host: stat.host || "unknown",
					},
				]),
			);

			return {
				data: JsonEncoder.encode(indexStats),
				error: null,
			};
		} catch (err) {
			logger.error("Error fetching index stats with read preference:", err);
			return {
				data: {},
				error: `Failed to fetch index stats: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	},
);

// Get list of nodes from a server's connection string
export const getServerNodes = query(
	z.object({
		server: z.string(),
	}),
	async ({ server }) => {
		const mongo = await getMongo();

		try {
			const nodes = await mongo.getServerNodes(server);
			return {
				data: nodes,
				error: null,
			};
		} catch (err) {
			logger.error("Error getting server nodes:", err);
			return {
				data: [],
				error: `Failed to get server nodes: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	},
);

// Detect which node is the primary
export const detectPrimaryNode = query(
	z.object({
		server: z.string(),
		database: z.string(),
		collection: z.string(),
	}),
	async ({ server, database, collection }) => {
		const mongo = await getMongo();
		const client = mongo.getClient(server);

		try {
			// Run indexStats with primary read preference
			const coll = client.db(database).collection(collection);
			const statsResult = await coll
				.aggregate([{ $indexStats: {} }], { readPreference: new ReadPreference("primary") })
				.toArray();

			// Extract the host from the first result (will be the primary)
			const primaryHost = statsResult.length > 0 ? statsResult[0].host : null;

			return {
				data: primaryHost,
				error: null,
			};
		} catch (err) {
			logger.error("Error detecting primary node:", err);
			return {
				data: null,
				error: `Failed to detect primary: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	},
);

// Fetch index stats from specific nodes using direct connections
export const getIndexStatsFromNodes = query(
	z.object({
		server: z.string(),
		database: z.string(),
		collection: z.string(),
		nodes: z.array(z.string()),
	}),
	async ({ server, database, collection, nodes }) => {
		const mongo = await getMongo();

		try {
			const results = await Promise.allSettled(
				nodes.map(async (node) => {
					const stats = await mongo.getIndexStatsFromNode(server, node, database, collection);
					return { node, stats };
				}),
			);

			// Merge results from all nodes
			const mergedStats: Record<string, { ops: number; since: Date; host: string }> = {};
			const errors: string[] = [];

			let i = 0;
			for (const result of results) {
				if (result.status === "fulfilled") {
					const { stats } = result.value;
					for (const [indexName, indexStats] of Object.entries(stats)) {
						const key = `${indexName}::${indexStats.host}`;
						mergedStats[key] = indexStats;
					}
				} else {
					logger.error(`Error fetching index stats from node ${nodes[i]}:`, result.reason);
					errors.push(result.reason?.message || String(result.reason));
				}
				i++;
			}

			return {
				data: JsonEncoder.encode(mergedStats),
				error: errors.length > 0 ? errors.join("; ") : null,
			};
		} catch (err) {
			logger.error("Error fetching index stats from nodes:", err);
			return {
				data: {},
				error: `Failed to fetch index stats: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	},
);

// Explain a query and return execution statistics
export const explainQuery = query(
	z.object({
		server: z.string(),
		database: z.string(),
		collection: z.string(),
		query: z.string().default("{}"),
		sort: z.string().default("{}"),
		project: z.string().default("{}"),
		skip: z.number().int().default(0),
		limit: z.number().int().default(20),
		mode: z.enum(["query", "aggregation"]).default("query"),
		verbosity: z.enum(["queryPlanner", "executionStats", "allPlansExecution"]).default("executionStats"),
	}),
	async ({ server, database, collection, query: queryStr, sort, project, skip, limit, mode, verbosity }) => {
		// Parse JSON strings
		const queryDoc = (() => {
			try {
				return parseJSON(queryStr, { allowArray: true });
			} catch (err) {
				error(400, `Invalid query: ${err}`);
			}
		})();

		try {
			parseJSON(sort);
		} catch (err) {
			error(400, `Invalid sort: ${err}`);
		}

		try {
			parseJSON(project);
		} catch (err) {
			error(400, `Invalid project: ${err}`);
		}

		const sortDoc = parseJSON(sort);
		const projectDoc = parseJSON(project) as Document;

		const mongo = await getMongo();
		const client = mongo.getClient(server);
		const coll = client.db(database).collection(collection);

		try {
			let explainResult;

			if (mode === "aggregation" && Array.isArray(queryDoc)) {
				// Validate aggregation pipeline
				try {
					validateAggregationPipeline(queryDoc);
				} catch (err) {
					error(400, `Invalid aggregation pipeline: ${err instanceof Error ? err.message : String(err)}`);
				}

				// Build the full pipeline with project, sort, limit, skip
				const pipeline = JsonEncoder.decode(queryDoc);
				const fullPipeline = [
					...pipeline,
					...(isEmptyObject(projectDoc) ? [] : [{ $project: projectDoc }]),
					...(isEmptyObject(sortDoc as object) ? [] : [{ $sort: sortDoc }]),
					{ $skip: skip },
					{ $limit: limit },
				];

				// Aggregation explain
				explainResult = await coll.aggregate(fullPipeline).explain(verbosity);
			} else {
				// Find explain
				explainResult = await coll
					.find(JsonEncoder.decode(queryDoc))
					.project(projectDoc)
					.sort(JsonEncoder.decode(sortDoc))
					.skip(skip)
					.limit(limit)
					.explain(verbosity);
			}

			// Convert to plain object to handle MongoDB special types (Long, Timestamp, etc.)
			// that JsonEncoder doesn't support
			const plainResult = JSON.parse(JSON.stringify(explainResult));

			return {
				data: plainResult,
				error: null,
			};
		} catch (err) {
			logger.error("Error explaining query:", err);
			return {
				data: null,
				error: `Failed to explain query: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	},
);

// Count documents created within a time range (based on ObjectId timestamp or createdAt field)
export const countDocumentsByTimeRange = query(
	z.object({
		server: z.string(),
		database: z.string(),
		collection: z.string(),
		timeRanges: z.array(
			z.object({
				label: z.string(),
				days: z.number(),
			}),
		),
	}),
	async ({ server, database, collection, timeRanges }) => {
		const mongo = await getMongo();
		const client = mongo.getClient(server);
		const coll = client.db(database).collection(collection);

		// Check if _id has a creation timestamp (is ObjectId with embedded date)
		// Use createdAt field ONLY if _id doesn't have a date
		let useCreatedAt = false;
		try {
			const sample = await coll.findOne({}, { projection: { _id: 1, createdAt: 1 }, maxTimeMS: 5000 });
			if (sample) {
				const idIsObjectId = sample._id instanceof ObjectId;
				if (!idIsObjectId && sample.createdAt !== undefined) {
					useCreatedAt = true;
				}
			}
		} catch {
			// If sampling fails, default to ObjectId
		}

		// Sort by days ascending so shorter ranges (faster queries) run first
		const sortedRanges = [...timeRanges].sort((a, b) => a.days - b.days);

		const results: Array<{ label: string; days: number; count: number | null; error: string | null }> = [];

		// Run queries sequentially - shorter ranges complete even if longer ones timeout
		let hitTimeout = false;
		for (const { label, days } of sortedRanges) {
			if (hitTimeout) {
				results.push({ label, days, count: null, error: "Skipped (previous range timed out)" });
				continue;
			}

			const dateThreshold = new Date();
			dateThreshold.setDate(dateThreshold.getDate() - days);

			// Build filter based on _id type
			let filter;
			if (useCreatedAt) {
				filter = { createdAt: { $gte: dateThreshold } };
			} else {
				const objectIdThreshold = ObjectId.createFromTime(Math.floor(dateThreshold.getTime() / 1000));
				filter = { _id: { $gte: objectIdThreshold } };
			}

			try {
				const count = await coll.countDocuments(filter, { maxTimeMS: mongo.getCountTimeout() });
				results.push({ label, days, count, error: null });
			} catch (err) {
				logger.error(`Error counting documents for ${label}:`, err);
				const errorMsg = err instanceof Error ? err.message : String(err);
				if (errorMsg.includes("time limit") || errorMsg.includes("timed out")) {
					hitTimeout = true;
				}
				results.push({ label, days, count: null, error: errorMsg });
			}
		}

		// Re-sort results to match original order
		const originalOrder = new Map(timeRanges.map((r, i) => [r.label, i]));
		results.sort((a, b) => (originalOrder.get(a.label) ?? 0) - (originalOrder.get(b.label) ?? 0));

		return { data: results, error: null };
	},
);

/// Generate MongoDB query from natural language using HuggingFace Inference API
export const generateQueryFromNL = query(
	z.object({
		prompt: z.string(),
		collection: z.string(),
	}),
	async ({ prompt, collection }) => {
		const hfToken = process.env.HF_TOKEN;
		const hfModel = process.env.HF_MODEL || "Qwen/Qwen2.5-72B-Instruct";

		if (!hfToken) {
			return { query: null, error: "HF_TOKEN not configured. Start server with HF_TOKEN=your_token" };
		}

		try {
			const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${hfToken}`,
				},
				body: JSON.stringify({
					model: hfModel,
					messages: [
						{
							role: "system",
							content: `You are a MongoDB query generator. Convert natural language to MongoDB queries.
Current time: ${new Date().toISOString()}

RULES:
1. Output ONLY valid JSON (Object for filter, Array for aggregation).
2. DO NOT INVENT operators or syntax. Use only standard MongoDB operators.
3. If the user asks for something impossible or ambiguous, return: {"error": "Cannot generate query. Please check <a href='https://www.mongodb.com/docs/manual/tutorial/query-documents/' target='_blank' style='color: var(--link); text-decoration: underline;'>MongoDB documentation</a>."}
4. If the user asks about INDEXES (creating, dropping, listing, optimizing), return: {"error": "Index management is not supported via query generator. Please check <a href='https://www.mongodb.com/docs/manual/indexes/' target='_blank' style='color: var(--link); text-decoration: underline;'>MongoDB Indexes documentation</a>."}
5. Do not guess field names unnecessarily, but assume reasonable defaults for common concepts (e.g., "created" -> "createdAt").
6. DO NOT include conversational text, markdown formatting (e.g. code blocks), or explanations. Just the raw JSON string.

BEST PRACTICES:
- Always use "$match" as early as possible in aggregation pipeline to filter documents.
- Avoid "$unwind" if not necessary, as it can be expensive.
- Prefer "$project" to limit fields returned.

OUTPUT FORMAT:
- Filter: "{ ... }"
- Aggregation: "[{ ... }, { ... }]"
- Error: "{\"error\": \"...\"}"

EXAMPLES:
User: "active users"
JSON: {"status": "active"}

User: "users created last week"
JSON: {"createdAt": {"$gte": {"$date": "..."}}}

User: "how many users?"
JSON: [{"$count": "total"}]

User: "count users by status"
JSON: [{"$group": {_id: "$status", count: {"$sum": 1}}}]

User: "largest document (size)"
JSON: [{"$addFields": {"bsonsize": {"$bsonSize": "$$ROOT"}}}, {"$sort": {"bsonsize": -1}}, {"$limit": 1}]

User: "newest document"
JSON: [{"$sort": {"_id": -1}}, {"$limit": 1}]

User: "sort by name desc"
JSON: [{"$sort": {"name": -1}}]

Use MongoDB operators: $exists, $regex, $gt, $lt, $gte, $lte, $in, $ne, $and, $or, $date.
For "largest" or "biggest" document, assume size in bytes unless specified otherwise.
For "newest" or "latest", sort by _id or createdAt.`,
						},
						{
							role: "user",
							content: `Collection: ${collection}\nQuery: ${prompt}`,
						},
					],
					max_tokens: 200,
					temperature: 0.1,
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				logger.error("HF API error:", response.status, errorText);
				return { query: null, error: `API error ${response.status}: ${errorText.slice(0, 150)}` };
			}

			const result = await response.json();
			const generated = result.choices?.[0]?.message?.content ?? "";
			logger.info("AI generated:", generated);

			// Extract JSON from response (Object or Array)
			const jsonMatch = generated.match(/(\{|\[)[\s\S]*(\}|\])/);
			if (jsonMatch) {
				try {
					const parsed = JSON.parse(jsonMatch[0]);
					// Handle AI explicit error response
					if (!Array.isArray(parsed) && parsed.error) {
						return { query: null, error: parsed.error };
					}
					return { query: jsonMatch[0], error: null };
				} catch {
					return { query: null, error: `Invalid JSON: ${generated.slice(0, 100)}` };
				}
			}

			return { query: null, error: `No JSON found: ${generated.slice(0, 100)}` };
		} catch (err) {
			logger.error("Error generating query:", err);
			return { query: null, error: `Error: ${err instanceof Error ? err.message : String(err)}` };
		}
	},
);

function patternMatch(prompt: string): { query: string | null; error: string | null } {
	const input = prompt.toLowerCase().trim();

	// All documents
	if (input.includes("all") || input.includes("everything") || input.includes("every")) {
		return { query: "{}", error: null };
	}

	// How many / count - return empty filter to count all
	if (input.includes("how many") || input.includes("count")) {
		return { query: "{}", error: null };
	}

	// Does collection have field X / does field X exist
	const hasFieldPattern = input.match(/(?:have|has|contain)\s+(?:a\s+)?field\s+(?:called\s+|named\s+)?["']?(\w+)["']?/i);
	if (hasFieldPattern) {
		return { query: `{"${hasFieldPattern[1]}": {"$exists": true}}`, error: null };
	}

	// Does X exist / is there X / field X exists
	const existsPattern = input.match(/(?:does|is)\s+(?:there\s+)?(?:a\s+)?(?:field\s+)?["']?(\w+)["']?\s+exist/i);
	if (existsPattern && !["this", "the", "it", "collection"].includes(existsPattern[1].toLowerCase())) {
		return { query: `{"${existsPattern[1]}": {"$exists": true}}`, error: null };
	}

	// X exists
	const simpleExistsMatch = input.match(/^["']?(\w+)["']?\s+exists?$/i);
	if (simpleExistsMatch) {
		return { query: `{"${simpleExistsMatch[1]}": {"$exists": true}}`, error: null };
	}

	// Status patterns: "status is active", "status = published", "where status is X"
	const statusMatch = input.match(/(?:where\s+)?status\s+(?:is|=|equals?)?\s*["']?(\w+)["']?/i);
	if (statusMatch) {
		return { query: `{"status": "${statusMatch[1]}"}`, error: null };
	}

	// Field equals value: "type is model", "name = john", "where X is Y"
	const fieldEqualsMatch = input.match(/(?:where\s+)?(\w+)\s+(?:is|=|equals?)\s+["']?([^"'\s]+)["']?/i);
	if (fieldEqualsMatch && !["how", "what", "where", "this", "the", "there", "it", "collection"].includes(fieldEqualsMatch[1].toLowerCase())) {
		const value = fieldEqualsMatch[2];
		// Check if value is a number
		if (/^\d+$/.test(value)) {
			return { query: `{"${fieldEqualsMatch[1]}": ${value}}`, error: null };
		}
		return { query: `{"${fieldEqualsMatch[1]}": "${value}"}`, error: null };
	}

	// Contains/regex: "name contains john", "X includes Y"
	const containsMatch = input.match(/(\w+)\s+(?:contains?|includes?|like)\s+["']?(\w+)["']?/i);
	if (containsMatch) {
		return { query: `{"${containsMatch[1]}": {"$regex": "${containsMatch[2]}", "$options": "i"}}`, error: null };
	}

	// Greater than: "age > 18", "downloads greater than 1000", "X more than Y"
	const gtMatch = input.match(/(\w+)\s*(?:>|>=|greater\s+than|more\s+than|above|over)\s*(\d+)/i);
	if (gtMatch) {
		return { query: `{"${gtMatch[1]}": {"$gt": ${gtMatch[2]}}}`, error: null };
	}

	// Less than: "age < 18", "X less than Y", "X below Y"
	const ltMatch = input.match(/(\w+)\s*(?:<|<=|less\s+than|below|under)\s*(\d+)/i);
	if (ltMatch) {
		return { query: `{"${ltMatch[1]}": {"$lt": ${ltMatch[2]}}}`, error: null };
	}

	// Last X days/hours/weeks: "created in last 7 days", "last 30 days"
	const timeMatch = input.match(/last\s+(\d+)\s+(day|hour|week|month)s?/i);
	if (timeMatch) {
		const amount = parseInt(timeMatch[1]);
		const unit = timeMatch[2].toLowerCase();
		const date = new Date();
		if (unit === "hour") date.setHours(date.getHours() - amount);
		else if (unit === "day") date.setDate(date.getDate() - amount);
		else if (unit === "week") date.setDate(date.getDate() - amount * 7);
		else if (unit === "month") date.setMonth(date.getMonth() - amount);
		return { query: `{createdAt: {$gte: Date("${date.toISOString()}")}}`, error: null };
	}

	// Not equal: "status not X", "X != Y", "X is not Y"
	const neMatch = input.match(/(\w+)\s+(?:!=|is\s+not|not)\s+["']?(\w+)["']?/i);
	if (neMatch && !["this", "the", "it"].includes(neMatch[1].toLowerCase())) {
		return { query: `{"${neMatch[1]}": {"$ne": "${neMatch[2]}"}}`, error: null };
	}

	// In array: "status in [active, pending]" or "status is active or pending"
	const inMatch = input.match(/(\w+)\s+(?:in|is)\s+\[?["']?(\w+)["']?(?:\s*,\s*|\s+or\s+)["']?(\w+)["']?\]?/i);
	if (inMatch) {
		return { query: `{"${inMatch[1]}": {"$in": ["${inMatch[2]}", "${inMatch[3]}"]}}`, error: null };
	}

	// Simple has X (for fields)
	const hasMatch = input.match(/(?:has|have)\s+(?:a\s+)?["']?(\w+)["']?/i);
	if (hasMatch && !["field", "this", "the", "it", "a", "an", "collection"].includes(hasMatch[1].toLowerCase())) {
		return { query: `{"${hasMatch[1]}": {"$exists": true}}`, error: null };
	}

	// Not found
	return {
		query: null,
		error: `Could not understand: "${prompt}". Try: "field X exists", "status is active", "name contains john", "last 7 days", "downloads > 1000"`,
	};
}
