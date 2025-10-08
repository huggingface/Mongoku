import { getFactory } from "$lib/server/factoryInstance";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
	const factory = await getFactory();
	const databases = await factory.mongoManager.getDatabasesJson(params.server);
	return json(databases);
};
