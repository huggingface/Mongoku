import { getMongo } from "$lib/server/mongo";
import { parseJSON } from "$lib/utils/jsonParser";
import { error, json } from "@sveltejs/kit";
import type { Document } from "mongodb";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
	const query = url.searchParams.get("q") || "{}";
	const sort = url.searchParams.get("sort") || "{}";
	const project = url.searchParams.get("project") || "{}";
	const limit = parseInt(url.searchParams.get("limit") || "20", 10);
	const skip = parseInt(url.searchParams.get("skip") || "0", 10);

	// Parse JSON strings
	let queryDoc: unknown;
	try {
		queryDoc = parseJSON(query);
	} catch (err) {
		return error(400, `Invalid query: ${query} - ${err}`);
	}

	let sortDoc: unknown;
	try {
		sortDoc = parseJSON(sort);
	} catch (err) {
		return error(400, `Invalid sort: ${sort} - ${err}`);
	}

	let projectDoc: Document;
	try {
		projectDoc = parseJSON(project) as Document;
	} catch (err) {
		return error(400, `Invalid project: ${project} - ${err}`);
	}

	const mongo = await getMongo();
	const results = await mongo.find(
		params.server,
		params.database,
		params.collection,
		queryDoc,
		projectDoc,
		sortDoc,
		limit,
		skip,
	);

	if (!results) {
		return error(404, `Collection not found: ${params.server}.${params.database}.${params.collection}`);
	}

	return json({
		ok: true,
		results,
	});
};
