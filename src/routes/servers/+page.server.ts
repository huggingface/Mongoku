import { logger } from "$lib/server/logger";
import { getMongo } from "$lib/server/mongo";
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
				const filteredDatabases = mongo.filterDatabases(results.databases);

				return {
					databases: filteredDatabases.map((d) => ({
						name: d.name,
						size: d.sizeOnDisk ?? 0,
					})),
					size: results.totalSize ?? 0,
				};
			} catch (err) {
				logger.error(`Error getting details for server ${name}:`, err);
				return {
					error: {
						code: err instanceof Error && "code" in err ? err.code : undefined,
						name: err instanceof Error ? err.name : "Error",
						message: err instanceof Error ? err.message : String(err),
					},
				};
			}
		})().catch((err) => {
			logger.error(`Error getting details for server ${name}:`, err);
			return {
				error: {
					code: err instanceof Error && "code" in err ? err.code : undefined,
					name: err instanceof Error ? err.name : "Error",
					message: err instanceof Error ? err.message : String(err),
				},
			};
		}),
	}));

	servers.sort((a, b) => a.name.localeCompare(b.name));
	return {
		servers,
	};
};
