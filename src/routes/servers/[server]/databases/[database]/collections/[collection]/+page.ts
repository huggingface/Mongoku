import { notificationStore } from "$lib/stores/notifications.svelte";
import type { MongoDocument } from "$lib/types";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, url, fetch }) => {
	const query = url.searchParams.get("query") || "{}";
	const sort = url.searchParams.get("sort") || "{}";
	const project = url.searchParams.get("project") || "{}";
	const skip = parseInt(url.searchParams.get("skip") || "0", 10);
	const limit = parseInt(url.searchParams.get("limit") || "20", 10);

	// Fetch read-only status
	const readOnlyResponse = await fetch("/api/readonly");
	const readOnlyData = await readOnlyResponse.json();

	// Prepare query parameters
	const queryParams = new URLSearchParams();
	queryParams.set("q", query);
	queryParams.set("sort", sort);
	queryParams.set("project", project);
	queryParams.set("skip", String(skip));
	queryParams.set("limit", String(limit));

	const countParams = new URLSearchParams();
	countParams.set("q", query);

	// Fetch query results and count in parallel
	const [queryResponse, countResponse] = await Promise.all([
		fetch(
			`/api/servers/${encodeURIComponent(params.server)}/databases/${encodeURIComponent(params.database)}/collections/${encodeURIComponent(params.collection)}/query?${queryParams.toString()}`,
		),
		fetch(
			`/api/servers/${encodeURIComponent(params.server)}/databases/${encodeURIComponent(params.database)}/collections/${encodeURIComponent(params.collection)}/count?${countParams.toString()}`,
		),
	]);

	let results: MongoDocument[] = [];
	if (queryResponse.ok) {
		const data = await queryResponse.json();
		results = data.results || [];
	} else {
		notificationStore.notifyError("Failed to fetch query results", queryResponse);
	}

	let count = 0;
	if (countResponse.ok) {
		const data = await countResponse.json();
		count = data.count || 0;
	} else {
		notificationStore.notifyError("Failed to fetch count", countResponse);
	}

	return {
		server: params.server,
		database: params.database,
		collection: params.collection,
		readOnly: readOnlyData.readOnly || false,
		results,
		count,
		params: {
			query,
			sort,
			project,
			skip,
			limit,
		},
	};
};
