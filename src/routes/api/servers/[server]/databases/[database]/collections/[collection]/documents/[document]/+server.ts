import { getMongo } from "$lib/server/mongo";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
	const mongo = await getMongo();
	const doc = await mongo.findOne(params.server, params.database, params.collection, params.document);

	if (!doc) {
		return error(404, "This document does not exist");
	}

	return json({
		ok: true,
		document: doc,
	});
};

export const POST: RequestHandler = async ({ params, request, url }) => {
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
	const mongo = await getMongo();
	await mongo.removeOne(params.server, params.database, params.collection, params.document);

	return json({
		ok: true,
	});
};
