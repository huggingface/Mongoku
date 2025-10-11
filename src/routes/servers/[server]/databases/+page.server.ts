import { getCollectionJson, getMongo } from "$lib/server/mongo";
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
			const collections = await db.listCollections().toArray();

			const collectionsJson = await Promise.all(
				collections.map((c) => getCollectionJson(db.collection(c.name), c.type)),
			);

			collectionsJson.sort((a, b) => a.name.localeCompare(b.name));

			const totalObjNr = collectionsJson.reduce((sum, c) => sum + c.count, 0);
			const storageSize = collectionsJson.reduce((sum, c) => sum + c.storageSize, 0);
			const indexSize = collectionsJson.reduce((sum, c) => sum + c.totalIndexSize, 0);
			const dataSize = collectionsJson.reduce((sum, c) => sum + c.dataSize, 0);

			return {
				name: db.databaseName,
				size: d.sizeOnDisk ?? 0,
				dataSize,
				avgObjSize: Math.round(storageSize / totalObjNr) || 0,
				storageSize,
				totalIndexSize: indexSize,
				empty: d.empty ?? true,
				collections: collectionsJson,
			};
		}),
	);

	return {
		server: params.server,
		databases,
	};
};
