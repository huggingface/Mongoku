<script lang="ts">
	import {
		createCollection as createCollectionCommand,
		dropCollection as dropCollectionCommand,
	} from "$api/servers.remote";
	import { invalidateAll } from "$app/navigation";
	import { resolve } from "$app/paths";
	import Modal from "$lib/components/Modal.svelte";
	import Panel from "$lib/components/Panel.svelte";
	import ShardBadge from "$lib/components/ShardBadge.svelte";
	import TooltipTable from "$lib/components/TooltipTable.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import { formatBytes, formatNumber } from "$lib/utils/filters";
	import type { ShardKey } from "$lib/utils/shardKey";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	type Collection = PageData["collections"][number];

	// Resolve the streamed shard keys, guarding against out-of-order responses:
	// when navigating between databases, a slow previous request must not
	// overwrite the current one. We key on the promise identity (reassigned by
	// the loader on each navigation) and drop any result from a stale promise.
	let shardKeys = $state<Record<string, ShardKey>>({});

	$effect(() => {
		const promise = data.shardKeys;
		// Reset immediately so badges from the previous database disappear while
		// the new request is in flight.
		shardKeys = {};
		let cancelled = false;
		// Silently ignore failures (e.g. no read access to the config database):
		// the load already degrades to {}, and this just leaves badges off.
		promise.then((keys) => {
			if (!cancelled) {
				shardKeys = keys;
			}
		});
		return () => {
			cancelled = true;
		};
	});

	let showDropModal = $state(false);
	let collectionToDrop = $state<Collection | null>(null);
	let isDropping = $state(false);

	function openDropModal(collection: Collection) {
		collectionToDrop = collection;
		showDropModal = true;
	}

	function closeDropModal() {
		showDropModal = false;
		collectionToDrop = null;
		isDropping = false;
	}

	async function confirmDrop() {
		if (!collectionToDrop || isDropping) {
			return;
		}

		isDropping = true;
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
			isDropping = false;
		}
	}

	let showCreateModal = $state(false);
	let creatingCollection = $state(false);
	let newCollectionName = $state("");

	function openCreateModal() {
		newCollectionName = "";
		showCreateModal = true;
	}

	function closeCreateModal() {
		showCreateModal = false;
		creatingCollection = false;
	}

	async function confirmCreateCollection() {
		const collection = newCollectionName.trim();
		if (!collection || creatingCollection) {
			return;
		}

		creatingCollection = true;
		try {
			await createCollectionCommand({ server: data.server, database: data.database, collection });
			notificationStore.notifySuccess(`Collection "${collection}" created successfully`);
			closeCreateModal();
			await invalidateAll();
		} catch (error) {
			notificationStore.notifyError(error, "Failed to create collection");
			creatingCollection = false;
		}
	}
</script>

<Panel title="{data.database} collections">
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
				Create Collection
			</button>
		{/if}
	{/snippet}
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
							<div class="flex items-center gap-2">
								<a
									href={resolve(
										`/servers/${encodeURIComponent(data.server)}/databases/${encodeURIComponent(
											data.database,
										)}/collections/${encodeURIComponent(collection.name)}/documents`,
									)}
								>
									{collection.name}
								</a>
								{#if shardKeys[collection.name]}
									<ShardBadge
										shardKey={shardKeys[collection.name]}
										showKey={false}
										href={resolve(
											`/servers/${encodeURIComponent(data.server)}/databases/${encodeURIComponent(
												data.database,
											)}/collections/${encodeURIComponent(collection.name)}/sharding`,
										)}
									/>
								{/if}
							</div>
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
		<button class="btn btn-default btn-sm" onclick={closeDropModal} disabled={isDropping}>Cancel</button>
		<button class="btn btn-outline-danger btn-sm" onclick={confirmDrop} disabled={isDropping}>
			{#if isDropping}
				Dropping...
			{:else}
				Drop Collection
			{/if}
		</button>
	{/snippet}
</Modal>

<Modal show={showCreateModal} onclose={closeCreateModal} title="Create Collection">
	<div>
		<label for="new-collection-name" class="block text-sm font-semibold mb-2" style="color: var(--text);">
			Collection Name <span style="color: var(--error);">*</span>
		</label>
		<input
			id="new-collection-name"
			type="text"
			bind:value={newCollectionName}
			placeholder="my_collection"
			class="w-full p-2 rounded border border-[var(--border-color)] bg-[var(--color-1)] text-sm focus:outline-none focus:ring-2"
			style="color: var(--text); --tw-ring-color: var(--link);"
		/>
	</div>
	{#snippet footer()}
		<button class="btn btn-default btn-sm" onclick={closeCreateModal} disabled={creatingCollection}>Cancel</button>
		<button
			class="btn btn-success btn-sm"
			onclick={confirmCreateCollection}
			disabled={creatingCollection || !newCollectionName.trim()}
		>
			{creatingCollection ? "Creating..." : "Create Collection"}
		</button>
	{/snippet}
</Modal>
