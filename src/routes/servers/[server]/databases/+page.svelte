<script lang="ts">
	import {
		createCollection as createCollectionCommand,
		dropDatabase as dropDatabaseCommand,
	} from "$api/servers.remote";
	import { invalidateAll } from "$app/navigation";
	import { resolve } from "$app/paths";
	import Modal from "$lib/components/Modal.svelte";
	import Panel from "$lib/components/Panel.svelte";
	import TooltipTable from "$lib/components/TooltipTable.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import { formatBytes } from "$lib/utils/filters";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	type Database = PageData["databases"][number];

	let showDropModal = $state(false);
	let databaseToDrop = $state<Database | null>(null);
	let isDropping = $state(false);

	function openDropModal(database: Database) {
		databaseToDrop = database;
		showDropModal = true;
	}

	function closeDropModal() {
		showDropModal = false;
		databaseToDrop = null;
		isDropping = false;
	}

	async function confirmDrop() {
		if (!databaseToDrop || isDropping) {
			return;
		}

		isDropping = true;
		try {
			await dropDatabaseCommand({
				server: data.server,
				database: databaseToDrop.name,
			});
			notificationStore.notifySuccess(`Database "${databaseToDrop.name}" dropped successfully`);
			closeDropModal();
			// Reload the page to get updated databases
			await invalidateAll();
		} catch (error) {
			notificationStore.notifyError(error, "Failed to drop database");
			isDropping = false;
		}
	}

	let showCreateModal = $state(false);
	let creatingDatabase = $state(false);
	let newDatabaseName = $state("");
	let newCollectionName = $state("");

	function openCreateModal() {
		newDatabaseName = "";
		newCollectionName = "";
		showCreateModal = true;
	}

	function closeCreateModal() {
		showCreateModal = false;
		creatingDatabase = false;
	}

	async function confirmCreateDatabase() {
		const database = newDatabaseName.trim();
		const collection = newCollectionName.trim();
		if (!database || !collection || creatingDatabase) {
			return;
		}

		creatingDatabase = true;
		try {
			await createCollectionCommand({ server: data.server, database, collection });
			notificationStore.notifySuccess(`Database "${database}" created successfully`);
			closeCreateModal();
			await invalidateAll();
		} catch (error) {
			notificationStore.notifyError(error, "Failed to create database");
			creatingDatabase = false;
		}
	}
</script>

<Panel title="Databases on {data.server}">
	{#snippet actions()}
		{#if !data.readOnly}
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
				Create Database
			</button>
		{/if}
		<a
			href={resolve(`/servers/${encodeURIComponent(data.server)}/users`)}
			class="btn btn-outline-primary btn-sm"
			title="Manage MongoDB users & roles"
		>
			Users
		</a>
	{/snippet}
	<table class="table">
		<thead>
			<tr>
				<th>Name</th>
				<th>Collections</th>
				<th>Size</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#if data.databases && data.databases.length > 0}
				{#each data.databases as database (database.name)}
					<tr class="group">
						<td>
							<a
								href={resolve(
									`/servers/${encodeURIComponent(data.server)}/databases/${encodeURIComponent(
										database.name,
									)}/collections`,
								)}
							>
								{database.name}
							</a>
						</td>
						<td>
							{database.nCollections}
						</td>
						<td>
							{#if database.size !== undefined}
								<TooltipTable
									hideHeader
									columns={[
										{ header: "Metric", key: "metric", align: "left" },
										{ header: "Value", key: "value", align: "right" },
									]}
									rows={[
										{ metric: "Total Size", value: database.size },
										{ metric: "Data Size", value: database.dataSize },
										{ metric: "Storage Size", value: database.storageSize },
										{ metric: "Index Size", value: database.totalIndexSize },
										{ metric: "Avg Object Size", value: database.avgObjSize },
										{ metric: "Empty", value: database.empty ? "Yes" : "No" },
									].map((row) => ({
										...row,
										value: typeof row.value === "number" ? formatBytes(row.value) : row.value,
									}))}
								>
									{formatBytes(database.size)}
								</TooltipTable>
							{/if}
						</td>
						<td style="width: 100px">
							<div class="flex justify-end">
								{#if !data.readOnly}
									<button
										class="btn btn-outline-danger btn-sm -my-2 hidden group-hover:inline"
										onclick={() => openDropModal(database)}
									>
										Drop
									</button>
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			{:else}
				<tr>
					<td colspan="4">
						<div class="text-center">No databases...</div>
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
</Panel>

<Modal show={showDropModal} onclose={closeDropModal} title="Drop Database">
	<p>
		Are you sure you want to drop the database <strong>{databaseToDrop?.name}</strong>? This action cannot be undone.
	</p>
	{#snippet footer()}
		<button class="btn btn-default btn-sm" onclick={closeDropModal} disabled={isDropping}>Cancel</button>
		<button class="btn btn-outline-danger btn-sm" onclick={confirmDrop} disabled={isDropping}>
			{#if isDropping}
				Dropping...
			{:else}
				Drop Database
			{/if}
		</button>
	{/snippet}
</Modal>

<Modal show={showCreateModal} onclose={closeCreateModal} title="Create Database">
	<div class="space-y-4">
		<div>
			<label for="new-database-name" class="block text-sm font-semibold mb-2" style="color: var(--text);">
				Database Name <span style="color: var(--error);">*</span>
			</label>
			<input
				id="new-database-name"
				type="text"
				bind:value={newDatabaseName}
				placeholder="my_database"
				class="w-full p-2 rounded border border-[var(--border-color)] bg-[var(--color-1)] text-sm focus:outline-none focus:ring-2"
				style="color: var(--text); --tw-ring-color: var(--link);"
			/>
		</div>
		<div>
			<label for="new-database-collection" class="block text-sm font-semibold mb-2" style="color: var(--text);">
				Initial Collection Name <span style="color: var(--error);">*</span>
			</label>
			<p class="text-xs mb-2" style="color: var(--text-darker);">
				MongoDB creates a database only once it has at least one collection, so an initial collection is required.
			</p>
			<input
				id="new-database-collection"
				type="text"
				bind:value={newCollectionName}
				placeholder="my_collection"
				class="w-full p-2 rounded border border-[var(--border-color)] bg-[var(--color-1)] text-sm focus:outline-none focus:ring-2"
				style="color: var(--text); --tw-ring-color: var(--link);"
			/>
		</div>
	</div>
	{#snippet footer()}
		<button class="btn btn-default btn-sm" onclick={closeCreateModal} disabled={creatingDatabase}>Cancel</button>
		<button
			class="btn btn-success btn-sm"
			onclick={confirmCreateDatabase}
			disabled={creatingDatabase || !newDatabaseName.trim() || !newCollectionName.trim()}
		>
			{creatingDatabase ? "Creating..." : "Create Database"}
		</button>
	{/snippet}
</Modal>
