import { command } from "$app/server";
import JsonEncoder from "$lib/server/JsonEncoder";
import { getMongo } from "$lib/server/mongo";
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
