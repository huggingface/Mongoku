<script lang="ts">
	import { dropDatabase as dropDatabaseCommand } from "$api/servers.remote";
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
		if (!databaseToDrop || isDropping) return;

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
</script>

<Panel title="Databases on {data.server}">
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
							{#await database.collections}
								{database.nCollections}
							{:then collections}
								<TooltipTable
									columns={[
										{ header: "Collection", key: "name", align: "left" },
										{ header: "Size", key: "size", align: "right" },
									]}
									rows={collections.map((collection) => ({
										name: collection.name,
										size: formatBytes(collection.size),
									}))}
								>
									{database.nCollections}
								</TooltipTable>
							{/await}
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
