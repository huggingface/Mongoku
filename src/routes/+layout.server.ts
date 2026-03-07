import { env } from "$env/dynamic/private";
import { getOAuthConfig } from "$lib/server/oauth";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async (event) => {
	return {
		readOnly: env.MONGOKU_READ_ONLY_MODE === "true",
		serverOrigin: event.url.origin,
		oauthEnabled: !!(await getOAuthConfig()),
		user: event.locals.user,
	};
};
