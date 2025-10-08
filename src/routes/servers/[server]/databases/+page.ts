import type { DatabaseJSON } from "$lib/server/Database";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, fetch }) => {
	const response = await fetch(`/api/servers/${encodeURIComponent(params.server)}/databases`);
	const databases: DatabaseJSON[] = await response.json();

	return {
		server: params.server,
		databases,
	};
};
