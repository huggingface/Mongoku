import { getCollectionJson, getMongo } from "$lib/server/mongo";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
	const mongo = await getMongo();
	const client = mongo.getClient(params.server);
	const db = client.db(params.database);
	const collections = (await db.listCollections().toArray()).sort((a, b) => a.name.localeCompare(b.name));

	// Load all mappings for the database
	const allMappings = await mongo.getAllMappings(params.server, params.database);

	const collectionsWithDetails = collections.map((c) => ({
		name: c.name,
		type: c.type,
		details: getCollectionJson(db.collection(c.name), c.type).catch(() => null),
		hasMapping: allMappings.has(c.name),
	}));

	return {
		server: params.server,
		database: params.database,
		collections: collectionsWithDetails,
	};
};
