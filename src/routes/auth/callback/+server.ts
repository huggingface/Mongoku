import { base } from "$app/paths";
import {
	checkRequiredClaim,
	cookieOptions,
	createSessionCookie,
	exchangeCode,
	extractUserFromIdToken,
	getCallbackUrl,
	getOAuthConfig,
} from "$lib/server/oauth";
import { error, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url, cookies }) => {
	const config = await getOAuthConfig();
	if (!config) {
		redirect(302, `${base}/`);
	}

	const oauthError = url.searchParams.get("error");
	if (oauthError) {
		error(403, url.searchParams.get("error_description") || oauthError);
	}

	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	if (!code || !state) {
		error(400, "Missing code or state parameter");
	}

	const storedState = cookies.get("mongoku_pkce_state");
	const storedVerifier = cookies.get("mongoku_pkce_verifier");
	if (!storedState || !storedVerifier) {
		error(400, "Missing OAuth cookies — please try logging in again");
	}

	if (state !== storedState) {
		error(403, "Invalid OAuth state");
	}

	cookies.delete("mongoku_pkce_state", cookieOptions(url));
	cookies.delete("mongoku_pkce_verifier", cookieOptions(url));

	const tokens = await exchangeCode(config, url.origin, code, storedVerifier, getCallbackUrl(url.origin));

	let user: { sub?: string; name?: string; email?: string } = {};
	let claims: Record<string, unknown> = {};
	if (tokens.id_token) {
		({ user, claims } = extractUserFromIdToken(tokens.id_token));
	}

	if (config.allowedSubs && (!user.sub || !config.allowedSubs.has(user.sub))) {
		error(403, "Your account is not authorized to access this application");
	}

	if (config.requiredClaim && !checkRequiredClaim(claims, config.requiredClaim)) {
		error(403, `Required claim not satisfied: ${config.requiredClaim.field}=${config.requiredClaim.value}`);
	}

	cookies.set("mongoku_session", createSessionCookie(config, user), cookieOptions(url, config.sessionDuration));

	redirect(302, `${base}/`);
};
