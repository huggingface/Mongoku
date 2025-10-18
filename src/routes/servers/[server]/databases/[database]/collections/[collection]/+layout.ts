export const load = async (event) => {
	return {
		collection: event.params.collection,
		breadcrumbs: [
			...(await event.parent()).breadcrumbs,
			{ label: event.params.collection, path: `/${event.params.collection}/documents` },
		],
	};
};
