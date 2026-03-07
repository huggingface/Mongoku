import { base } from "$app/paths";
import { env } from "$env/dynamic/private";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface OAuthConfig {
	clientId: string;
	issuerUrl: string;
	authorizationUrl: string;
	tokenUrl: string;
	scopes: string;
	sessionSecret: string;
	sessionDuration: number;
	allowedSubs?: Set<string>;
}

export interface SessionPayload {
	sub?: string;
	name?: string;
	email?: string;
	exp: number;
}

interface OpenIDConfiguration {
	authorization_endpoint: string;
	token_endpoint: string;
}

interface TokenResponse {
	access_token: string;
	token_type: string;
	expires_in?: number;
	id_token?: string;
	scope?: string;
}

const DEFAULT_SESSION_DURATION = 86400;
export const OAUTH_CIMD_CLIENT_ID = "__CIMD__";

let cachedConfig: OAuthConfig | null | undefined;

function parseSessionDuration(rawDuration: string | undefined): number {
	if (!rawDuration) {
		return DEFAULT_SESSION_DURATION;
	}

	const parsed = Number(rawDuration);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return DEFAULT_SESSION_DURATION;
	}

	return parsed;
}

async function fetchOpenIDConfiguration(issuerUrl: string): Promise<OpenIDConfiguration> {
	const wellKnown = issuerUrl.replace(/\/+$/, "") + "/.well-known/openid-configuration";
	const response = await fetch(wellKnown);

	if (!response.ok) {
		throw new Error(`Failed to fetch OpenID configuration from ${wellKnown} (${response.status})`);
	}

	const config = await response.json();

	if (!config.authorization_endpoint || !config.token_endpoint) {
		throw new Error(`OpenID configuration at ${wellKnown} is missing required endpoints`);
	}

	return config;
}

/**
 * Returns OAuth config from env vars, or null if not configured.
 * Fetches the OpenID discovery document on first call and caches the result.
 * Throws if partially configured (some required vars missing).
 */
export async function getOAuthConfig(): Promise<OAuthConfig | null> {
	if (cachedConfig !== undefined) {
		return cachedConfig;
	}

	const clientId = env.MONGOKU_OAUTH_CLIENT_ID;
	if (!clientId) {
		cachedConfig = null;
		return null;
	}

	const issuerUrl = env.MONGOKU_OAUTH_ISSUER_URL;
	const sessionSecret = env.MONGOKU_OAUTH_SESSION_SECRET;

	if (!issuerUrl || !sessionSecret) {
		throw new Error(
			"OAuth is partially configured. When MONGOKU_OAUTH_CLIENT_ID is set, " +
				"MONGOKU_OAUTH_ISSUER_URL and MONGOKU_OAUTH_SESSION_SECRET are also required.",
		);
	}

	const oidc = await fetchOpenIDConfiguration(issuerUrl);

	const allowedSubsRaw = env.MONGOKU_OAUTH_ALLOWED_SUBS;
	const allowedSubs = allowedSubsRaw
		? new Set(
				allowedSubsRaw
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean),
			)
		: undefined;

	cachedConfig = {
		clientId,
		issuerUrl,
		authorizationUrl: oidc.authorization_endpoint,
		tokenUrl: oidc.token_endpoint,
		scopes: env.MONGOKU_OAUTH_SCOPES ?? "openid profile email",
		sessionSecret,
		sessionDuration: parseSessionDuration(env.MONGOKU_OAUTH_SESSION_DURATION),
		allowedSubs,
	};

	return cachedConfig;
}

function resolveOAuthClientId(config: OAuthConfig, origin: string): string {
	if (config.clientId !== OAUTH_CIMD_CLIENT_ID) {
		return config.clientId;
	}

	return new URL(`${base}/.well-known/cimd.json`, origin).toString();
}

function base64url(buffer: Buffer): string {
	return buffer.toString("base64url");
}

export function generateCodeVerifier(): string {
	return base64url(randomBytes(64));
}

export function generateCodeChallenge(verifier: string): string {
	return base64url(createHash("sha256").update(verifier).digest());
}

export function generateState(): string {
	return base64url(randomBytes(32));
}

export function buildAuthorizationUrl(
	config: OAuthConfig,
	origin: string,
	callbackUrl: string,
	codeChallenge: string,
	state: string,
): string {
	const url = new URL(config.authorizationUrl);
	url.searchParams.set("client_id", resolveOAuthClientId(config, origin));
	url.searchParams.set("response_type", "code");
	url.searchParams.set("redirect_uri", callbackUrl);
	url.searchParams.set("scope", config.scopes);
	url.searchParams.set("state", state);
	url.searchParams.set("code_challenge", codeChallenge);
	url.searchParams.set("code_challenge_method", "S256");
	return url.toString();
}

export async function exchangeCode(
	config: OAuthConfig,
	origin: string,
	code: string,
	codeVerifier: string,
	callbackUrl: string,
): Promise<TokenResponse> {
	const body = new URLSearchParams({
		grant_type: "authorization_code",
		code,
		redirect_uri: callbackUrl,
		client_id: resolveOAuthClientId(config, origin),
		code_verifier: codeVerifier,
	});

	const response = await fetch(config.tokenUrl, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: body.toString(),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Token exchange failed (${response.status}): ${text}`);
	}

	return response.json();
}

/**
 * Extract user info from an OIDC id_token (JWT) without cryptographic verification.
 * This is safe because the token was obtained directly from the token endpoint over HTTPS.
 */
export function extractUserFromIdToken(idToken: string): { sub?: string; name?: string; email?: string } {
	try {
		const parts = idToken.split(".");
		if (parts.length !== 3) {
			return {};
		}
		const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
		return {
			sub: payload.sub,
			name: payload.name || payload.preferred_username,
			email: payload.email,
		};
	} catch {
		return {};
	}
}

export function createSessionCookie(
	config: OAuthConfig,
	user: { sub?: string; name?: string; email?: string },
): string {
	const sessionDuration =
		Number.isInteger(config.sessionDuration) && config.sessionDuration > 0
			? config.sessionDuration
			: DEFAULT_SESSION_DURATION;

	const payload: SessionPayload = {
		...user,
		exp: Math.floor(Date.now() / 1000) + sessionDuration,
	};
	const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
	const signature = createHmac("sha256", config.sessionSecret).update(payloadStr).digest("base64url");
	return `${payloadStr}.${signature}`;
}

export function verifySession(config: OAuthConfig, cookie: string): SessionPayload | null {
	const dotIndex = cookie.lastIndexOf(".");
	if (dotIndex === -1) {
		return null;
	}

	const payloadStr = cookie.slice(0, dotIndex);
	const signature = cookie.slice(dotIndex + 1);

	const expectedSignature = createHmac("sha256", config.sessionSecret).update(payloadStr).digest("base64url");

	const a = Buffer.from(signature);
	const b = Buffer.from(expectedSignature);
	if (a.length !== b.length || !timingSafeEqual(a, b)) {
		return null;
	}

	try {
		const payload: SessionPayload = JSON.parse(Buffer.from(payloadStr, "base64url").toString());
		if (!Number.isFinite(payload.exp)) {
			return null;
		}
		if (payload.exp < Math.floor(Date.now() / 1000)) {
			return null;
		}
		return payload;
	} catch {
		return null;
	}
}

export function getCallbackUrl(origin: string): string {
	return `${origin}${base}/auth/callback`;
}

export function cookieOptions(url: URL, maxAge?: number) {
	return {
		httpOnly: true,
		secure: url.protocol === "https:",
		sameSite: "lax" as const,
		path: base || "/",
		...(maxAge !== undefined && { maxAge }),
	};
}
