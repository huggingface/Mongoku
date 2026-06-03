/**
 * Tabs shown for a collection (Documents / Indexes / Sharding / …).
 *
 * `key` is the route segment under `.../collections/<collection>/<key>`.
 * Exposed via the collection `+layout.ts` load so every child page inherits it
 * through `page.data.categories` (consumed by PageSwitcher.svelte).
 */
export interface CollectionCategory {
	key: string;
	label: string;
}

export const COLLECTION_CATEGORIES: CollectionCategory[] = [
	{ key: "documents", label: "Documents" },
	{ key: "indexes", label: "Indexes" },
	{ key: "sharding", label: "Sharding" },
	{ key: "mappings", label: "Mappings" },
	{ key: "schema", label: "Schema" },
];
