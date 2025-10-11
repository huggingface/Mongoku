import { getMongo } from "$lib/server/mongo";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
	const mongo = await getMongo();
	const databases = await mongo.getDatabasesJson(params.server);

	return {
		server: params.server,
		databases,
	};
};
