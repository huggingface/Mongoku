import { getCollectionJson, getMongo } from "$lib/server/mongo";
import type { CollectionJSON, DatabaseStats } from "$lib/types";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
	const mongo = await getMongo();
	const client = mongo.getClient(params.server);

	if (client instanceof Error) {
		return {
			server: params.server,
			databases: [],
		};
	}

	const adminDb = client.db("test").admin();
	const results = await adminDb.listDatabases();

	if (!Array.isArray(results.databases)) {
		return {
			server: params.server,
			databases: [],
		};
	}

	const databases = await Promise.all(
		results.databases.map(async (d) => {
			const db = client.db(d.name);
			const dbStats = (await db.stats()) as DatabaseStats;

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
		server: params.server,
		databases,
	};
};
