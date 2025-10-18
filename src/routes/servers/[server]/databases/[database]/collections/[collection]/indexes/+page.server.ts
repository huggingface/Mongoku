import JsonEncoder from "$lib/server/JsonEncoder";
import { getMongo } from "$lib/server/mongo";
import { error } from "@sveltejs/kit";
import type { IndexDescription } from "mongodb";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
	const mongo = await getMongo();
	const collection = mongo.getCollection(params.server, params.database, params.collection);

	if (!collection) {
		return error(404, `Collection not found: ${params.server}.${params.database}.${params.collection}`);
	}

	const indexesPromise = (async () => {
		try {
			const indexList = (await collection.listIndexes().toArray()) as IndexDescription[];
			// Encode to handle MongoDB types like ObjectId, etc.
			return {
				data: indexList.map((index) => JsonEncoder.encode(index)),
				error: null as string | null,
			};
		} catch (err) {
			console.error("Error fetching indexes:", err);
			return {
				data: [],
				error: `Failed to fetch indexes: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	})();

	return {
		indexes: indexesPromise,
	};
};
