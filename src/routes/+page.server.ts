import { getMongo } from "$lib/server/mongo";
import type { DatabaseStats } from "$lib/types";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	const mongo = await getMongo();

	const servers: Array<
		| { name: string; databases: Array<{ name: string; size: number }>; size: number }
		| { name: string; error: { code?: number | string; name: string; message: string } }
	> = [];
	for (const { name, client } of mongo.listClients()) {
		if (client instanceof Error) {
			servers.push({
				name: name,
				error: {
					code: client.code,
					name: client.name,
					message: client.message,
				},
			});
		} else {
			const adminDb = client.db("test").admin();
			const results = await adminDb.listDatabases();
			const collectionsCount = await Promise.all(
				results.databases.map(async (d) => {
					const db = client.db(d.name);
					const dbStats = (await db.stats()) as DatabaseStats;

					return dbStats.collections;
				}),
			);
			servers.push({
				name: name,
				databases: results.databases.map((d, index) => ({
					name: d.name,
					size: d.sizeOnDisk ?? 0,
					collections: collectionsCount[index],
				})),
				size: results.totalSize ?? 0,
			});
		}
	}

	servers.sort((a, b) => a.name.localeCompare(b.name));
	return {
		servers,
	};
};
