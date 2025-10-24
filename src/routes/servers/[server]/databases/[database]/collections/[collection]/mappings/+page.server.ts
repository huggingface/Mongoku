import { getMongo } from "$lib/server/mongo";
import type { CollectionMappings } from "$lib/types";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
	const mongo = await getMongo();
	const client = mongo.getClient(params.server);
	const db = client.db(params.database);

	const mappings = await db.collection<CollectionMappings>("mongoku.mappings").findOne({ _id: params.collection });

	// Get list of all collections in the database for the dropdown
	const allCollections = (await db.listCollections().toArray()).map((c) => c.name).sort();

	return {
		mappings: mappings?.mappings ?? {},
		availableCollections: allCollections,
	};
};
