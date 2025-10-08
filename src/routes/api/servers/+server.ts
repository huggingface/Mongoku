import { getFactory } from "$lib/server/factoryInstance";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
	const factory = await getFactory();
	const servers = await factory.mongoManager.getServersJson();
	return json(servers);
};

export const PUT: RequestHandler = async ({ request }) => {
	if (process.env.MONGOKU_READ_ONLY_MODE === "true") {
		return error(403, "Read-only mode is enabled");
	}

	const body = await request.json();
	const factory = await getFactory();
	await factory.hostsManager.add(body.url);
	await factory.mongoManager.load();
	return json({ ok: true });
};
