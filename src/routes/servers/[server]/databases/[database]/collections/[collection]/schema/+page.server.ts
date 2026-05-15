import { getCollectionSchema } from "$lib/server/schema";
import { getMongo } from "$lib/server/mongo";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
	const mongo = await getMongo();
	const client = mongo.getClient(params.server);

	try {
		const schemaInfo = await getCollectionSchema(client, params.database, params.collection);

		return {
			schemaInfo,
		};
	} catch {
		return {
			schemaInfo: {
				hasSchema: false,
				validator: null,
				validationLevel: null,
				validationAction: null,
			},
		};
	}
};
