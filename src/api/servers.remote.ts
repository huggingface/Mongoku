import { command } from "$app/server";
import JsonEncoder from "$lib/server/JsonEncoder";
import { getMongo } from "$lib/server/mongo";
import { parseJSON } from "$lib/utils/jsonParser";
import { error } from "@sveltejs/kit";
import { ObjectId } from "mongodb";
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
		const coll = mongo.getCollection(server, database, collection);

		if (!coll) {
			error(404, `Collection not found: ${server}.${database}.${collection}`);
		}

		const newValue = JsonEncoder.decode(value);

		// TODO: For now it makes it impossible to remove fields from object with a projection
		const update = partial ? { $set: newValue } : JsonEncoder.decode(newValue);
		await coll.replaceOne(
			{
				_id: new ObjectId(document),
			},
			update,
		);

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
		const coll = mongo.getCollection(server, database, collection);

		if (!coll) {
			error(404, `Collection not found: ${server}.${database}.${collection}`);
		}

		await coll.deleteOne({
			_id: new ObjectId(document),
		});

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
		const coll = mongo.getCollection(server, database, collection);

		if (!coll) {
			error(404, `Collection not found: ${server}.${database}.${collection}`);
		}

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
		const coll = mongo.getCollection(server, database, collection);

		if (!coll) {
			error(404, `Collection not found: ${server}.${database}.${collection}`);
		}

		await coll.db.command({
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
		const coll = mongo.getCollection(server, database, collection);

		if (!coll) {
			error(404, `Collection not found: ${server}.${database}.${collection}`);
		}

		await coll.db.command({
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
		const coll = mongo.getCollection(server, database, collection);

		if (!coll) {
			error(404, `Collection not found: ${server}.${database}.${collection}`);
		}

		await coll.dropIndex(index);

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
