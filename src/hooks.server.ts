import { contextStore } from "$lib/server/contextStore";
import { logger } from "$lib/server/logger";
import type { Handle, HandleServerError } from "@sveltejs/kit";
import { MongoError } from "mongodb";

// Bigger than the default 10, helpful with MongoDB errors
Error.stackTraceLimit = 100;

export const handle: Handle = async ({ event, resolve }) => {
	const authBasic = process.env.MONGOKU_AUTH_BASIC;
	event.locals.requestId = event.request.headers.get("X-Request-ID") || crypto.randomUUID();

	event.setHeaders({
		"X-Request-ID": event.locals.requestId,
	});

	return contextStore.run(event, async () => {
		const startTime = performance.now();

		if (authBasic) {
			const [username, password] = authBasic.split(":");
			const basicAuth = event.request.headers.get("Authorization");
			if (
				!basicAuth?.toLowerCase().startsWith("basic ") ||
				basicAuth.slice("basic ".length) !== Buffer.from(`${username}:${password}`).toString("base64")
			) {
				const response = new Response("Unauthorized", {
					status: 401,
					headers: {
						"WWW-Authenticate": "Basic",
					},
				});

				// Log unauthorized request
				logger.logRequest(401, performance.now() - startTime);

				return response;
			}
		}

		const response = await resolve(event);

		// Log successful request
		logger.logRequest(response.status, performance.now() - startTime);

		return response;
	});
};

export const handleError: HandleServerError = ({ error }) => {
	// Log the error server-side
	logger.error(error);

	// Handle MongoDB errors specifically
	if (error instanceof MongoError) {
		return {
			message: error.message,
			code: error.code,
		};
	}

	// Handle standard errors
	if (error instanceof Error) {
		return {
			message: error.message,
		};
	}

	// Fallback for unknown error types
	return {
		message: "An unexpected error occurred",
	};
};
