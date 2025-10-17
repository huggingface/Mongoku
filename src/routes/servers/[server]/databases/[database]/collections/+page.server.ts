import { getCollectionJson, getMongo } from "$lib/server/mongo";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
	const mongo = await getMongo();
	const client = mongo.getClient(params.server);
	const db = client.db(params.database);
	const collections = (await db.listCollections().toArray()).sort((a, b) => a.name.localeCompare(b.name));

	const collectionsWithDetails = collections.map((c) => ({
		name: c.name,
		type: c.type,
		details: getCollectionJson(db.collection(c.name), c.type).catch(() => null),
	}));

	return {
		collections: collectionsWithDetails,
	};
};
