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
	/**
	 * Primary tabs (Documents / Indexes) are shown at full weight; secondary
	 * tabs are visually de-emphasized and rendered after a divider. Defaults to
	 * secondary when omitted.
	 */
	primary?: boolean;
}

export const COLLECTION_CATEGORIES: CollectionCategory[] = [
	{ key: "documents", label: "Documents", primary: true },
	{ key: "indexes", label: "Indexes", primary: true },
	{ key: "sharding", label: "Sharding" },
	{ key: "mappings", label: "Mappings" },
	{ key: "schema", label: "Schema" },
];
