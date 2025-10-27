import { getCollectionJson, getMongo } from "$lib/server/mongo";
import type { CollectionJSON, DatabaseStats } from "$lib/types";
import { logger } from "$lib/utils/logger";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
	const mongo = await getMongo();
	const client = mongo.getClient(params.server);
	const adminDb = client.db("test").admin();
	const results = await adminDb.listDatabases();

	if (!Array.isArray(results.databases)) {
		return {
			databases: [],
		};
	}

	const filteredDatabases = mongo.filterDatabases(results.databases);

	const databases = await Promise.all(
		filteredDatabases.map(async (d) => {
			const db = client.db(d.name);
			const dbStats: Pick<DatabaseStats, "dataSize" | "avgObjSize" | "storageSize" | "indexSize" | "collections"> =
				await (db.stats() as Promise<DatabaseStats>).catch(() => {
					logger.error(`Error getting stats for database ${d.name} on server ${params.server}`);
					return {
						dataSize: 0,
						avgObjSize: 0,
						storageSize: 0,
						indexSize: 0,
						collections: 0,
					};
				});

			const collectionsJson = db
				.listCollections()
				.toArray()
				.then((c) => c.sort((a, b) => a.name.localeCompare(b.name)))
				.then((c) => Promise.all(c.map((c) => getCollectionJson(db.collection(c.name), c.type))));

			return {
				name: db.databaseName,
				size: d.sizeOnDisk ?? 0,
				dataSize: dbStats.dataSize,
				avgObjSize: dbStats.avgObjSize,
				storageSize: dbStats.storageSize,
				totalIndexSize: dbStats.indexSize,
				empty: d.empty ?? true,
				nCollections: dbStats.collections,
				collections: collectionsJson.catch(() => [] as CollectionJSON[]),
			};
		}),
	);

	return {
		databases,
	};
};
