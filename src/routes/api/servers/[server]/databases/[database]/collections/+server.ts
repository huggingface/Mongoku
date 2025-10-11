import { getMongo } from "$lib/server/mongo";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
	const mongo = await getMongo();
	const collections = await mongo.getCollectionsJson(params.server, params.database);
	return json(collections);
};
