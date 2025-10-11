import { getMongo } from "$lib/server/mongo";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
	const mongo = await getMongo();
	const document = await mongo.findOne(params.server, params.database, params.collection, params.document);

	return {
		server: params.server,
		database: params.database,
		collection: params.collection,
		documentId: params.document,
		document,
	};
};
