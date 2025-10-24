import { getMongo } from "$lib/server/mongo";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
	const mongo = await getMongo();
	const client = mongo.getClient(params.server);
	const db = client.db(params.database);

	const mappings = await client.getMappings(params.database, params.collection, { forceRefresh: true });

	// Get list of all collections in the database for the dropdown
	const allCollections = (await db.listCollections().toArray()).map((c) => c.name).sort();

	return {
		mappings,
		availableCollections: allCollections,
	};
};
