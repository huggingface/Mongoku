import { base } from "$app/paths";
import {
	OAUTH_RETURN_COOKIE,
	buildAuthorizationUrl,
	cookieOptions,
	generateCodeChallenge,
	generateCodeVerifier,
	generateState,
	getCallbackUrl,
	getOAuthConfig,
	sanitizeOAuthReturnPath,
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

	const returnParam = url.searchParams.get("return");
	const sanitizedReturn = sanitizeOAuthReturnPath(url, returnParam);
	if (sanitizedReturn) {
		cookies.set(OAUTH_RETURN_COOKIE, sanitizedReturn, cookieOptions(url, 300));
	} else {
		cookies.delete(OAUTH_RETURN_COOKIE, cookieOptions(url));
	}

	redirect(302, buildAuthorizationUrl(config, url.origin, callbackUrl, codeChallenge, state));
};
