import { base } from "$app/paths";
import { OAUTH_CIMD_CLIENT_ID, getCallbackUrl, getOAuthConfig } from "$lib/server/oauth";
import type { RequestHandler } from "./$types";

/**
 * OAuth Client ID Metadata Document (CIMD):
 * https://datatracker.ietf.org/doc/draft-ietf-oauth-client-id-metadata-document/
 */
export const GET: RequestHandler = async ({ url }) => {
	const config = await getOAuthConfig();
	if (!config) {
		return new Response("OAuth is not configured", { status: 404 });
	}

	if (config.clientId !== OAUTH_CIMD_CLIENT_ID) {
		return new Response("CIMD is disabled", { status: 404 });
	}

	return new Response(
		JSON.stringify({
			client_id: new URL(url.pathname, url.origin).toString(),
			client_name: "Mongoku",
			client_uri: `${url.origin}${base}`,
			redirect_uris: [getCallbackUrl(url.origin)],
			token_endpoint_auth_method: "none",
			scope: config.scopes,
		}),
		{
			headers: {
				"Content-Type": "application/json",
			},
		},
	);
};
