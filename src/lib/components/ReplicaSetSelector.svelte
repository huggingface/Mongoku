<script lang="ts">
	import { findBestSuffixMatch } from "$lib/utils/longestCommonSuffix";

	interface Props {
		availableNodes?: string[];
		selectedNodes?: string[];
		loading?: boolean;
		primaryNode?: string | null;
	}

	let {
		availableNodes = $bindable([]),
		selectedNodes = $bindable([]),
		loading = false,
		primaryNode = null,
	}: Props = $props();

	// Track which nodes are checked - sync with selectedNodes prop
	let nodeCheckedState = $derived.by(() =>
		Object.fromEntries(availableNodes.map((node) => [node, selectedNodes.includes(node)])),
	);

	// Find the actual primary node by matching the longest common suffix
	const matchedPrimaryNode = $derived.by(() => {
		if (!primaryNode || availableNodes.length === 0) return null;
		return findBestSuffixMatch(primaryNode, availableNodes);
	});

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
					<span class="node-name" title={node}>
						{node}
						{#if node === matchedPrimaryNode}
							<span class="primary-badge">PRIMARY</span>
						{/if}
					</span>
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
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.primary-badge {
		display: inline-block;
		padding: 2px 6px;
		background-color: hsl(210, 100%, 50%);
		color: white;
		border-radius: 3px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.5px;
		flex-shrink: 0;
	}
</style>
