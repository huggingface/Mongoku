import { logger } from "$lib/server/logger";
import { getMongo } from "$lib/server/mongo";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, depends }) => {
	depends("app:users");

	const mongo = await getMongo();
	const client = mongo.getClient(params.server);
	const admin = client.db("admin");

	// The users / roles lists are fetched via remote commands (which run the
	// admin DB commands with showPrivileges), but we also need the list of
	// databases so role assignments can target the right db. Stream them so the
	// page renders immediately and fills in when each resolves.
	const usersPromise = (async () => {
		try {
			const result = await admin.command({ usersInfo: 1, showPrivileges: true });
			return result.users ?? [];
		} catch (err) {
			logger.error(`Error getting users for server ${params.server}:`, err);
			throw err;
		}
	})().catch((err) => err);

	const rolesPromise = (async () => {
		try {
			const result = await admin.command({
				rolesInfo: 1,
				showBuiltinRoles: true,
				showPrivileges: true,
			});
			return result.roles ?? [];
		} catch (err) {
			logger.error(`Error getting roles for server ${params.server}:`, err);
			throw err;
		}
	})().catch((err) => err);

	const databasesPromise = (async () => {
		try {
			const results = await client.db("test").admin().listDatabases();
			return mongo.filterDatabases(results.databases).map((d) => d.name);
		} catch (err) {
			logger.error(`Error getting databases for server ${params.server}:`, err);
			throw err;
		}
	})().catch((err) => err);

	return {
		server: params.server,
		users: usersPromise,
		roles: rolesPromise,
		databases: databasesPromise,
	};
};
