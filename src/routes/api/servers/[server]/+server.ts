import { getMongo } from "$lib/server/mongo";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const DELETE: RequestHandler = async ({ params }) => {
	if (process.env.MONGOKU_READ_ONLY_MODE === "true") {
		return error(403, "Read-only mode is enabled");
	}

	const mongo = await getMongo();
	await mongo.removeServer(params.server);
	return json({ ok: true });
};
