import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
	return json({
		ok: true,
		readOnly: process.env.MONGOKU_READ_ONLY_MODE === "true",
	});
};
