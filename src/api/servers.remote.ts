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

// Count documents matching a filter
export const countDocuments = query(
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

// Load documents from a collection
export const loadDocuments = query(
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
export const fetchMappedDocument = query(
	z.object({
		server: z.string(),
		database: z.string(),
		mappings: z.array(
			z.object({
				collection: z.string(),
				on: z.string(),
			}),
		),
		value: z.unknown(),
	}),
	async ({ server, database, mappings, value }) => {
		const mongo = await getMongo();
		const client = mongo.getClient(server);
		const decodedValue = JsonEncoder.decode(value);

		// Try each mapping in order and return the first match
		for (const mapping of mappings) {
			try {
				const coll = client.db(database).collection(mapping.collection);
				const query = { [mapping.on]: decodedValue };

				const document = await coll.findOne(query, { maxTimeMS: mongo.getQueryTimeout() });

				if (document) {
					return {
						data: JsonEncoder.encode(document),
						collection: mapping.collection,
						error: null,
					};
				}
			} catch (err) {
				logger.error(`Error fetching mapped document from ${mapping.collection}.${mapping.on}:`, err);
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
