import { resolve } from "$app/paths";
import { cookieOptions } from "$lib/server/oauth";
import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ cookies, url }) => {
	cookies.delete("mongoku_session", cookieOptions(url));
	redirect(302, resolve("/auth/login"));
};
