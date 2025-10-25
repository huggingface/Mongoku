import type { Handle, HandleServerError } from "@sveltejs/kit";
import { MongoError } from "mongodb";

// Bigger than the default 10, helpful with MongoDB errors
Error.stackTraceLimit = 100;

export const handle: Handle = async ({ event, resolve }) => {
	const authBasic = process.env.MONGOKU_AUTH_BASIC;
	if (authBasic) {
		const [username, password] = authBasic.split(":");
		const basicAuth = event.request.headers.get("Authorization");
		if (basicAuth !== `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`) {
			return new Response("Unauthorized", {
				status: 401,
				headers: {
					"WWW-Authenticate": "Basic",
				},
			});
		}
	}
	return resolve(event);
};

export const handleError: HandleServerError = ({ error }) => {
	// Log the error server-side
	console.error(error);

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
