export const load = async (event) => {
	return {
		database: event.params.database,
		breadcrumbs: [
			...(await event.parent()).breadcrumbs,
			{ label: event.params.database, path: `/${encodeURIComponent(event.params.database)}/collections` },
		],
	};
};
