<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		children?: Snippet;
		title?: string | Snippet;
		actions?: Snippet;
		class?: string;
	}

	let { children, title, actions, class: className }: Props = $props();
</script>

<div class="panel rounded-md {className}">
	{#if title}
		<div class="px-4 py-2 flex justify-between items-center text-lg uppercase font-medium">
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
		background-color: var(--light-background);
		border: var(--border);
	}
</style>
