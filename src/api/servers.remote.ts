import { command, query } from "$app/server";
import { validateAggregationPipeline } from "$lib/server/aggregation";
import JsonEncoder from "$lib/server/JsonEncoder";
import { getMongo } from "$lib/server/mongo";
import { isEmptyObject } from "$lib/utils/isEmptyObject";
import { parseJSON } from "$lib/utils/jsonParser";
import { error } from "@sveltejs/kit";
import { ObjectId, type Document } from "mongodb";
import { z } from "zod";

// Check if read-only mode is enabled
function checkReadOnly() {
	if (process.env.MONGOKU_READ_ONLY_MODE === "true") {
		error(403, "Read-only mode is enabled");
	}
}

// Add a new server
export const addServer = command(
	z.object({
		url: z.string(),
	}),
	async ({ url }) => {
		const mongo = await getMongo();
		await mongo.addServer(url);
		return { ok: true };
	},
);

// Remove a server
export const removeServer = command(z.string(), async (serverName) => {
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
	}),
	async ({ server, database, collection, document, value, partial }) => {
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
			);
		} else {
			await coll.replaceOne(
				{
					_id: _id as unknown as ObjectId,
				},
				JsonEncoder.decode(newValue),
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

// Delete a document
export const deleteDocument = command(
	z.object({
		server: z.string(),
		database: z.string(),
		collection: z.string(),
		document: z.string(),
	}),
	async ({ server, database, collection, document }) => {
		checkReadOnly();

		const mongo = await getMongo();
		const client = mongo.getClient(server);

		await client
			.db(database)
			.collection(collection)
			.deleteOne({
				_id: new ObjectId(document),
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

// Hide an index
export const hideIndex = command(
	z.object({
		server: z.string(),
		database: z.string(),
		collection: z.string(),
		index: z.string(),
	}),
	async ({ server, database, collection, index }) => {
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

// Drop an index
export const dropIndex = command(
	z.object({
		server: z.string(),
		database: z.string(),
		collection: z.string(),
		index: z.string(),
	}),
	async ({ server, database, collection, index }) => {
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

// Retry connection to a server
export const retryConnection = command(z.string(), async (serverName) => {
	const mongo = await getMongo();

	// Reconnect the client (closes old connection and creates a new one)
	await mongo.reconnectClient(serverName);

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
	}),
	async ({ server, database, collection, query: queryStr, sort, project, skip, limit }) => {
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

		if (Array.isArray(queryDoc)) {
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
				};
			} catch (err) {
				console.error("Error executing aggregation:", err);
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
			};
		} catch (err) {
			console.error("Error fetching query results:", err);
			error(500, `Failed to fetch query results: ${err instanceof Error ? err.message : String(err)}`);
		}
	},
);
