import JsonEncoder from "$lib/server/JsonEncoder";
import { getMongo } from "$lib/server/mongo";
import { error, json } from "@sveltejs/kit";
import { ObjectId } from "mongodb";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, request, url }) => {
	if (process.env.MONGOKU_READ_ONLY_MODE === "true") {
		return error(403, "Read-only mode is enabled");
	}

	const mongo = await getMongo();
	const collection = mongo.getCollection(params.server, params.database, params.collection);

	if (!collection) {
		return error(404, `Collection not found: ${params.server}.${params.database}.${params.collection}`);
	}

	const body = await request.json();
	const partial = url.searchParams.get("partial") === "true";

	const newValue = JsonEncoder.decode(body);

	// TODO: For now it makes it impossible to remove fields from object with a projection
	const update = partial ? { $set: newValue } : JsonEncoder.decode(newValue);
	await collection.replaceOne(
		{
			_id: new ObjectId(params.document),
		},
		update,
	);

	return json({
		ok: true,
		update: JsonEncoder.encode(newValue),
	});
};

export const DELETE: RequestHandler = async ({ params }) => {
	if (process.env.MONGOKU_READ_ONLY_MODE === "true") {
		return error(403, "Read-only mode is enabled");
	}

	const mongo = await getMongo();
	const collection = mongo.getCollection(params.server, params.database, params.collection);

	if (!collection) {
		return error(404, `Collection not found: ${params.server}.${params.database}.${params.collection}`);
	}

	await collection.deleteOne({
		_id: new ObjectId(params.document),
	});

	return json({
		ok: true,
	});
};
