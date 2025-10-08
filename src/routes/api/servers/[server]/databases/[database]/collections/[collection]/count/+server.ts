import { getFactory } from "$lib/server/factoryInstance";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
	let query = url.searchParams.get("q") || "{}";

	try {
		query = JSON.parse(query);
	} catch (err) {
		return error(400, `Invalid query: ${query} - ${err}`);
	}

	const factory = await getFactory();
	const c = await factory.mongoManager.getCollection(params.server, params.database, params.collection);

	if (!c) {
		return error(404, `Collection not found: ${params.server}.${params.database}.${params.collection}`);
	}

	const count = await c.count(query);

	return json({
		ok: true,
		count,
	});
};
