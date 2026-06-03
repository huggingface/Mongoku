import { COLLECTION_CATEGORIES } from "$lib/collectionCategories";

export const load = async (event) => {
	return {
		collection: event.params.collection,
		categories: COLLECTION_CATEGORIES,
		breadcrumbs: [
			...(await event.parent()).breadcrumbs,
			{ label: event.params.collection, path: `/${event.params.collection}/documents` },
		],
	};
};
