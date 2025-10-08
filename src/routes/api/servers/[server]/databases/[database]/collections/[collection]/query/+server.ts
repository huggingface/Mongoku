import { getFactory } from "$lib/server/factoryInstance";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
	let query = url.searchParams.get("q") || "{}";
	let sort = url.searchParams.get("sort") || "{}";
	const project = url.searchParams.get("project") || "{}";
	const limit = parseInt(url.searchParams.get("limit") || "20", 10);
	const skip = parseInt(url.searchParams.get("skip") || "0", 10);

	// Parse JSON strings
	try {
		query = JSON.parse(query);
	} catch (err) {
		return error(400, `Invalid query: ${query} - ${err}`);
	}

	try {
		sort = JSON.parse(sort);
	} catch (err) {
		return error(400, `Invalid sort: ${sort} - ${err}`);
	}

	let projectDoc: Document;
	try {
		projectDoc = JSON.parse(project);
	} catch (err) {
		return error(400, `Invalid project: ${project} - ${err}`);
	}

	const factory = await getFactory();
	const c = await factory.mongoManager.getCollection(params.server, params.database, params.collection);

	if (!c) {
		return error(404, `Collection not found: ${params.server}.${params.database}.${params.collection}`);
	}

	const results = await c.find(query, projectDoc, sort, limit, skip);

	return json({
		ok: true,
		results,
	});
};
