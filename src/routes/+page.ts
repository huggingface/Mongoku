import type { ServerError, ServerJSON } from "$lib/server/mongo";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch }) => {
	const response = await fetch("/api/servers");
	const servers: (ServerJSON | ServerError)[] = await response.json();

	return {
		servers,
	};
};
