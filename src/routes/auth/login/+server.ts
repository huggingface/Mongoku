import { base } from "$app/paths";
import {
	buildAuthorizationUrl,
	cookieOptions,
	generateCodeChallenge,
	generateCodeVerifier,
	generateState,
	getCallbackUrl,
	getOAuthConfig,
} from "$lib/server/oauth";
import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url, cookies }) => {
	const config = await getOAuthConfig();
	if (!config) {
		redirect(302, `${base}/`);
	}

	const codeVerifier = generateCodeVerifier();
	const codeChallenge = generateCodeChallenge(codeVerifier);
	const state = generateState();
	const callbackUrl = getCallbackUrl(url.origin);

	cookies.set("mongoku_pkce_verifier", codeVerifier, cookieOptions(url, 300));
	cookies.set("mongoku_pkce_state", state, cookieOptions(url, 300));

	redirect(302, buildAuthorizationUrl(config, callbackUrl, codeChallenge, state));
};
