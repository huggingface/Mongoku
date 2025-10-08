import type { ServerError } from "$lib/server/MongoManager";
import type { ServerJSON } from "$lib/server/Server";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch }) => {
	const response = await fetch("/api/servers");
	const servers: (ServerJSON | ServerError)[] = await response.json();

	return {
		servers,
	};
};
