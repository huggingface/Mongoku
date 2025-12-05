<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		children?: Snippet;
		title?: string | Snippet;
		titleClass?: string;
		actions?: Snippet;
		class?: string;
		ref?: HTMLDivElement;
	}

	let { children, title, titleClass, actions, class: className, ref = $bindable() }: Props = $props();
</script>

<div
	bind:this={ref}
	class="rounded-2xl border border-[var(--border-color)] bg-[var(--light-background)]/70 shadow-sm {className}"
>
	{#if title || actions}
		<div
			class="px-3 sm:px-4 py-2 flex justify-between items-center {children
				? 'border-b border-[var(--border-color)]'
				: ''}"
		>
			<div class="text-sm font-medium {titleClass}" style="color: var(--text);">
				{#if typeof title === "string"}
					<span>{title}</span>
				{:else if title}
					{@render title()}
				{:else}
					<!-- to maintain the height of the panel title, for actions -->
					&nbsp;
				{/if}
			</div>
			{#if actions}
				<div class="flex gap-2 items-center">
					{@render actions()}
				</div>
			{/if}
		</div>
	{/if}
	{@render children?.()}
</div>
