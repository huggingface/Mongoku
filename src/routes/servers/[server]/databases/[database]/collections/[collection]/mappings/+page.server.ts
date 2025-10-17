import { getMongo } from "$lib/server/mongo";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
	const mongo = await getMongo();
	const client = mongo.getClient(params.server);
	const db = client.db(params.database);

	// Check if collection exists
	const collections = await db.listCollections({ name: params.collection }).toArray();
	if (collections.length === 0) {
		return error(404, `Collection not found: ${params.collection}`);
	}

	// Load mappings for this collection
	const mappings = await mongo.getMappings(params.server, params.database, params.collection);

	// Get list of all collections in the database for the dropdown
	const allCollections = (await db.listCollections().toArray()).map((c) => c.name).sort();

	return {
		server: params.server,
		database: params.database,
		collection: params.collection,
		mappings: mappings || {},
		availableCollections: allCollections,
	};
};
