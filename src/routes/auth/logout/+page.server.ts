import { base } from "$app/paths";
import { cookieOptions } from "$lib/server/oauth";
import { redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";

export const actions: Actions = {
	default: async ({ cookies, url }) => {
		cookies.delete("mongoku_session", cookieOptions(url));
		redirect(302, `${base}/auth/logout`);
	},
};
