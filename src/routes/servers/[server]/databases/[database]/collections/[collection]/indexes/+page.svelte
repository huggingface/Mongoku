<script lang="ts">
	import {
		dropIndex as dropIndexCommand,
		hideIndex as hideIndexCommand,
		unhideIndex as unhideIndexCommand,
	} from "$api/servers.remote";
	import { page } from "$app/state";
	import JsonValue from "$lib/components/JsonValue.svelte";
	import Modal from "$lib/components/Modal.svelte";
	import Panel from "$lib/components/Panel.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import { formatBytes } from "$lib/utils/filters";
	import { omit } from "$lib/utils/omit.js";
	import type { PageData } from "./$types.js";

	const { data } = $props();

	const readOnly = $derived(data.readOnly);
	let resolvedIndexes = $state<Awaited<PageData["indexes"]> | null>(null);
	let loadingIndexes = $state<Set<string>>(new Set());
	let showDropModal = $state(false);
	let indexToDrop = $state<string | null>(null);

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
	{:else if result.data.length === 0}
		<Panel title="Indexes">
			<div class="text-center p-4" style="color: var(--text-darker)">No indexes found</div>
		</Panel>
	{:else}
		<Panel title="Indexes">
			<table class="table">
				<thead>
					<tr>
						<th class="shrink-column">Name</th>
						<th>Keys</th>
						<th>Properties</th>
						<th class="shrink-column">Size</th>
						<th class="shrink-column">Usage</th>
						<th style="min-width: 300px">Details</th>
						{#if !readOnly}
							<th style="width: 120px">Actions</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each result.data as index (index.name)}
						{@const isLoading = loadingIndexes.has(index.name)}
						<tr class="group" class:opacity-50={isLoading}>
							<td>
								<span class="font-mono text-sm">{index.name}</span>
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
									{#if !index.hidden && !index.unique && !index.sparse && !index.partialFilterExpression}
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
									<div class="text-sm mt-1">
										<div>{index.stats.ops.toLocaleString()}</div>
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
		</Panel>
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

<style lang="postcss">
	.table tbody td {
		vertical-align: top;
	}

	.shrink-column {
		width: 1%;
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
</style>
