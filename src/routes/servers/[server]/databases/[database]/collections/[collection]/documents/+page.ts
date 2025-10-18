export const load = async (data) => {
	return {
		...data.data,
		categories: [
			{ key: "documents", label: "Documents" },
			{ key: "indexes", label: "Indexes" },
		],
	};
};
