export type ShardKey = Record<string, 1 | -1 | string>;

/**
 * Render a shard key into a compact human-readable string.
 * e.g. { userId: 1, _id: "hashed" } -> "userId: ↑, _id: hashed"
 */
export function formatShardKey(key: ShardKey): string {
	return Object.entries(key)
		.map(([field, dir]) => {
			if (dir === "hashed") {
				return `${field}: hashed`;
			}
			return `${field}: ${dir === 1 ? "↑" : dir === -1 ? "↓" : dir}`;
		})
		.join(", ");
}
