import { getMongo } from "$lib/server/mongo";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
	const mongo = await getMongo();
	const servers = await mongo.getServersJson();
	return json(servers);
};

export const PUT: RequestHandler = async ({ request }) => {
	if (process.env.MONGOKU_READ_ONLY_MODE === "true") {
		return error(403, "Read-only mode is enabled");
	}

	const body = await request.json();
	const mongo = await getMongo();
	await mongo.addServer(body.url);
	return json({ ok: true });
};
