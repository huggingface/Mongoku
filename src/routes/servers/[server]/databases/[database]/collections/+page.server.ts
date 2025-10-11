import { getMongo } from "$lib/server/mongo";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
	const mongo = await getMongo();
	const collections = await mongo.getCollectionsJson(params.server, params.database);

	return {
		server: params.server,
		database: params.database,
		collections,
	};
};
