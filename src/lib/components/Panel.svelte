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

<div
	class="rounded-2xl border border-[var(--border-color)] bg-[var(--light-background)]/70 backdrop-blur-md shadow-sm {className}"
>
	{#if title}
		<div class="px-4 sm:px-6 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
			<div class="text-sm font-medium" style="color: var(--text);">
				{#if typeof title === "string"}
					<span>{title}</span>
				{:else}
					{@render title()}
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
