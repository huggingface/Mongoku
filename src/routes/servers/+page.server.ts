import { getMongo } from "$lib/server/mongo";
import type { DatabaseStats } from "$lib/types";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	const mongo = await getMongo();

	const servers = mongo.listClients().map(({ name, _id, client }) => ({
		name,
		_id,
		details: (async () => {
			try {
				const adminDb = client.db("test").admin();
				const results = await adminDb.listDatabases();
				const collectionsCount = await Promise.all(
					results.databases.map(async (d) => {
						const db = client.db(d.name);
						const dbStats = (await db.stats()) as DatabaseStats;
						return dbStats.collections;
					}),
				);

				return {
					databases: results.databases.map((d, index) => ({
						name: d.name,
						size: d.sizeOnDisk ?? 0,
						collections: collectionsCount[index],
					})),
					size: results.totalSize ?? 0,
				};
			} catch (err) {
				return {
					error: {
						code: err instanceof Error && "code" in err ? err.code : undefined,
						name: err instanceof Error ? err.name : "Error",
						message: err instanceof Error ? err.message : String(err),
					},
				};
			}
		})().catch((err) => ({
			error: {
				code: err instanceof Error && "code" in err ? err.code : undefined,
				name: err instanceof Error ? err.name : "Error",
				message: err instanceof Error ? err.message : String(err),
			},
		})),
	}));

	servers.sort((a, b) => a.name.localeCompare(b.name));
	return {
		servers,
	};
};
