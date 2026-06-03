import { logger } from "$lib/server/logger";
import { getMongo } from "$lib/server/mongo";
import type { ShardingInfo } from "$lib/types";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, depends }) => {
	depends("app:sharding");

	const shardingPromise = (async (): Promise<{ data: ShardingInfo | null; error: string | null }> => {
		try {
			const mongo = await getMongo();
			const data = await mongo.getShardingInfo(params.server, params.database, params.collection);
			return { data, error: null };
		} catch (err) {
			logger.error("Error fetching sharding info:", err);
			return {
				data: null,
				error: `Failed to fetch sharding info: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	})();

	return {
		sharding: shardingPromise,
	};
};
