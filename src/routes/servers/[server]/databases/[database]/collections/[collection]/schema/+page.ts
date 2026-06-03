export const load = async (data) => {
	return {
		...data.data,
		categories: [
			{ key: "documents", label: "Documents" },
			{ key: "indexes", label: "Indexes" },
			{ key: "sharding", label: "Sharding" },
			{ key: "mappings", label: "Mappings" },
			{ key: "schema", label: "Schema" },
		],
	};
};
