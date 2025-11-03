<script lang="ts">
	interface Props {
		selectedNodes?: string[];
		customTags?: string;
		onchange?: (nodes: string[], tags: string) => void;
	}

	let {
		selectedNodes = $bindable([]),
		customTags = $bindable('{ nodeType: "READ_ONLY" }'),
		onchange,
	}: Props = $props();

	let primaryChecked = $state(selectedNodes.includes("primary"));
	let secondaryChecked = $state(selectedNodes.includes("secondary"));
	let showCustomTags = $state(false);

	$effect(() => {
		// Update selectedNodes based on checkboxes
		const nodes: string[] = [];
		if (primaryChecked) nodes.push("primary");
		if (secondaryChecked) nodes.push("secondary");
		if (showCustomTags) nodes.push("custom");
		selectedNodes = nodes;

		if (onchange) {
			onchange(nodes, showCustomTags ? customTags : "");
		}
	});
</script>

<div class="replica-set-selector">
	<div class="selector-header">
		<span class="selector-title">Replica Set Nodes</span>
		<span class="selector-subtitle">Select nodes to fetch index stats from</span>
	</div>

	<div class="selector-options">
		<label class="checkbox-label">
			<input type="checkbox" bind:checked={primaryChecked} />
			<span>Primary</span>
		</label>

		<label class="checkbox-label">
			<input type="checkbox" bind:checked={secondaryChecked} />
			<span>Secondary</span>
		</label>

		<label class="checkbox-label">
			<input type="checkbox" bind:checked={showCustomTags} />
			<span>Custom Tags</span>
		</label>
	</div>

	{#if showCustomTags}
		<div class="custom-tags-input">
			<label for="customTags" class="tags-label">Tag Filter (JSON):</label>
			<input
				id="customTags"
				type="text"
				bind:value={customTags}
				placeholder={'{ nodeType: "READ_ONLY" }'}
				class="tags-input"
			/>
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
		flex-wrap: wrap;
		gap: 16px;
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

	.custom-tags-input {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.tags-label {
		font-size: 13px;
		font-weight: 500;
		color: var(--text);
	}

	.tags-input {
		padding: 8px 12px;
		border-radius: 6px;
		border: 1px solid var(--border-color);
		background-color: var(--color-3);
		color: var(--text);
		font-family: monospace;
		font-size: 13px;
		outline: none;
	}

	.tags-input:focus {
		border-color: var(--button-primary);
		background-color: var(--color-1);
	}

	.tags-input::placeholder {
		color: var(--text-darker);
	}
</style>
