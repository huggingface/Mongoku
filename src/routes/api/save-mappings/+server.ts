import { getMongo } from "$lib/server/mongo";
import type { MappingTarget } from "$lib/types";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
	// Check if read-only mode is enabled
	if (process.env.MONGOKU_READ_ONLY_MODE === "true") {
		return error(403, "Read-only mode is enabled");
	}

	const { server, database, collection, mappings } = await request.json();

	if (!server || !database || !collection) {
		return error(400, "Missing required parameters");
	}

	try {
		const mongo = await getMongo();
		const db = mongo.getClient(server).db(database);
		const mappingsCollection = db.collection("mongoku.mappings");

		// Upsert the mappings document
		await mappingsCollection.replaceOne(
			{ _id: collection },
			{
				_id: collection,
				mappings: mappings as Record<string, MappingTarget | MappingTarget[]>,
			},
			{ upsert: true },
		);

		// Refresh mappings in memory
		await mongo.refreshMappings(server, database);

		return json({ ok: true });
	} catch (err) {
		console.error("Error saving mappings:", err);
		return error(500, `Failed to save mappings: ${err instanceof Error ? err.message : String(err)}`);
	}
};
