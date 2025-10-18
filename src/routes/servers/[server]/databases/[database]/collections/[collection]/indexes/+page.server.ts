import JsonEncoder from "$lib/server/JsonEncoder";
import { getMongo } from "$lib/server/mongo";
import { error } from "@sveltejs/kit";
import type { IndexDescription } from "mongodb";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, depends }) => {
	depends("app:indexes");

	const mongo = await getMongo();
	const collection = mongo.getCollection(params.server, params.database, params.collection);

	if (!collection) {
		return error(404, `Collection not found: ${params.server}.${params.database}.${params.collection}`);
	}

	const indexesPromise = (async () => {
		try {
			// Get index definitions
			const indexList = (await collection.listIndexes().toArray()) as IndexDescription[];

			// Get index usage statistics
			let indexStats: Record<string, { ops: number; since: Date }> = {};
			try {
				const statsResult = await collection.aggregate([{ $indexStats: {} }]).toArray();

				indexStats = statsResult.reduce(
					(acc, stat) => {
						acc[stat.name] = {
							ops: stat.accesses?.ops || 0,
							since: stat.accesses?.since || new Date(),
						};
						return acc;
					},
					{} as Record<string, { ops: number; since: Date }>,
				);
			} catch (err) {
				console.error("Error fetching index stats:", err);
				// Continue without stats if unavailable
			}

			// Merge index definitions with stats
			const indexesWithStats = indexList.map((index) => ({
				...index,
				stats: index.name ? indexStats[index.name] || null : null,
			}));

			// Encode to handle MongoDB types like ObjectId, etc.
			return {
				data: indexesWithStats.map((index) => JsonEncoder.encode(index)),
				error: null as string | null,
			};
		} catch (err) {
			console.error("Error fetching indexes:", err);
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
