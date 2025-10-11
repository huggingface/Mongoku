import JsonEncoder from "$lib/server/JsonEncoder";
import { getMongo } from "$lib/server/mongo";
import { parseJSON } from "$lib/utils/jsonParser";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
	const query = url.searchParams.get("q") || "{}";

	let queryDoc: unknown;
	try {
		queryDoc = parseJSON(query);
	} catch (err) {
		return error(400, `Invalid query: ${query} - ${err}`);
	}

	const mongo = await getMongo();
	const collection = mongo.getCollection(params.server, params.database, params.collection);

	if (!collection) {
		return error(404, `Collection not found: ${params.server}.${params.database}.${params.collection}`);
	}

	let count: number;
	if (queryDoc && Object.keys(queryDoc).length > 0) {
		try {
			count = await collection.countDocuments(JsonEncoder.decode(queryDoc), {
				maxTimeMS: mongo.getCountTimeout(),
			});
		} catch {
			return error(500, "Failed to count documents");
		}
	} else {
		// fast count
		count = await collection.estimatedDocumentCount();
	}

	return json({
		ok: true,
		count,
	});
};
