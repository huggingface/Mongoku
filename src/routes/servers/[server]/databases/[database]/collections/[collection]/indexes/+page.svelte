<script lang="ts">
	import {
		createIndex as createIndexCommand,
		dropIndex as dropIndexCommand,
		getIndexStatsFromNodes,
		getServerNodes,
		hideIndex as hideIndexCommand,
		unhideIndex as unhideIndexCommand,
	} from "$api/servers.remote";
	import { invalidate } from "$app/navigation";
	import { page } from "$app/state";
	import { jsonTextarea } from "$lib/actions/jsonTextarea";
	import JsonValue from "$lib/components/JsonValue.svelte";
	import Modal from "$lib/components/Modal.svelte";
	import Panel from "$lib/components/Panel.svelte";
	import ReplicaSetSelector from "$lib/components/ReplicaSetSelector.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import { formatBytes } from "$lib/utils/filters";
	import { getShortenedHostnames } from "$lib/utils/hostnames";
	import { omit } from "$lib/utils/omit.js";
	import type { PageData } from "./$types.js";

	const { data } = $props();

	const readOnly = $derived(data.readOnly);
	let resolvedIndexes = $state<Awaited<PageData["indexes"]> | null>(null);
	let loadingIndexes = $state<Set<string>>(new Set());
	let showDropModal = $state(false);
	let indexToDrop = $state<string | null>(null);
	let showCreateModal = $state(false);
	let showReplicaSetSelector = $state(false);
	let availableNodes = $state<string[]>([]);
	let selectedNodes = $state<string[]>([]);
	let loadingNodes = $state(false);
	let multiNodeStats = $state<Record<string, { ops: number; since: Date; host: string }>>({});
	let loadingMultiNodeStats = $state(false);
	let creatingIndex = $state(false);
	let aggregateUsage = $state(false);

	// Calculate shortened hostnames for display
	const shortenedHostnames = $derived.by(() => {
		const hosts = [...new Set(Object.values(multiNodeStats).map((stat) => stat.host))];
		return getShortenedHostnames(hosts);
	});

	// Create index form state
	let indexKeys = $state('{ "fieldName": 1 }');
	let indexName = $state("");
	let indexUnique = $state(false);
	let indexSparse = $state(false);
	let indexPartialFilterExpression = $state("");
	let indexExpireAfterSeconds = $state<number | undefined>(undefined);
	let indexBackground = $state(false);

	// Resolve the promise once and store the result
	$effect(() => {
		data.indexes.then((result) => {
			if (!resolvedIndexes) {
				resolvedIndexes = result;
			}
		});
	});

	const indexesData = $derived(resolvedIndexes || data.indexes);

	async function toggleHidden(indexName: string, currentlyHidden: boolean) {
		const { server, database, collection } = page.params;
		if (!server || !database || !collection) return;

		loadingIndexes.add(indexName);
		loadingIndexes = loadingIndexes;

		try {
			const params = {
				server,
				database,
				collection,
				index: indexName,
			};

			if (currentlyHidden) {
				await unhideIndexCommand(params);
			} else {
				await hideIndexCommand(params);
			}

			// Optimistically update the index in the frontend
			if (resolvedIndexes && resolvedIndexes.data) {
				const updatedData = resolvedIndexes.data.map((index) =>
					index.name === indexName ? { ...index, hidden: !currentlyHidden } : index,
				);
				resolvedIndexes = { ...resolvedIndexes, data: updatedData };
			}

			notificationStore.notifySuccess(`Index ${currentlyHidden ? "unhidden" : "hidden"} successfully`);
		} catch (error) {
			notificationStore.notifyError(error, `Failed to ${currentlyHidden ? "unhide" : "hide"} index`);
		} finally {
			loadingIndexes.delete(indexName);
			loadingIndexes = loadingIndexes;
		}
	}

	function openCreateModal() {
		// Reset form
		indexKeys = '{ "fieldName": 1 }';
		indexName = "";
		indexUnique = false;
		indexSparse = false;
		indexPartialFilterExpression = "";
		indexExpireAfterSeconds = undefined;
		indexBackground = false;
		showCreateModal = true;
	}

	function closeCreateModal() {
		showCreateModal = false;
	}

	async function confirmCreate() {
		const { server, database, collection } = page.params;
		if (!server || !database || !collection) return;

		creatingIndex = true;

		try {
			await createIndexCommand({
				server,
				database,
				collection,
				keys: indexKeys,
				name: indexName || undefined,
				unique: indexUnique || undefined,
				sparse: indexSparse || undefined,
				partialFilterExpression: indexPartialFilterExpression || undefined,
				expireAfterSeconds: indexExpireAfterSeconds,
				background: indexBackground || undefined,
			});

			notificationStore.notifySuccess("Index created successfully");
			closeCreateModal();

			// Refresh the indexes list
			await invalidate("app:indexes");
		} catch (error) {
			notificationStore.notifyError(error, "Failed to create index");
		} finally {
			creatingIndex = false;
		}
	}

	function openDropModal(indexName: string) {
		indexToDrop = indexName;
		showDropModal = true;
	}

	function closeDropModal() {
		showDropModal = false;
		indexToDrop = null;
	}

	async function confirmDrop() {
		if (!indexToDrop) return;

		const { server, database, collection } = page.params;
		if (!server || !database || !collection) return;

		loadingIndexes.add(indexToDrop);
		loadingIndexes = loadingIndexes;
		const indexName = indexToDrop;

		try {
			await dropIndexCommand({
				server,
				database,
				collection,
				index: indexName,
			});

			// Remove the index from the frontend
			if (resolvedIndexes && resolvedIndexes.data) {
				const updatedData = resolvedIndexes.data.filter((index) => index.name !== indexName);
				resolvedIndexes = { ...resolvedIndexes, data: updatedData };
			}

			notificationStore.notifySuccess(`Index "${indexName}" dropped successfully`);
			closeDropModal();
		} catch (error) {
			notificationStore.notifyError(error, `Failed to drop index`);
		} finally {
			loadingIndexes.delete(indexName);
			loadingIndexes = loadingIndexes;
		}
	}

	async function loadNodes() {
		const { server } = page.params;
		if (!server) return;

		loadingNodes = true;
		try {
			const result = await getServerNodes({ server });

			if (result.error) {
				notificationStore.notifyError(result.error, "Failed to load nodes");
				availableNodes = [];
			} else {
				availableNodes = result.data;
				if (availableNodes.length > 0) {
					notificationStore.notifySuccess(`Found ${availableNodes.length} node(s)`);
				}
			}
		} catch (error) {
			notificationStore.notifyError(error, "Failed to load nodes");
			availableNodes = [];
		} finally {
			loadingNodes = false;
		}
	}

	async function fetchMultiNodeStats() {
		const { server, database, collection } = page.params;
		if (!server || !database || !collection) return;

		if (selectedNodes.length === 0) {
			notificationStore.notifyError("No nodes selected", "Please select at least one node");
			return;
		}

		loadingMultiNodeStats = true;
		multiNodeStats = {};

		try {
			const result = await getIndexStatsFromNodes({
				server,
				database,
				collection,
				nodes: selectedNodes,
			});

			if (result.error) {
				notificationStore.notifyError(result.error, "Failed to fetch stats from some nodes");
			}

			multiNodeStats = result.data as Record<string, { ops: number; since: Date; host: string }>;

			const statsCount = Object.keys(multiNodeStats).length;
			if (statsCount === 0) {
				notificationStore.notifyError("No stats found", "No index stats found for selected nodes");
			} else {
				notificationStore.notifySuccess(`Fetched stats from ${statsCount} index/host combination(s)`);
			}
		} catch (error) {
			notificationStore.notifyError(error, "Failed to fetch multi-node usage");
		} finally {
			loadingMultiNodeStats = false;
		}
	}

	// Load nodes when the selector is shown
	$effect(() => {
		if (showReplicaSetSelector && availableNodes.length === 0 && !loadingNodes) {
			loadNodes();
		}
	});
</script>

{#await indexesData}
	<Panel title="Indexes">
		<div class="loading">Loading indexes...</div>
	</Panel>
{:then result}
	{#if result.error}
		<Panel title="Indexes">
			<div class="p-4">
				<p class="error">{result.error}</p>
			</div>
		</Panel>
	{:else}
		<!-- Action buttons at the top -->
		<div class="mb-4 flex gap-3">
			{#if !readOnly}
				<button class="btn btn-success btn-sm flex items-center" type="button" onclick={openCreateModal}>
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
					Create Index
				</button>
			{/if}
			<button class="btn btn-primary btn-sm" onclick={() => (showReplicaSetSelector = !showReplicaSetSelector)}>
				{showReplicaSetSelector ? "Hide" : "Show"} Multi-Node Usage
			</button>
		</div>

		{#if result.data.length === 0}
			<Panel title="Indexes">
				<div class="text-center p-4" style="color: var(--text-darker)">No indexes found</div>
			</Panel>
		{:else}
			<!-- Replica Set Selector Section -->
			{#if showReplicaSetSelector}
				<div class="mb-4">
					<ReplicaSetSelector bind:availableNodes bind:selectedNodes loading={loadingNodes} />
					<div class="mt-3 flex gap-3 items-center">
						<button
							class="btn btn-primary btn-sm"
							onclick={fetchMultiNodeStats}
							disabled={loadingMultiNodeStats || selectedNodes.length === 0}
						>
							{loadingMultiNodeStats ? "Fetching..." : "Fetch Usage"}
						</button>

						{#if Object.keys(multiNodeStats).length > 0}
							<label class="flex items-center gap-2 cursor-pointer">
								<input type="checkbox" bind:checked={aggregateUsage} class="cursor-pointer" />
								<span class="text-sm" style="color: var(--text);">Aggregate usage</span>
							</label>
						{/if}
					</div>
				</div>
			{/if}

			<Panel title="Indexes">
				<div class="table-wrapper">
					<table class="table">
						<thead>
							<tr>
								<th class="name-column">Name</th>
								<th>Keys</th>
								<th>Properties</th>
								<th class="shrink-column">Size</th>
								<th class="shrink-column">Usage</th>
								<th style="min-width: 300px">Details</th>
								{#if !readOnly}
									<th style="width: 150px">Actions</th>
								{/if}
							</tr>
						</thead>
						<tbody>
							{#each result.data as index (index.name)}
								{@const isLoading = loadingIndexes.has(index.name)}
								<tr class="group" class:opacity-50={isLoading}>
									<td class="name-cell">
										<span class="font-mono text-sm index-name" title={index.name}>{index.name}</span>
									</td>
									<td>
										{#if index.key}
											<div class="flex flex-wrap gap-2">
												{#each Object.entries(index.key) as [field, direction], i (i)}
													<span class="index-key">
														{field}: {direction === 1 ? "↑" : direction === -1 ? "↓" : direction}
													</span>
												{/each}
											</div>
										{:else}
											<span style="color: var(--text-darker)">-</span>
										{/if}
									</td>
									<td>
										<div class="flex flex-wrap gap-2">
											{#if index.stats?.building}
												<span class="badge badge-building">building</span>
											{/if}
											{#if index.hidden}
												<span class="badge badge-hidden">hidden</span>
											{/if}
											{#if index.unique}
												<span class="badge badge-unique">unique</span>
											{/if}
											{#if index.sparse}
												<span class="badge badge-sparse">sparse</span>
											{/if}
											{#if index.partialFilterExpression}
												<span class="badge badge-partial">partial</span>
											{/if}
											{#if !index.stats?.building && !index.hidden && !index.unique && !index.sparse && !index.partialFilterExpression}
												<span style="color: var(--text-darker)">-</span>
											{/if}
										</div>
									</td>
									<td>
										{#if index.size}
											<span class="text-sm whitespace-nowrap">{formatBytes(index.size)}</span>
										{:else}
											<span style="color: var(--text-darker)">-</span>
										{/if}
									</td>
									<td>
										{#if index.stats}
											{@const indexMultiNodeStats = Object.entries(multiNodeStats)
												.filter(([key]) => key.startsWith(`${index.name}::`))
												.map(([, stats]) => stats)}
											<div class="text-sm mt-1">
												{#if indexMultiNodeStats.length > 0}
													{#if aggregateUsage}
														{@const totalOps = indexMultiNodeStats.reduce((sum, stats) => sum + stats.ops, 0)}
														<div title="Aggregated across {indexMultiNodeStats.length} node(s)">
															{totalOps.toLocaleString()}
															<span class="text-xs" style="color: var(--text-darker)">
																({indexMultiNodeStats.length} node{indexMultiNodeStats.length > 1 ? "s" : ""})
															</span>
														</div>
													{:else}
														{#each indexMultiNodeStats as stats, i (i)}
															<div class="separate-stat" title={stats.host}>
																<span class="stat-host">{shortenedHostnames[stats.host] || stats.host}:</span>
																<span class="stat-value">{stats.ops.toLocaleString()}</span>
															</div>
														{/each}
													{/if}
												{:else}
													<div>{index.stats.ops.toLocaleString()}</div>
												{/if}
											</div>
										{:else}
											<span style="color: var(--text-darker)">-</span>
										{/if}
									</td>
									<td>
										<details class="cursor-pointer">
											<summary class="details-link">View full</summary>
											<div class="details-content">
												<JsonValue value={omit(index, ["stats"])} collapsed={false} />
											</div>
										</details>
									</td>
									{#if !readOnly}
										<td>
											{#if index.name !== "_id_"}
												<div class="flex gap-2 hidden group-hover:flex -my-2">
													<button
														class="btn btn-outline-light btn-sm"
														onclick={() => toggleHidden(index.name, index.hidden)}
														disabled={isLoading}
													>
														{index.hidden ? "Unhide" : "Hide"}
													</button>
													<button
														class="btn btn-outline-danger btn-sm"
														onclick={() => openDropModal(index.name)}
														disabled={isLoading}
													>
														Drop
													</button>
												</div>
											{/if}
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
{:catch err}
	<Panel title="Indexes">
		<div class="p-4">
			<p class="error">Error loading indexes: {err}</p>
		</div>
	</Panel>
{/await}

<Modal show={showDropModal} onclose={closeDropModal}>
	<p>
		Are you sure you want to drop the index <strong>{indexToDrop}</strong>?
	</p>
	<p class="text-sm mt-2" style="color: var(--text-darker)">
		This action cannot be undone. The index will need to be recreated if needed again.
	</p>
	{#snippet footer()}
		<button class="btn btn-default btn-sm" onclick={closeDropModal}>Cancel</button>
		<button class="btn btn-danger btn-sm" onclick={confirmDrop}>Drop Index</button>
	{/snippet}
</Modal>

<Modal show={showCreateModal} onclose={closeCreateModal} title="Create Index">
	<div class="space-y-4">
		<div>
			<label for="index-keys" class="block text-sm font-semibold mb-2" style="color: var(--text);">
				Index Keys (JSON) <span style="color: var(--error);">*</span>
			</label>
			<p class="text-xs mb-2" style="color: var(--text-darker);">
				Define the fields to index. Use 1 for ascending, -1 for descending. Example: <code>{"{"} "fieldName": 1 }</code>
			</p>
			<textarea
				id="index-keys"
				bind:value={indexKeys}
				rows="3"
				use:jsonTextarea
				placeholder={'{"fieldName": 1}'}
				class="w-full p-3 rounded border border-[var(--border-color)] bg-[var(--color-1)] font-mono text-sm focus:outline-none focus:ring-2"
				style="color: var(--text); --tw-ring-color: var(--link);"
			></textarea>
		</div>

		<div>
			<label for="index-name" class="block text-sm font-semibold mb-2" style="color: var(--text);">
				Index Name (Optional)
			</label>
			<p class="text-xs mb-2" style="color: var(--text-darker);">Leave empty to auto-generate based on fields</p>
			<input
				id="index-name"
				type="text"
				bind:value={indexName}
				placeholder="e.g., user_email_idx"
				class="w-full p-2 rounded border border-[var(--border-color)] bg-[var(--color-1)] text-sm focus:outline-none focus:ring-2"
				style="color: var(--text); --tw-ring-color: var(--link);"
			/>
		</div>

		<div class="grid grid-cols-2 gap-3">
			<label class="flex items-center gap-2 cursor-pointer">
				<input type="checkbox" bind:checked={indexUnique} class="cursor-pointer" />
				<span class="text-sm" style="color: var(--text);">Unique</span>
			</label>
			<label class="flex items-center gap-2 cursor-pointer">
				<input type="checkbox" bind:checked={indexSparse} class="cursor-pointer" />
				<span class="text-sm" style="color: var(--text);">Sparse</span>
			</label>
			<label class="flex items-center gap-2 cursor-pointer">
				<input type="checkbox" bind:checked={indexBackground} class="cursor-pointer" />
				<span class="text-sm" style="color: var(--text);">Background</span>
			</label>
		</div>

		<div>
			<label for="index-partial" class="block text-sm font-semibold mb-2" style="color: var(--text);">
				Partial Filter Expression (Optional)
			</label>
			<p class="text-xs mb-2" style="color: var(--text-darker);">
				Only index documents that match this filter. Example: <code>{"{"} "status": "active" }</code>
			</p>
			<textarea
				id="index-partial"
				bind:value={indexPartialFilterExpression}
				rows="2"
				use:jsonTextarea
				placeholder={'{"status": "active"}'}
				class="w-full p-3 rounded border border-[var(--border-color)] bg-[var(--color-1)] font-mono text-sm focus:outline-none focus:ring-2"
				style="color: var(--text); --tw-ring-color: var(--link);"
			></textarea>
		</div>

		<div>
			<label for="index-ttl" class="block text-sm font-semibold mb-2" style="color: var(--text);">
				TTL - Expire After Seconds (Optional)
			</label>
			<p class="text-xs mb-2" style="color: var(--text-darker);">
				Automatically delete documents after specified seconds (for TTL indexes)
			</p>
			<input
				id="index-ttl"
				type="number"
				bind:value={indexExpireAfterSeconds}
				placeholder="e.g., 3600"
				min="0"
				class="w-full p-2 rounded border border-[var(--border-color)] bg-[var(--color-1)] text-sm focus:outline-none focus:ring-2"
				style="color: var(--text); --tw-ring-color: var(--link);"
			/>
		</div>
	</div>

	{#snippet footer()}
		<button class="btn btn-default btn-sm" onclick={closeCreateModal} disabled={creatingIndex}>Cancel</button>
		<button class="btn btn-success btn-sm" onclick={confirmCreate} disabled={creatingIndex}>
			{creatingIndex ? "Creating..." : "Create Index"}
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

	.shrink-column {
		width: 1%;
		white-space: nowrap;
	}

	.name-column {
		width: 20%;
		min-width: 150px;
		max-width: 300px;
	}

	.name-cell {
		max-width: 300px;
	}

	.index-name {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.index-key {
		display: inline-flex;
		align-items: center;
		border-radius: 3px;
		padding: 4px 8px;
		font-size: 12px;
		font-family: monospace;
		background-color: var(--color-3);
		color: var(--text);
		border: 1px solid var(--color-4);
	}

	.badge-building {
		background-color: hsl(45, 100%, 50%);
		color: var(--text-inverse);
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.6;
		}
	}

	.badge-unique {
		background-color: var(--button-success);
		color: var(--text-lighter);
	}

	.badge-sparse {
		background-color: hsl(38, 92%, 50%);
		color: var(--text-inverse);
	}

	.badge-partial {
		background-color: hsl(220, 70%, 55%);
		color: var(--text-lighter);
	}

	.badge-hidden {
		background-color: hsl(0, 0%, 40%);
		color: var(--text-lighter);
	}

	.btn-outline-light {
		background: transparent;
		color: var(--text);
		border-color: var(--color-4);
	}

	.btn-outline-light:hover {
		background-color: var(--color-3);
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
		font-family: monospace;
		font-size: 0.875rem;
		background-color: var(--color-1);
		border: 1px solid var(--border-color);
		max-width: 600px;
	}

	.stat-value {
		font-weight: 500;
	}

	.separate-stat {
		display: flex;
		gap: 6px;
		align-items: baseline;
		padding: 2px 0;
	}

	.stat-host {
		font-family: monospace;
		font-size: 11px;
		color: var(--text-darker);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 150px;
	}
</style>
