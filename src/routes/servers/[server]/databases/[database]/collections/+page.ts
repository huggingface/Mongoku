import type { CollectionJSON } from "$lib/server/mongo";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, fetch }) => {
	const response = await fetch(
		`/api/servers/${encodeURIComponent(params.server)}/databases/${encodeURIComponent(params.database)}/collections`,
	);
	const collections: CollectionJSON[] = await response.json();

	return {
		server: params.server,
		database: params.database,
		collections,
	};
};
