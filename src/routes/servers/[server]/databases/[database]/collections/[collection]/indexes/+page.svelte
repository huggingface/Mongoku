<script lang="ts">
	import {
		dropIndex as dropIndexCommand,
		getIndexStatsWithReadPreference,
		hideIndex as hideIndexCommand,
		unhideIndex as unhideIndexCommand,
	} from "$api/servers.remote";
	import { page } from "$app/state";
	import JsonValue from "$lib/components/JsonValue.svelte";
	import Modal from "$lib/components/Modal.svelte";
	import Panel from "$lib/components/Panel.svelte";
	import ReplicaSetSelector from "$lib/components/ReplicaSetSelector.svelte";
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
	let showReplicaSetSelector = $state(false);
	let selectedNodes = $state<string[]>([]);
	let customTags = $state('{ nodeType: "READ_ONLY" }');
	let delaySeconds = $state(30);
	let multiNodeStats = $state<Record<string, { ops: number; since: Date; host: string; readPreference: string }>>({});
	let loadingMultiNodeStats = $state(false);
	let measuringDelta = $state(false);
	let progressPercent = $state(0);
	let progressInterval: ReturnType<typeof setInterval> | null = null;

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

	async function fetchMultiNodeStats() {
		const { server, database, collection } = page.params;
		if (!server || !database || !collection) return;

		// Clear any existing progress interval
		if (progressInterval) {
			clearInterval(progressInterval);
			progressInterval = null;
		}

		loadingMultiNodeStats = true;
		measuringDelta = false;
		progressPercent = 0;
		multiNodeStats = {};

		try {
			// Fetch stats from selected nodes - FIRST FETCH
			const requests = [
				...(selectedNodes.includes("primary")
					? [
							{
								promise: getIndexStatsWithReadPreference({
									server,
									database,
									collection,
									readPreferenceMode: "primary",
								}),
								readPreference: "primary",
							},
						]
					: []),
				...(selectedNodes.includes("secondary")
					? [
							{
								promise: getIndexStatsWithReadPreference({
									server,
									database,
									collection,
									readPreferenceMode: "secondary",
								}),
								readPreference: "secondary",
							},
						]
					: []),
				...(selectedNodes.includes("custom") || (customTags && customTags.trim() && !selectedNodes.length)
					? [
							{
								promise: getIndexStatsWithReadPreference({
									server,
									database,
									collection,
									readPreferenceMode: "nearest",
									readPreferenceTags: customTags,
								}),
								readPreference: `tags: ${customTags}`,
							},
						]
					: []),
			];

			const results = await Promise.all(requests.map((r) => r.promise));

			// Store initial stats and track hosts
			const initialStats: Record<string, { ops: number; since: Date; host: string; readPreference: string }> = {};
			const hostsToQuery: string[] = [];

			for (let i = 0; i < results.length; i++) {
				const result = results[i];
				const readPreference = requests[i].readPreference;

				if (result.error) {
					notificationStore.notifyError(result.error, "Failed to fetch stats");
					continue;
				}

				// Store initial stats by index name and host
				for (const [indexName, stats] of Object.entries(result.data)) {
					const typedStats = stats as { ops: number; since: Date; host: string };
					const key = `${indexName}::${typedStats.host}`;
					initialStats[key] = { ...typedStats, readPreference };

					// Track unique hosts
					if (!hostsToQuery.includes(typedStats.host)) {
						hostsToQuery.push(typedStats.host);
					}
				}
			}

			if (Object.keys(initialStats).length === 0) {
				notificationStore.notifyError("No stats found", "No index stats found for selected nodes");
				loadingMultiNodeStats = false;
				return;
			}

			notificationStore.notifySuccess(`Initial fetch complete. Waiting ${delaySeconds}s to measure delta...`);
			loadingMultiNodeStats = false;
			measuringDelta = true;

			// Start progress bar
			const startTime = Date.now();
			const totalMs = delaySeconds * 1000;
			progressInterval = setInterval(() => {
				const elapsed = Date.now() - startTime;
				progressPercent = Math.min((elapsed / totalMs) * 100, 100);

				if (progressPercent >= 100) {
					if (progressInterval) clearInterval(progressInterval);
				}
			}, 100);

			// Wait for the configured delay
			await new Promise((resolve) => setTimeout(resolve, totalMs));

			// SECOND FETCH - from specific hosts
			const secondRequests = hostsToQuery.map((host) => ({
				promise: getIndexStatsWithReadPreference({
					server,
					database,
					collection,
					targetHost: host,
				}),
				host,
			}));

			const secondResults = await Promise.all(secondRequests.map((r) => r.promise));

			// Calculate deltas
			const deltaStats: Record<string, { ops: number; since: Date; host: string; readPreference: string }> = {};

			for (let i = 0; i < secondResults.length; i++) {
				const result = secondResults[i];
				const host = secondRequests[i].host;

				if (result.error) {
					notificationStore.notifyError(result.error, `Failed to fetch stats from ${host}`);
					continue;
				}

				// Calculate delta for each index
				for (const [indexName, stats] of Object.entries(result.data)) {
					const typedStats = stats as { ops: number; since: Date; host: string };
					const key = `${indexName}::${typedStats.host}`;
					const initial = initialStats[key];

					if (initial) {
						const delta = typedStats.ops - initial.ops;
						deltaStats[key] = {
							ops: delta,
							since: initial.since,
							host: typedStats.host,
							readPreference: initial.readPreference,
						};
					}
				}
			}

			multiNodeStats = deltaStats;
			notificationStore.notifySuccess(`Delta measurement complete! Showing usage increase over ${delaySeconds}s`);
		} catch (error) {
			notificationStore.notifyError(error, "Failed to fetch multi-node usage");
		} finally {
			loadingMultiNodeStats = false;
			measuringDelta = false;
			progressPercent = 0;
			if (progressInterval) {
				clearInterval(progressInterval);
				progressInterval = null;
			}
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
		<!-- Replica Set Selector Section -->
		<div class="mb-4">
			<button class="btn btn-primary btn-sm mb-3" onclick={() => (showReplicaSetSelector = !showReplicaSetSelector)}>
				{showReplicaSetSelector ? "Hide" : "Show"} Multi-Node Usage
			</button>

			{#if showReplicaSetSelector}
				<ReplicaSetSelector bind:selectedNodes bind:customTags bind:delaySeconds />
				<button
					class="btn btn-primary btn-sm mt-3"
					onclick={fetchMultiNodeStats}
					disabled={loadingMultiNodeStats || measuringDelta || (selectedNodes.length === 0 && !customTags.trim())}
				>
					{loadingMultiNodeStats ? "Fetching..." : measuringDelta ? "Measuring..." : "Fetch Usage Delta"}
				</button>

				{#if measuringDelta}
					<div class="progress-bar-container mt-3">
						<div class="progress-bar-label">
							Measuring delta... {Math.round(progressPercent)}% ({Math.round((delaySeconds * progressPercent) / 100)}s / {delaySeconds}s)
						</div>
						<div class="progress-bar">
							<div class="progress-bar-fill" style="width: {progressPercent}%"></div>
						</div>
					</div>
				{/if}
			{/if}
		</div>

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
										{@const indexMultiNodeStats = Object.entries(multiNodeStats)
											.filter(([key]) => key.startsWith(`${index.name}::`))
											.map(([, stats]) => stats)}
										<div class="text-sm mt-1">
											{#if indexMultiNodeStats.length > 0}
												{#each indexMultiNodeStats as stats, i (i)}
													{#if i > 0}<span> + </span>{/if}
													<span class="stat-value" title={`${stats.host} (${stats.readPreference})`}>
														{stats.ops.toLocaleString()}
													</span>
												{/each}
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
		border-bottom: 1px dotted var(--text);
		cursor: help;
	}

	.progress-bar-container {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.progress-bar-label {
		font-size: 13px;
		color: var(--text);
	}

	.progress-bar {
		height: 24px;
		background-color: var(--color-3);
		border-radius: 6px;
		border: 1px solid var(--border-color);
		overflow: hidden;
		position: relative;
	}

	.progress-bar-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--button-primary), var(--button-success));
		transition: width 0.1s linear;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
