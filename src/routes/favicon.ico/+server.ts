import type { RequestHandler } from "./$types";

// No official icon yet, avoid sveltekite errors
export const GET: RequestHandler = async () => {
	return new Response(null, {
		status: 404,
	});
};
