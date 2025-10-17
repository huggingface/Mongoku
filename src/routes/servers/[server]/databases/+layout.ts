export const load = (event) => {
	return {
		server: event.params.server,
		breadcrumbs: [
			{ label: event.params.server, path: `/servers/${encodeURIComponent(event.params.server)}/databases` },
		],
	};
};
