<script lang="ts">
	import {
		createUser as createUserCommand,
		dropUser as dropUserCommand,
		grantRolesToUser as grantRolesToUserCommand,
		listUsers,
		revokeRolesFromUser as revokeRolesFromUserCommand,
		updateUserPassword as updateUserPasswordCommand,
	} from "$api/servers.remote";
	import { invalidate } from "$app/navigation";
	import JsonValue from "$lib/components/JsonValue.svelte";
	import Modal from "$lib/components/Modal.svelte";
	import Panel from "$lib/components/Panel.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import { SvelteSet } from "svelte/reactivity";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	const readOnly = $derived(data.readOnly);

	// Each streamed promise resolves to { data, error }. We unwrap into local
	// state so we can optimistically update after grant/revoke without a full
	// re-fetch, and so rendering never holds onto the unresolved promise.
	type UsersResult = PageData["users"] extends Promise<infer U> ? U : never;
	type RolesResult = PageData["roles"] extends Promise<infer R> ? R : never;
	type DatabasesResult = PageData["databases"] extends Promise<infer D> ? D : never;

	type RoleDoc = RolesResult extends { data: infer R } ? R : never;

	let resolvedUsers = $state<UsersResult | null>(null);
	let resolvedRoles = $state<RolesResult | null>(null);
	let resolvedDatabases = $state<DatabasesResult | null>(null);

	// Token guards: only the latest promise's result is accepted, so a stale
	// in-flight promise from a previous server / invalidate can't overwrite
	// fresher data.
	let usersToken = 0;
	let rolesToken = 0;
	let databasesToken = 0;

	$effect(() => {
		const token = ++usersToken;
		data.users.then((r) => {
			if (token === usersToken) {
				resolvedUsers = r;
			}
		});
	});
	$effect(() => {
		const token = ++rolesToken;
		data.roles.then((r) => {
			if (token === rolesToken) {
				resolvedRoles = r;
			}
		});
	});
	$effect(() => {
		const token = ++databasesToken;
		data.databases.then((r) => {
			if (token === databasesToken) {
				resolvedDatabases = r;
			}
		});
	});

	const usersResult = $derived(resolvedUsers ?? data.users);

	// ── Create user modal ──────────────────────────────────────────────────
	let showCreateModal = $state(false);
	let creatingUser = $state(false);
	let newUsername = $state("");
	let newPassword = $state("");
	let newUserDb = $state("admin");
	let newRole = $state("read");
	let newRoleDb = $state("admin");
	let newRoles = $state<Array<{ role: string; db: string }>>([]);

	function openCreateModal() {
		newUsername = "";
		newPassword = "";
		newUserDb = "admin";
		newRole = "read";
		newRoleDb = "admin";
		newRoles = [];
		showCreateModal = true;
	}

	function addNewRole() {
		if (!newRole.trim()) {
			return;
		}
		newRoles = [...newRoles, { role: newRole.trim(), db: newRoleDb }];
		newRole = "read";
	}

	function removeNewRole(idx: number) {
		newRoles = newRoles.filter((_, i) => i !== idx);
	}

	async function confirmCreateUser() {
		if (!newUsername || !newPassword) {
			return;
		}
		creatingUser = true;
		const roles = newRoles.length > 0 ? newRoles : [];
		try {
			const result = await createUserCommand({
				server: data.server,
				username: newUsername,
				password: newPassword,
				db: newUserDb,
				roles,
			});
			if (result.error) {
				throw new Error(result.error);
			}
			notificationStore.notifySuccess(`User "${newUsername}" created successfully`);
			showCreateModal = false;
			// Clear the cached result so the streaming promise re-resolves fresh data
			resolvedUsers = null;
			await invalidate("app:users");
		} catch (error) {
			notificationStore.notifyError(error, "Failed to create user");
		} finally {
			creatingUser = false;
		}
	}

	// ── Drop user modal ───────────────────────────────────────────────────
	let showDropModal = $state(false);
	let userToDrop = $state<{ user: string; db: string } | null>(null);
	let droppingUser = $state(false);
	// keyed by `${user}@${db}` so two users with the same name on different dbs
	// don't share loading state
	const operatingUsers = new SvelteSet<string>();

	function userKey(u: string, db: string): string {
		return `${u}@${db}`;
	}

	function openDropModal(user: { user: string; db: string }) {
		userToDrop = user;
		showDropModal = true;
	}

	function closeDropModal() {
		showDropModal = false;
		userToDrop = null;
	}

	async function confirmDropUser() {
		if (!userToDrop) {
			return;
		}
		const { user: username, db } = userToDrop;
		const key = userKey(username, db);
		droppingUser = true;
		operatingUsers.add(key);
		try {
			const result = await dropUserCommand({ server: data.server, username, db });
			if (result.error) {
				throw new Error(result.error);
			}
			notificationStore.notifySuccess(`User "${username}" dropped successfully`);
			closeDropModal();
			resolvedUsers = null;
			await invalidate("app:users");
		} catch (error) {
			notificationStore.notifyError(error, "Failed to drop user");
		} finally {
			droppingUser = false;
			operatingUsers.delete(key);
		}
	}

	// ── Edit roles modal ──────────────────────────────────────────────────
	let showRolesModal = $state(false);
	let rolesUser = $state<string | null>(null);
	let rolesUserDb = $state<string>("admin");
	let currentRoles = $state<Array<{ role: string; db: string }>>([]);
	let inheritedPrivileges = $state<unknown>(null);
	let addRoleName = $state("read");
	let addRoleDb = $state("admin");
	let updatingRoles = $state(false);

	function openRolesModal(user: {
		user: string;
		db: string;
		roles: Array<{ role: string; db: string }>;
		inheritedPrivileges?: unknown;
	}) {
		rolesUser = user.user;
		rolesUserDb = user.db;
		currentRoles = user.roles.map((r) => ({ role: r.role, db: r.db }));
		inheritedPrivileges = user.inheritedPrivileges ?? null;
		addRoleName = "read";
		addRoleDb = user.db;
		showRolesModal = true;
	}

	function closeRolesModal() {
		showRolesModal = false;
		rolesUser = null;
		rolesUserDb = "admin";
		currentRoles = [];
		inheritedPrivileges = null;
	}

	// Re-fetch the open modal user's resolved privileges after a role change so
	// the "Resolved Privileges" panel reflects the new effective permissions.
	async function refreshModalPrivileges() {
		if (!rolesUser) {
			return;
		}
		try {
			const res = await listUsers({ server: data.server });
			const match = (res.data ?? []).find(
				(u: { user: string; db: string }) => u.user === rolesUser && u.db === rolesUserDb,
			);
			if (match?.inheritedPrivileges !== undefined) {
				inheritedPrivileges = match.inheritedPrivileges;
			}
		} catch {
			// non-fatal: the modal just keeps its previous privileges snapshot
		}
	}

	async function removeRole(role: { role: string; db: string }) {
		if (!rolesUser || updatingRoles) {
			return;
		}
		updatingRoles = true;
		try {
			const result = await revokeRolesFromUserCommand({
				server: data.server,
				username: rolesUser,
				db: rolesUserDb,
				roles: [role],
			});
			if (result.error) {
				throw new Error(result.error);
			}
			currentRoles = currentRoles.filter((r) => !(r.role === role.role && r.db === role.db));
			notificationStore.notifySuccess(`Revoked ${role.role}@${role.db} from ${rolesUser}`);
			resolvedUsers = null;
			await invalidate("app:users");
			await refreshModalPrivileges();
		} catch (error) {
			notificationStore.notifyError(error, "Failed to revoke role");
		} finally {
			updatingRoles = false;
		}
	}

	async function addRole() {
		if (!rolesUser || !addRoleName.trim() || updatingRoles) {
			return;
		}
		const role = { role: addRoleName.trim(), db: addRoleDb };
		// Skip if already present
		if (currentRoles.some((r) => r.role === role.role && r.db === role.db)) {
			notificationStore.notify(`${role.role}@${role.db} is already assigned`, "info");
			return;
		}
		updatingRoles = true;
		try {
			const result = await grantRolesToUserCommand({
				server: data.server,
				username: rolesUser,
				db: rolesUserDb,
				roles: [role],
			});
			if (result.error) {
				throw new Error(result.error);
			}
			currentRoles = [...currentRoles, role];
			notificationStore.notifySuccess(`Granted ${role.role}@${role.db} to ${rolesUser}`);
			resolvedUsers = null;
			await invalidate("app:users");
			await refreshModalPrivileges();
		} catch (error) {
			notificationStore.notifyError(error, "Failed to grant role");
		} finally {
			updatingRoles = false;
		}
	}

	// ── Reset password modal ──────────────────────────────────────────────
	let showPasswordModal = $state(false);
	let passwordUser = $state<{ user: string; db: string } | null>(null);
	let newPasswordValue = $state("");
	let updatingPassword = $state(false);

	function openPasswordModal(user: { user: string; db: string }) {
		passwordUser = user;
		newPasswordValue = "";
		showPasswordModal = true;
	}

	function closePasswordModal() {
		showPasswordModal = false;
		passwordUser = null;
		newPasswordValue = "";
	}

	async function confirmUpdatePassword() {
		if (!passwordUser || !newPasswordValue) {
			return;
		}
		const { user: username, db } = passwordUser;
		updatingPassword = true;
		try {
			const result = await updateUserPasswordCommand({
				server: data.server,
				username,
				db,
				password: newPasswordValue,
			});
			if (result.error) {
				throw new Error(result.error);
			}
			notificationStore.notifySuccess(`Password updated for "${username}"`);
			closePasswordModal();
		} catch (error) {
			notificationStore.notifyError(error, "Failed to update password");
		} finally {
			updatingPassword = false;
		}
	}

	// Available role names (deduped, sorted) from the roles list for the dropdowns.
	// These only render inside modals, which open after data has resolved, so
	// deriving from the resolved state (null until loaded) is safe.
	const availableRoleNames = $derived.by(() => {
		const res = resolvedRoles;
		const roles = res?.data;
		if (!res || res.error || !Array.isArray(roles)) {
			return ["read", "readWrite", "dbAdmin", "userAdmin", "clusterAdmin"].sort();
		}
		const names: Record<string, true> = {};
		for (const r of roles as RoleDoc[]) {
			if (r?.role) {
				names[r.role] = true;
			}
		}
		return Object.keys(names).sort();
	});

	// Database names for the role-target dropdown.
	const databaseNames = $derived.by(() => {
		const res = resolvedDatabases;
		const dbs = res?.data;
		if (!res || res.error || !Array.isArray(dbs)) {
			return ["admin"];
		}
		const names = (dbs as unknown[]).filter((d): d is string => typeof d === "string");
		return names.length > 0 ? names : ["admin"];
	});

	// Render a role reference as "role@db" (admin db implied when omitted).
	function roleLabel(role: { role: string; db?: string } | string): string {
		if (typeof role === "string") {
			return `${role}@admin`;
		}
		return `${role.role}@${role.db ?? "admin"}`;
	}

	// Group inherited privileges by database for display.
	type Privilege = { resource: { db?: string; collection?: string }; actions: string[] };
	type GroupedPriv = { db: string; collections: Array<{ collection: string; actions: string[] }> };
	function groupPrivileges(privs: unknown): GroupedPriv[] {
		if (!Array.isArray(privs)) {
			return [];
		}
		// db -> collection -> action set, using plain objects to avoid the
		// svelte/prefer-svelte-reactivity lint rule (these are not reactive).
		const byDb: Record<string, Record<string, Record<string, true>>> = {};
		for (const p of privs as Privilege[]) {
			const db = p?.resource?.db ?? "*";
			const coll = p?.resource?.collection ?? "*";
			byDb[db] ??= {};
			byDb[db][coll] ??= {};
			for (const a of p.actions ?? []) {
				byDb[db][coll][a] = true;
			}
		}
		return Object.keys(byDb)
			.sort()
			.map((db) => ({
				db,
				collections: Object.keys(byDb[db])
					.sort()
					.map((collection) => ({
						collection,
						actions: Object.keys(byDb[db][collection]).sort(),
					})),
			}));
	}
</script>

{#await usersResult}
	<Panel title="Users">
		<div class="loading">Loading users...</div>
	</Panel>
{:then res}
	{#if res.error}
		<Panel title="Users">
			<div class="p-4">
				<p class="error">Error loading users: {res.error}</p>
				<p class="text-sm mt-2" style="color: var(--text-darker);">
					User management requires the connected MongoDB user to have the <code>userAdmin</code> or
					<code>userAdminAnyDatabase</code> role (or equivalent) on the <code>admin</code> database.
				</p>
			</div>
		</Panel>
	{:else}
		<!-- Action buttons -->
		<div class="mb-4 flex gap-3">
			{#if !readOnly}
				<button class="btn btn-success btn-sm" type="button" onclick={openCreateModal}>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="w-4 h-4 inline mr-1"
					>
						<path d="M12 5v14M5 12h14" />
					</svg>
					Create User
				</button>
			{/if}
		</div>

		{#if res.data.length === 0}
			<Panel title="Users">
				<div class="text-center p-4" style="color: var(--text-darker)">No users found</div>
			</Panel>
		{:else}
			<Panel title={`Users on ${data.server}`}>
				<div class="table-wrapper">
					<table class="table">
						<thead>
							<tr>
								<th class="name-column">Username</th>
								<th>Database</th>
								<th>Roles</th>
								<th>Privileges</th>
								{#if !readOnly}
									<th style="width: 280px">Actions</th>
								{/if}
							</tr>
						</thead>
						<tbody>
							{#each res.data as user (userKey(user.user, user.db))}
								{@const isLoading = operatingUsers.has(userKey(user.user, user.db))}
								<tr class="group" class:opacity-50={isLoading}>
									<td class="name-cell">
										<span class="font-mono text-sm">{user.user}</span>
									</td>
									<td>
										<span class="text-sm">{user.db}</span>
									</td>
									<td>
										<div class="flex flex-wrap gap-2">
											{#if user.roles && user.roles.length > 0}
												{#each user.roles as role (roleLabel(role))}
													<span class="role-badge" title={`${role.role} on ${role.db}`}>
														{roleLabel(role)}
													</span>
												{/each}
											{:else}
												<span style="color: var(--text-darker);">No roles</span>
											{/if}
										</div>
									</td>
									<td>
										<details class="cursor-pointer">
											<summary class="details-link">
												View {user.inheritedPrivileges?.length ?? 0} privilege
												{user.inheritedPrivileges?.length === 1 ? "" : "s"}
											</summary>
											<div class="details-content">
												{#if user.inheritedPrivileges && user.inheritedPrivileges.length > 0}
													<div class="privilege-groups">
														{#each groupPrivileges(user.inheritedPrivileges) as group (group.db)}
															<div class="priv-group">
																<div class="priv-db">{group.db}</div>
																<div class="priv-colls">
																	{#each group.collections as c (group.db + c.collection)}
																		<div class="priv-coll">
																			<span class="priv-coll-name" title={c.collection}>{c.collection}</span>
																			<div class="priv-actions">
																				{#each c.actions as action (action)}
																					<span class="priv-action">{action}</span>
																				{/each}
																			</div>
																		</div>
																	{/each}
																</div>
															</div>
														{/each}
													</div>
												{:else}
													<span style="color: var(--text-darker);">No resolved privileges</span>
												{/if}
											</div>
										</details>
									</td>
									{#if !readOnly}
										<td>
											<div class="flex gap-1.5 items-center justify-end whitespace-nowrap hidden group-hover:flex">
												<button
													class="btn btn-outline-primary px-2 py-1 text-xs whitespace-nowrap"
													onclick={() => openRolesModal(user)}
													disabled={isLoading}
												>
													Edit Roles
												</button>
												<button
													class="btn btn-outline-light px-2 py-1 text-xs whitespace-nowrap"
													onclick={() => openPasswordModal(user)}
													disabled={isLoading}
												>
													Password
												</button>
												<button
													class="btn btn-outline-danger px-2 py-1 text-xs whitespace-nowrap"
													onclick={() => openDropModal(user)}
													disabled={isLoading}
												>
													Drop
												</button>
											</div>
										</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Panel>
		{/if}
	{/if}
{:catch}
	<!-- promises resolve with {data,error} and never reject; placeholder -->
{/await}

<!-- Create user modal -->
<Modal show={showCreateModal} onclose={() => (showCreateModal = false)} title="Create User" wide>
	<div class="space-y-4">
		<div>
			<label for="new-username" class="block text-sm font-semibold mb-2" style="color: var(--text);">
				Username <span style="color: var(--error);">*</span>
			</label>
			<input
				id="new-username"
				type="text"
				bind:value={newUsername}
				placeholder="username"
				class="w-full p-2 rounded border border-[var(--border-color)] bg-[var(--color-1)] text-sm focus:outline-none focus:ring-2"
				style="color: var(--text); --tw-ring-color: var(--link);"
			/>
		</div>
		<div>
			<label for="new-password" class="block text-sm font-semibold mb-2" style="color: var(--text);">
				Password <span style="color: var(--error);">*</span>
			</label>
			<input
				id="new-password"
				type="password"
				bind:value={newPassword}
				placeholder="password"
				class="w-full p-2 rounded border border-[var(--border-color)] bg-[var(--color-1)] text-sm focus:outline-none focus:ring-2"
				style="color: var(--text); --tw-ring-color: var(--link);"
			/>
		</div>
		<div>
			<label for="new-user-db" class="block text-sm font-semibold mb-2" style="color: var(--text);">
				Authentication Database
			</label>
			<p class="text-xs mb-2" style="color: var(--text-darker);">
				The database the user is created on. Usually <code>admin</code>.
			</p>
			<select
				id="new-user-db"
				bind:value={newUserDb}
				class="w-full p-2 rounded border border-[var(--border-color)] bg-[var(--color-1)] text-sm"
				style="color: var(--text);"
			>
				{#each databaseNames as db (db)}
					<option value={db}>{db}</option>
				{/each}
			</select>
		</div>
		<div>
			<div class="block text-sm font-semibold mb-2" style="color: var(--text);">Roles</div>
			<p class="text-xs mb-2" style="color: var(--text-darker);">
				Optionally assign roles now. You can change them later via "Edit Roles".
			</p>
			<div class="flex gap-2 items-center">
				<select
					bind:value={newRole}
					class="p-2 rounded border border-[var(--border-color)] bg-[var(--color-1)] text-sm"
					style="color: var(--text);"
				>
					{#each availableRoleNames as name (name)}
						<option value={name}>{name}</option>
					{/each}
				</select>
				<select
					bind:value={newRoleDb}
					class="p-2 rounded border border-[var(--border-color)] bg-[var(--color-1)] text-sm"
					style="color: var(--text);"
				>
					{#each databaseNames as db (db)}
						<option value={db}>{db}</option>
					{/each}
				</select>
				<button class="btn btn-outline-primary btn-sm" onclick={addNewRole} type="button">Add</button>
			</div>
			{#if newRoles.length > 0}
				<div class="flex flex-wrap gap-2 mt-2">
					{#each newRoles as role, i (i)}
						<span class="role-badge">
							{roleLabel(role)}
							<button type="button" class="role-remove" onclick={() => removeNewRole(i)} aria-label="Remove role"
								>×</button
							>
						</span>
					{/each}
				</div>
			{/if}
		</div>
	</div>
	{#snippet footer()}
		<button class="btn btn-default btn-sm" onclick={() => (showCreateModal = false)} disabled={creatingUser}>
			Cancel
		</button>
		<button
			class="btn btn-success btn-sm"
			onclick={confirmCreateUser}
			disabled={creatingUser || !newUsername || !newPassword}
		>
			{creatingUser ? "Creating..." : "Create User"}
		</button>
	{/snippet}
</Modal>

<!-- Drop user modal -->
<Modal show={showDropModal} onclose={closeDropModal} title="Drop User">
	<p>
		Are you sure you want to drop the user <strong>{userToDrop?.user}</strong>
		{#if userToDrop?.db && userToDrop.db !== "admin"}
			on <strong>{userToDrop.db}</strong>{/if}? This action cannot be undone.
	</p>
	<p class="text-sm mt-2" style="color: var(--text-darker);">
		The user will lose all access to the database. They can be recreated, but their credentials cannot be recovered.
	</p>
	{#snippet footer()}
		<button class="btn btn-default btn-sm" onclick={closeDropModal} disabled={droppingUser}>Cancel</button>
		<button class="btn btn-outline-danger btn-sm" onclick={confirmDropUser} disabled={droppingUser}>
			{droppingUser ? "Dropping..." : "Drop User"}
		</button>
	{/snippet}
</Modal>

<!-- Edit roles modal -->
<Modal show={showRolesModal} onclose={closeRolesModal} title={`Edit Roles — ${rolesUser ?? ""}`} wide>
	<div class="space-y-4">
		<div>
			<div class="block text-sm font-semibold mb-2" style="color: var(--text);">Current Roles</div>
			{#if currentRoles.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each currentRoles as role (roleLabel(role))}
						<span class="role-badge">
							{roleLabel(role)}
							<button
								type="button"
								class="role-remove"
								onclick={() => removeRole(role)}
								disabled={updatingRoles}
								aria-label="Remove role">×</button
							>
						</span>
					{/each}
				</div>
			{:else}
				<span style="color: var(--text-darker);">No roles assigned</span>
			{/if}
		</div>

		<div>
			<div class="block text-sm font-semibold mb-2" style="color: var(--text);">Grant a role</div>
			<div class="flex gap-2 items-center">
				<select
					bind:value={addRoleName}
					class="p-2 rounded border border-[var(--border-color)] bg-[var(--color-1)] text-sm"
					style="color: var(--text);"
				>
					{#each availableRoleNames as name (name)}
						<option value={name}>{name}</option>
					{/each}
				</select>
				<select
					bind:value={addRoleDb}
					class="p-2 rounded border border-[var(--border-color)] bg-[var(--color-1)] text-sm"
					style="color: var(--text);"
				>
					{#each databaseNames as db (db)}
						<option value={db}>{db}</option>
					{/each}
				</select>
				<button class="btn btn-outline-primary btn-sm" onclick={addRole} type="button" disabled={updatingRoles}>
					Grant
				</button>
			</div>
		</div>

		{#if inheritedPrivileges}
			<div>
				<div class="block text-sm font-semibold mb-2" style="color: var(--text);">Resolved Privileges</div>
				<p class="text-xs mb-2" style="color: var(--text-darker);">
					Effective privileges inherited from all assigned roles.
				</p>
				<div class="priv-details">
					<JsonValue value={inheritedPrivileges} autoCollapse collapsed />
				</div>
			</div>
		{/if}
	</div>
	{#snippet footer()}
		<button class="btn btn-default btn-sm" onclick={closeRolesModal}>Done</button>
	{/snippet}
</Modal>

<!-- Reset password modal -->
<Modal show={showPasswordModal} onclose={closePasswordModal} title={`Reset Password — ${passwordUser?.user ?? ""}`}>
	<div class="space-y-4">
		<div>
			<label for="new-pwd" class="block text-sm font-semibold mb-2" style="color: var(--text);">
				New Password <span style="color: var(--error);">*</span>
			</label>
			<input
				id="new-pwd"
				type="password"
				bind:value={newPasswordValue}
				placeholder="new password"
				class="w-full p-2 rounded border border-[var(--border-color)] bg-[var(--color-1)] text-sm focus:outline-none focus:ring-2"
				style="color: var(--text); --tw-ring-color: var(--link);"
			/>
		</div>
	</div>
	{#snippet footer()}
		<button class="btn btn-default btn-sm" onclick={closePasswordModal} disabled={updatingPassword}> Cancel </button>
		<button
			class="btn btn-primary btn-sm"
			onclick={confirmUpdatePassword}
			disabled={updatingPassword || !newPasswordValue}
		>
			{updatingPassword ? "Updating..." : "Update Password"}
		</button>
	{/snippet}
</Modal>

<style lang="postcss">
	.table-wrapper {
		overflow-x: auto;
	}

	.table tbody td {
		vertical-align: top;
	}

	.name-column {
		width: 20%;
		min-width: 150px;
		max-width: 300px;
	}

	.name-cell {
		max-width: 300px;
	}

	.role-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		border-radius: 3px;
		padding: 4px 8px;
		font-size: 12px;
		font-family: monospace;
		background-color: var(--color-3);
		color: var(--text);
		border: 1px solid var(--color-4);
	}

	.role-remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: 3px;
		font-size: 14px;
		line-height: 1;
		cursor: pointer;
		color: var(--text-secondary);
		background: transparent;
		border: none;
	}

	.role-remove:hover:not(:disabled) {
		background-color: var(--button-danger);
		color: white;
	}

	.details-link {
		font-size: 0.875rem;
		color: var(--link);
		cursor: pointer;
	}

	.details-link:hover {
		text-decoration: underline;
	}

	.details-content {
		margin-top: 8px;
		border-radius: 4px;
		padding: 12px;
		font-size: 0.875rem;
		background-color: var(--color-1);
		border: 1px solid var(--border-color);
		max-width: 600px;
	}

	.privilege-groups {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.priv-group {
		border-left: 2px solid var(--color-4);
		padding-left: 10px;
	}

	.priv-db {
		font-family: monospace;
		font-weight: 600;
		margin-bottom: 4px;
		color: var(--text);
	}

	.priv-colls {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.priv-coll {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.priv-coll-name {
		font-family: monospace;
		font-size: 12px;
		color: var(--text-secondary);
	}

	.priv-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.priv-action {
		display: inline-block;
		padding: 1px 6px;
		border-radius: 3px;
		font-size: 11px;
		font-family: monospace;
		background-color: var(--color-3);
		color: var(--text-secondary);
		border: 1px solid var(--color-4);
	}

	.priv-details {
		max-height: 300px;
		overflow: auto;
		border-radius: 4px;
		padding: 12px;
		background-color: var(--color-1);
		border: 1px solid var(--border-color);
		font-family: monospace;
		font-size: 0.8rem;
	}
</style>
