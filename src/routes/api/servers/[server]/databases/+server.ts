import { getMongo } from "$lib/server/mongo";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
	const mongo = await getMongo();
	const databases = await mongo.getDatabasesJson(params.server);
	return json(databases);
};
