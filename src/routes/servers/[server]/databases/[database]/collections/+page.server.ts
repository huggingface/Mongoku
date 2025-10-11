import { getCollectionJson, getMongo } from "$lib/server/mongo";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
	const mongo = await getMongo();
	const client = mongo.getClient(params.server);

	if (client instanceof Error) {
		return {
			server: params.server,
			database: params.database,
			collections: [],
		};
	}

	const db = client.db(params.database);
	const collections = await db.listCollections().toArray();

	const collectionsWithDetails = collections.map((c) => ({
		name: c.name,
		type: c.type,
		details: getCollectionJson(db.collection(c.name), c.type).catch(() => null),
	}));

	return {
		server: params.server,
		database: params.database,
		collections: collectionsWithDetails,
	};
};
