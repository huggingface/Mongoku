import { getFactory } from "$lib/server/factoryInstance";
import type { Handle } from "@sveltejs/kit";

// Bigger than the default 10, helpful with MongoDB errors
Error.stackTraceLimit = 100;

// Initialize the factory on server startup
let initialized = false;

let initPromise: Promise<void> | null = null;

export const handle: Handle = async ({ event, resolve }) => {
	if (!initialized) {
		try {
			initPromise ??= getFactory()?.then(() => void 0);
			await initPromise;
			initialized = true;
			console.log("[Mongoku] Backend initialized");
		} catch (err) {
			console.error("[Mongoku] Failed to initialize:", err);
			initPromise = Promise.reject(err);
		}
	}

	return resolve(event);
};
