<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";

	interface BreadcrumbItem {
		label: string;
		href?: string;
	}

	const breadcrumbs = $derived.by(() => {
		const list = (page.data.breadcrumbs ?? []) as Array<{ label: string; path: string }>;

		return list.reduce<BreadcrumbItem[]>(
			(prev, curr) => [...prev, { label: curr.label, href: `${prev.at(-1)?.href ?? ""}${curr.path}` }],
			[],
		);
	});
</script>

{#if breadcrumbs.length > 0}
	<nav aria-label="Breadcrumb" class="hidden md:flex items-center gap-1 text-sm">
		{#each breadcrumbs as crumb, index (index)}
			{#if crumb.href && index < breadcrumbs.length - 1}
				<!-- eslint-disable @typescript-eslint/no-explicit-any -->
				<a
					href={resolve(crumb.href as any)}
					class="px-2 py-1 rounded-md hover:bg-[var(--color-3)] transition no-underline"
					style="color: var(--text);"
				>
					{crumb.label}
				</a>
			{:else}
				<span aria-current="page" class="px-2 py-1 rounded-md font-medium" style="color: var(--text);">
					{crumb.label}
				</span>
			{/if}
			{#if index < breadcrumbs.length - 1}
				<span style="color: var(--text-secondary);">/</span>
			{/if}
		{/each}
	</nav>
{/if}
