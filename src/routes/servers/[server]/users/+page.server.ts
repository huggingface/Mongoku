import { logger } from "$lib/server/logger";
import { getMongo } from "$lib/server/mongo";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, depends }) => {
	depends("app:users");

	const mongo = await getMongo();
	const client = mongo.getClient(params.server);
	const admin = client.db("admin");

	// Fetch all users. `showPrivileges: true` requires exact-match usersInfo
	// queries (MongoDB rejects `usersInfo: 1` + `showPrivileges` unless the
	// connected user has grantRole on the db). So we list all users first
	// (which always returns each user's direct `roles`), then fetch each
	// user's resolved privileges via an exact-match query. The per-user fetch
	// is non-fatal — if it fails we still show the user with their roles.
	const usersPromise = (async () => {
		try {
			const result = await admin.command({ usersInfo: 1 });
			const users = (result.users ?? []) as Array<{ user: string; db: string }>;

			const usersWithPrivs = await Promise.all(
				users.map(async (u) => {
					try {
						const info = await admin.command({
							usersInfo: { user: u.user, db: u.db },
							showPrivileges: true,
						});
						const detail = (info.users ?? [])[0] ?? {};
						return { ...u, ...detail };
					} catch (err) {
						// Privilege resolution failed for this user — keep the base record
						logger.error(`Error getting privileges for user ${u.user}:`, err);
						return u;
					}
				}),
			);

			// JSON round-trip to strip any MongoDB special types for safe streaming
			return { data: JSON.parse(JSON.stringify(usersWithPrivs)), error: null as string | null };
		} catch (err) {
			logger.error(`Error getting users for server ${params.server}:`, err);
			return {
				data: [],
				error: `Failed to list users: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	})();

	const rolesPromise = (async () => {
		try {
			const result = await admin.command({
				rolesInfo: 1,
				showBuiltinRoles: true,
				showPrivileges: true,
			});
			return { data: JSON.parse(JSON.stringify(result.roles ?? [])), error: null as string | null };
		} catch (err) {
			logger.error(`Error getting roles for server ${params.server}:`, err);
			return {
				data: [],
				error: `Failed to list roles: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	})();

	const databasesPromise = (async () => {
		try {
			const results = await client.db("test").admin().listDatabases();
			return {
				data: mongo.filterDatabases(results.databases).map((d) => d.name),
				error: null as string | null,
			};
		} catch (err) {
			logger.error(`Error getting databases for server ${params.server}:`, err);
			// Non-critical — the UI falls back to ["admin"]
			return { data: [] as string[], error: null as string | null };
		}
	})();

	return {
		server: params.server,
		users: usersPromise,
		roles: rolesPromise,
		databases: databasesPromise,
	};
};
