export const load = async (event) => {
	return {
		document: event.params.document,
		breadcrumbs: [
			...(await event.parent()).breadcrumbs,
			{ label: event.params.document, path: `/documents/${event.params.document}` },
		],
	};
};
