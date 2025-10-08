import { getFactory } from "$lib/server/factoryInstance";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
	const factory = await getFactory();
	const collections = await factory.mongoManager.getCollectionsJson(params.server, params.database);
	return json(collections);
};
