<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		children?: Snippet;
		title?: string | Snippet;
		actions?: Snippet;
	}

	let { children, title, actions }: Props = $props();
</script>

<div class="panel rounded-md">
	{#if title}
		<div class="px-4 py-2 flex justify-between items-center text-lg uppercase font-medium group">
			{#if typeof title === "string"}
				<span>{title}</span>
			{:else}
				{@render title()}
			{/if}
			{#if actions}
				<div class="flex gap-2 items-center">
					{@render actions()}
				</div>
			{/if}
		</div>
	{/if}
	{@render children?.()}
</div>

<style lang="postcss">
	.panel {
		background-color: var(--color-2);
		border: var(--border);
	}
</style>
