import type { Handle } from "@sveltejs/kit";

// Bigger than the default 10, helpful with MongoDB errors
Error.stackTraceLimit = 100;

export const handle: Handle = async ({ event, resolve }) => {
	return resolve(event);
};
