<script lang="ts">
	import JsonValue from "$lib/components/JsonValue.svelte";
	import Panel from "$lib/components/Panel.svelte";

	const { data } = $props();

	const indexesData = $derived(data.indexes);
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
						<th>Name</th>
						<th>Keys</th>
						<th>Properties</th>
						<th style="width: 300px">Details</th>
					</tr>
				</thead>
				<tbody>
					{#each result.data as index (index.name)}
						<tr>
							<td>
								<span class="font-mono text-sm">{index.name}</span>
							</td>
							<td>
								{#if index.key}
									<div class="flex flex-wrap gap-2">
										{#each Object.entries(index.key) as [field, direction]}
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
									{#if index.unique}
										<span class="badge badge-unique">unique</span>
									{/if}
									{#if index.sparse}
										<span class="badge badge-sparse">sparse</span>
									{/if}
									{#if index.partialFilterExpression}
										<span class="badge badge-partial">partial</span>
									{/if}
									{#if !index.unique && !index.sparse && !index.partialFilterExpression}
										<span style="color: var(--text-darker)">-</span>
									{/if}
								</div>
							</td>
							<td>
								<details class="cursor-pointer">
									<summary class="details-link">View full</summary>
									<div class="details-content">
										<JsonValue value={index} collapsed={false} />
									</div>
								</details>
							</td>
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

<style lang="postcss">
	.table tbody td {
		vertical-align: top;
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
