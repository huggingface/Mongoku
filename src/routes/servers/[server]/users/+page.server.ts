import { logger } from "$lib/server/logger";
import { getMongo } from "$lib/server/mongo";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, depends }) => {
	depends("app:users");

	const mongo = await getMongo();
	const client = mongo.getClient(params.server);
	const admin = client.db("admin");

	// Fetch all users across *every* authentication database. `usersInfo: 1`
	// only returns users defined on the current db (admin); users created on
	// other databases would be invisible. `{ forAllDBs: true }` lists users on
	// all databases cluster-wide. `showPrivileges: true` is not allowed with a
	// non-exact (all-users) query unless the caller has grantRole privileges,
	// so we list first, then fetch each user's resolved privileges via an
	// exact-match query (always permitted). The per-user fetch is non-fatal —
	// if it fails we still show the user with their roles.
	const usersPromise = (async () => {
		try {
			const result = await admin.command({ usersInfo: { forAllDBs: true } });
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
