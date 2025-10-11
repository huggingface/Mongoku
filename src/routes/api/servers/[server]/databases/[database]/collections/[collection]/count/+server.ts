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
	const count = await mongo.count(params.server, params.database, params.collection, queryDoc);

	if (count === null) {
		return error(404, `Collection not found: ${params.server}.${params.database}.${params.collection}`);
	}

	return json({
		ok: true,
		count,
	});
};
