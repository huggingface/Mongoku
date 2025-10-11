import { getMongo } from "$lib/server/mongo";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	const mongo = await getMongo();
	const servers = await mongo.getServersJson();

	return {
		servers,
	};
};
