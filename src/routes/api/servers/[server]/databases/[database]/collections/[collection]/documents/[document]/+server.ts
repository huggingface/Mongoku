import { getMongo } from "$lib/server/mongo";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, request, url }) => {
	if (process.env.MONGOKU_READ_ONLY_MODE === "true") {
		return error(403, "Read-only mode is enabled");
	}

	const mongo = await getMongo();
	const body = await request.json();
	const partial = url.searchParams.get("partial") === "true";

	const update = await mongo.updateOne(
		params.server,
		params.database,
		params.collection,
		params.document,
		body,
		partial,
	);

	if (!update) {
		return error(404, `Collection not found: ${params.server}.${params.database}.${params.collection}`);
	}

	return json({
		ok: true,
		update,
	});
};

export const DELETE: RequestHandler = async ({ params }) => {
	if (process.env.MONGOKU_READ_ONLY_MODE === "true") {
		return error(403, "Read-only mode is enabled");
	}

	const mongo = await getMongo();
	await mongo.removeOne(params.server, params.database, params.collection, params.document);

	return json({
		ok: true,
	});
};
