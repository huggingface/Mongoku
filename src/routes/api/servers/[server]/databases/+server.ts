import { getFactory } from "$lib/server/factoryInstance";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
	const factory = await getFactory();

	const server = factory.mongoManager.getServer(params.server);
	if (server instanceof Error) {
		return json([]);
	}

	return json(await server.toJson().then((result) => result.databases));
};
