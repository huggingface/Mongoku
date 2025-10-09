import { getFactory } from "$lib/server/factoryInstance";
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

	const factory = await getFactory();
	const c = await factory.mongoManager.getCollection(params.server, params.database, params.collection);

	if (!c) {
		return error(404, `Collection not found: ${params.server}.${params.database}.${params.collection}`);
	}

	const count = await c.count(queryDoc);

	return json({
		ok: true,
		count,
	});
};
