import { resolve as resolvePath } from "$app/paths";
import { contextStore } from "$lib/server/contextStore";
import { logger } from "$lib/server/logger";
import { getOAuthConfig, verifySession } from "$lib/server/oauth";
import type { Handle, HandleServerError } from "@sveltejs/kit";
import { MongoError } from "mongodb";

Error.stackTraceLimit = 100;

export const handle: Handle = async ({ event, resolve }) => {
	const oauthConfig = await getOAuthConfig();
	const authBasic = process.env.MONGOKU_AUTH_BASIC;

	event.locals.requestId = event.request.headers.get("X-Request-ID") || crypto.randomUUID();

	event.setHeaders({
		"X-Request-ID": event.locals.requestId,
	});

	return contextStore.run(event, async () => {
		const startTime = performance.now();

		if (oauthConfig) {
			const isAuthRoute = event.url.pathname.startsWith(resolvePath("/auth/" as unknown as "/auth/login"));

			if (!isAuthRoute) {
				const sessionCookie = event.cookies.get("mongoku_session");
				const session = sessionCookie ? verifySession(oauthConfig, sessionCookie) : null;

				if (!session) {
					const acceptsHtml = event.request.headers.get("accept")?.includes("text/html");
					logger.logRequest(acceptsHtml ? 302 : 401, performance.now() - startTime);

					if (acceptsHtml) {
						return new Response(null, {
							status: 302,
							headers: { Location: resolvePath("/auth/login") },
						});
					}

					return new Response(JSON.stringify({ message: "Session expired" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					});
				}

				event.locals.user = { sub: session.sub, name: session.name, email: session.email };
			}
		} else if (authBasic) {
			const [username, password] = authBasic.split(":");
			const basicAuth = event.request.headers.get("Authorization");
			if (
				!basicAuth?.toLowerCase().startsWith("basic ") ||
				basicAuth.slice("basic ".length) !== Buffer.from(`${username}:${password}`).toString("base64")
			) {
				logger.logRequest(401, performance.now() - startTime);

				return new Response("Unauthorized", {
					status: 401,
					headers: { "WWW-Authenticate": "Basic" },
				});
			}
		}

		const response = await resolve(event);

		logger.logRequest(response.status, performance.now() - startTime);

		return response;
	});
};

export const handleError: HandleServerError = ({ error }) => {
	logger.error(error);

	if (error instanceof MongoError) {
		return {
			message: error.message,
			code: error.code,
		};
	}

	if (error instanceof Error) {
		return {
			message: error.message,
		};
	}

	return {
		message: "An unexpected error occurred",
	};
};
