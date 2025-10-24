<script lang="ts">
	import { dropCollection as dropCollectionCommand } from "$api/servers.remote";
	import { invalidateAll } from "$app/navigation";
	import { resolve } from "$app/paths";
	import Modal from "$lib/components/Modal.svelte";
	import Panel from "$lib/components/Panel.svelte";
	import TooltipTable from "$lib/components/TooltipTable.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import { formatBytes, formatNumber } from "$lib/utils/filters";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	type Collection = PageData["collections"][number];

	let showDropModal = $state(false);
	let collectionToDrop = $state<Collection | null>(null);

	function openDropModal(collection: Collection) {
		collectionToDrop = collection;
		showDropModal = true;
	}

	function closeDropModal() {
		showDropModal = false;
		collectionToDrop = null;
	}

	async function confirmDrop() {
		if (!collectionToDrop) return;

		if (data.readOnly) {
			notificationStore.notifyError("Cannot drop collection in read-only mode");
			closeDropModal();
			return;
		}

		try {
			await dropCollectionCommand({
				server: data.server,
				database: data.database,
				collection: collectionToDrop.name,
			});
			notificationStore.notifySuccess(`Collection "${collectionToDrop.name}" dropped successfully`);
			closeDropModal();
			// Reload the page to get updated collections
			await invalidateAll();
		} catch (error) {
			notificationStore.notifyError(error, "Failed to drop collection");
		}
	}
</script>

<Panel title="{data.database} collections">
	<table class="table">
		<thead>
			<tr>
				<th>Name</th>
				<th>Documents</th>
				<th>Indexes</th>
				<th>Size</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#if data.collections && data.collections.length > 0}
				{#each data.collections as collection (collection.name)}
					<tr class="group">
						<td>
							<a
								href={resolve(
									`/servers/${encodeURIComponent(data.server)}/databases/${encodeURIComponent(
										data.database,
									)}/collections/${encodeURIComponent(collection.name)}/documents`,
								)}
							>
								{collection.name}
							</a>
						</td>
						<td>
							{#await collection.details}
								<span style="color: var(--text-secondary);">...</span>
							{:then details}
								{#if details}
									{formatNumber(details.count)}
								{:else}
									<span title="Failed to load">❌</span>
								{/if}
							{/await}
						</td>
						<td>
							{#await collection.details}
								<span style="color: var(--text-secondary);">...</span>
							{:then details}
								{#if details}
									<TooltipTable
										columns={[
											{ header: "Index", key: "definition", align: "left" },
											{ header: "Size", key: "size", align: "right" },
										]}
										rows={details.indexes.map((index) => ({
											definition: index.key ? JSON.stringify(index.key, null, 1) : index.name,
											size: formatBytes(index.size),
										}))}
									>
										{formatNumber(details.nIndexes)}
									</TooltipTable>
								{:else}
									<span title="Failed to load">❌</span>
								{/if}
							{/await}
						</td>
						<td>
							{#await collection.details}
								<span style="color: var(--text-secondary);">...</span>
							{:then details}
								{#if details}
									<TooltipTable
										hideHeader
										columns={[
											{ header: "Label", key: "label", align: "left" },
											{ header: "Value", key: "value", align: "right" },
										]}
										rows={[
											{ label: "Average obj. size", value: details.avgObjSize },
											{ label: "Data size", value: details.dataSize },
											{ label: "Storage size", value: details.storageSize },
											{ label: "Index size", value: details.totalIndexSize },
										].map((row) => ({
											...row,
											value: typeof row.value === "number" ? formatBytes(row.value) : row.value,
										}))}
									>
										{formatBytes(details.size)}
									</TooltipTable>
								{:else}
									<span title="Failed to load">❌</span>
								{/if}
							{/await}
						</td>
						<td style="width: 100px">
							<div class="flex justify-end">
								{#if !data.readOnly}
									<button
										class="btn btn-outline-danger btn-sm -my-2 hidden group-hover:inline"
										onclick={() => openDropModal(collection)}
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
					<td colspan="5">
						<div class="text-center">No collections...</div>
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
</Panel>

<Modal show={showDropModal} onclose={closeDropModal} title="Drop Collection">
	<p>
		Are you sure you want to drop the collection <strong>{collectionToDrop?.name}</strong>? This action cannot be
		undone.
	</p>
	{#snippet footer()}
		<button class="btn btn-default btn-sm" onclick={closeDropModal}>Cancel</button>
		<button class="btn btn-outline-danger btn-sm" onclick={confirmDrop}>Drop Collection</button>
	{/snippet}
</Modal>
