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
	<div class="flex {className}">
		{#each categories as category, index (category.key)}
			{@const isActive = currentPath === category.key}
			<a
				href={isActive ? undefined : resolve(category.href as any)}
				class="btn btn-default btn-sm uppercase
					{index === 0 ? '' : 'rounded-l-none'}
					{index === categories.length - 1 ? '' : 'rounded-r-none'}
					{index > 0 ? '-ml-px' : ''}
					{isActive ? 'opacity-100 cursor-default pointer-events-none !bg-[var(--color-3)]' : ''}"
				aria-disabled={isActive}
			>
				{category.label}
			</a>
		{/each}
	</div>
{/if}
