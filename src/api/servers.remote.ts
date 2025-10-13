import { query } from "$app/server";
import { getMongo } from "$lib/server/mongo";
import type { DatabaseStats } from "$lib/types";
import { z } from "zod";

export const getServers = query(async () => {
	const mongo = await getMongo();

	const servers = mongo.listClients().map(({ name, _id }) => ({
		name,
		_id,
	}));

	servers.sort((a, b) => a.name.localeCompare(b.name));

	return {
		servers,
	};
});

export const getServerDetails = query(z.string(), async (serverId) => {
	const mongo = await getMongo();
	const clients = mongo.listClients();
	const serverInfo = clients.find((c) => c._id === serverId);

	if (!serverInfo) {
		throw new Error("Server not found");
	}

	const { client } = serverInfo;
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
});
