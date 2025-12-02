<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";

	const { class: className }: { class: string } = $props();

	const categories = $derived(
		((page.data.categories ?? []) as Array<{ key: string; label: string }>).map((x) => ({
			...x,
			href: page.url.pathname.split("/").slice(0, -1).join("/") + "/" + x.key,
		})),
	);
	const currentPath = $derived(page.url.pathname.split("/").pop());
</script>

{#if categories.length}
	<div
		class="hidden sm:flex rounded-lg border border-[var(--border-color)] overflow-hidden bg-[var(--light-background)] shadow-sm {className}"
	>
		{#each categories as category (category.key)}
			{@const isActive = currentPath === category.key}
			{#if isActive}
				<span
					class="px-3 py-1.5 text-[13px] font-medium bg-[var(--color-1)] shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)] cursor-default"
					style="color: var(--text);"
				>
					{category.label}
				</span>
			{:else}
				<!-- eslint-disable @typescript-eslint/no-explicit-any -->
				<!-- data-sveltekit-reload because sometimes, when on documents pages and switching to indexes page, I get an error -->
				<a
					data-sveltekit-reload
					href={resolve(category.href as any)}
					class="px-3 py-1.5 text-[13px] hover:bg-[var(--color-3)] transition no-underline"
					style="color: var(--text-secondary);"
				>
					{category.label}
				</a>
			{/if}
		{/each}
	</div>
{/if}
