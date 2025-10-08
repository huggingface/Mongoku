import { getFactory } from "$lib/server/factoryInstance";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
	const factory = await getFactory();
	const c = await factory.mongoManager.getCollection(params.server, params.database, params.collection);

	if (!c) {
		return error(404, `Collection not found: ${params.server}.${params.database}.${params.collection}`);
	}

	const doc = await c.findOne(params.document);
	if (!doc) {
		return error(404, "This document does not exist");
	}

	return json({
		ok: true,
		document: doc,
	});
};

export const POST: RequestHandler = async ({ params, request, url }) => {
	const factory = await getFactory();
	const c = await factory.mongoManager.getCollection(params.server, params.database, params.collection);

	if (!c) {
		return error(404, `Collection not found: ${params.server}.${params.database}.${params.collection}`);
	}

	const body = await request.json();
	const partial = url.searchParams.get("partial") === "true";

	const update = await c.updateOne(params.document, body, partial);

	return json({
		ok: true,
		update,
	});
};

export const DELETE: RequestHandler = async ({ params }) => {
	const factory = await getFactory();
	const c = await factory.mongoManager.getCollection(params.server, params.database, params.collection);

	if (!c) {
		return error(404, `Collection not found: ${params.server}.${params.database}.${params.collection}`);
	}

	await c.removeOne(params.document);

	return json({
		ok: true,
	});
};
