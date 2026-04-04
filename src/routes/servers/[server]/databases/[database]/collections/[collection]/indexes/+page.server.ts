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
			let indexStats: Record<string, { ops: number; since: Date }> = {};
			try {
				const statsResult = await collection.aggregate([{ $indexStats: {} }]).toArray();

				indexStats = Object.fromEntries(
					statsResult.map((stat) => [
						stat.name,
						{
							ops: stat.accesses?.ops || 0,
							since: stat.accesses?.since || new Date(),
						},
					]),
				);
			} catch (err) {
				logger.error("Error fetching index stats:", err);
			}

			// Detect in-progress index builds via currentOp
			const buildingIndexes: Record<string, { done: number; total: number; pct: number; key?: IndexKey }> = {};
			try {
				const currentOp = await client.db("admin").command({
					currentOp: true,
					"command.createIndexes": params.collection,
					$or: [{ "command.$db": params.database }, { ns: `${params.database}.${params.collection}` }],
				});

				for (const op of currentOp.inprog || []) {
					const indexes: Array<{ name?: string; key?: IndexKey }> = op.command?.indexes || [];
					const progress = op.progress as { done: number; total: number } | undefined;
					const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

					for (const idx of indexes) {
						if (idx.name) {
							buildingIndexes[idx.name] = {
								done: progress?.done ?? 0,
								total: progress?.total ?? 0,
								pct,
								key: idx.key,
							};
						}
					}
				}
			} catch (err) {
				logger.error("Error fetching currentOp for building indexes:", err);
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

			// Merge index definitions with stats, sizes, and building progress
			const indexesWithStats = indexList.map((index) => ({
				...index,
				stats: index.name ? indexStats[index.name] || null : null,
				size: index.name ? indexSizes[index.name] || 0 : 0,
				building: index.name ? buildingIndexes[index.name] || null : null,
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
