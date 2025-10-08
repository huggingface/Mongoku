import { getFactory } from "$lib/server/factoryInstance";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const DELETE: RequestHandler = async ({ params }) => {
	if (process.env.MONGOKU_READ_ONLY_MODE === "true") {
		return error(403, "Read-only mode is enabled");
	}

	const factory = await getFactory();
	await factory.hostsManager.remove(params.server);
	factory.mongoManager.removeServer(params.server);
	return json({ ok: true });
};
