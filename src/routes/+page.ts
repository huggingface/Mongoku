import type { ServerJSON } from "$lib/server/Server";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch }) => {
	const response = await fetch("/api/servers");
	const servers: ServerJSON[] = await response.json();

	return {
		servers,
	};
};
