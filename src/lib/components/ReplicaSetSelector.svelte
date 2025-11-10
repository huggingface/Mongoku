<script lang="ts">
	interface Props {
		availableNodes?: string[];
		selectedNodes?: string[];
		loading?: boolean;
	}

	let { availableNodes = $bindable([]), selectedNodes = $bindable([]), loading = false }: Props = $props();

	// Track which nodes are checked - sync with selectedNodes prop
	let nodeCheckedState = $derived.by(() =>
		Object.fromEntries(availableNodes.map((node) => [node, selectedNodes.includes(node)])),
	);

	function refreshSelectedNodes() {
		selectedNodes = Object.keys(nodeCheckedState).filter((node) => nodeCheckedState[node]);
	}
</script>

<div class="replica-set-selector">
	<div class="selector-header">
		<span class="selector-title">Replica Set Nodes</span>
		<span class="selector-subtitle">Select specific nodes to fetch index stats from</span>
	</div>

	{#if loading}
		<div class="loading-message">Loading nodes...</div>
	{:else if availableNodes.length === 0}
		<div class="no-nodes-message">No nodes found. Click "Fetch Usage" to load nodes.</div>
	{:else}
		<div class="selector-options">
			{#each availableNodes as node (node)}
				<label class="checkbox-label">
					<input type="checkbox" bind:checked={nodeCheckedState[node]} onchange={refreshSelectedNodes} />
					<span class="node-name" title={node}>{node}</span>
				</label>
			{/each}
		</div>
	{/if}
</div>

<style lang="postcss">
	.replica-set-selector {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		border-radius: 8px;
		background-color: var(--color-2);
		border: 1px solid var(--border-color);
	}

	.selector-header {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.selector-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
	}

	.selector-subtitle {
		font-size: 12px;
		color: var(--text-darker);
	}

	.selector-options {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-size: 14px;
		color: var(--text);
		user-select: none;
	}

	.checkbox-label input[type="checkbox"] {
		width: 16px;
		height: 16px;
		cursor: pointer;
		accent-color: var(--button-primary);
	}

	.loading-message,
	.no-nodes-message {
		padding: 12px;
		font-size: 13px;
		color: var(--text-darker);
		text-align: center;
		background-color: var(--color-3);
		border-radius: 4px;
	}

	.node-name {
		font-family: monospace;
		font-size: 13px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
