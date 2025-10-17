export const load = async (event) => {
	return {
		collection: event.params.collection,
		breadcrumbs: [
			...(await event.parent()).breadcrumbs,
			{ label: event.params.collection, path: `/${event.params.collection}/documents` },
		],
		categories: [
			{ key: "documents", label: "Documents" },
			{ key: "indexes", label: "Indexes" },
		],
	};
};
