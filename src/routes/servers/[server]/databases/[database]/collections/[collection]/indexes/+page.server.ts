import JsonEncoder from "$lib/server/JsonEncoder";
import { logger } from "$lib/server/logger";
import { getMongo, type IndexKey } from "$lib/server/mongo";
import type { IndexDescription } from "mongodb";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, depends }) => {
	depends("app:indexes");

	const mongo = await getMongo();
	const client = mongo.getClient(params.server);
	const collection = client.db(params.database).collection(params.collection);

	const indexesPromise = (async () => {
		try {
			// Get index definitions
			const indexList = (await collection.listIndexes().toArray()) as IndexDescription[];

			// Update index cache
			client.setIndexes(
				params.database,
				params.collection,
				indexList.map((index) => ({ name: index.name!, key: index.key as IndexKey })),
			);

			// Get index usage statistics
			let indexStats: Record<string, { ops: number; since: Date; building: boolean }> = {};
			try {
				const statsResult = await collection.aggregate([{ $indexStats: {} }]).toArray();

				indexStats = Object.fromEntries(
					statsResult.map((stat) => [
						stat.name,
						{
							ops: stat.accesses?.ops || 0,
							since: stat.accesses?.since || new Date(),
							building: stat.building || false,
						},
					]),
				);
			} catch (err) {
				logger.error("Error fetching index stats:", err);
				// Continue without stats if unavailable
			}

			// Get index sizes from collection stats
			let indexSizes: Record<string, number> = {};
			try {
				const collStatsResult = (await collection
					.aggregate([
						{
							$collStats: {
								storageStats: {},
							},
						},
					])
					.next()) as {
					storageStats?: {
						indexSizes?: Record<string, number>;
					};
				} | null;

				if (collStatsResult?.storageStats?.indexSizes) {
					indexSizes = collStatsResult.storageStats.indexSizes;
				}
			} catch (err) {
				logger.error("Error fetching index sizes:", err);
				// Continue without sizes if unavailable
			}

			// Merge index definitions with stats and sizes
			const indexesWithStats = indexList.map((index) => ({
				...index,
				stats: index.name ? indexStats[index.name] || null : null,
				size: index.name ? indexSizes[index.name] || 0 : 0,
			}));

			// Encode to handle MongoDB types like ObjectId, etc.
			return {
				data: indexesWithStats.map((index) => JsonEncoder.encode(index)),
				error: null as string | null,
			};
		} catch (err) {
			logger.error("Error fetching indexes:", err);
			return {
				data: [],
				error: `Failed to fetch indexes: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	})();

	return {
		indexes: indexesPromise,
	};
};
