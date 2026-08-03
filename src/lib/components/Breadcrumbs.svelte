<script lang="ts">
	import { page } from "$app/state";
	import { resolve } from "$app/paths";
	import CollectionSwitcher from "$lib/components/CollectionSwitcher.svelte";
	import { breadcrumbs } from "$lib/stores/breadcrumbs.svelte";

	// The breadcrumb that names the current collection is replaced by a
	// switcher button (the whole crumb is clickable) so the user can hop to
	// another collection without going back to the collections list.
	const collectionLabel = $derived(page.params.collection ?? "");
</script>

{#if breadcrumbs.items.length > 0}
	<nav aria-label="Breadcrumb" class="hidden md:flex items-center gap-1 text-sm">
		{#each breadcrumbs.items as crumb, index (index)}
			{#if crumb.href && index < breadcrumbs.items.length - 1}
				<!-- eslint-disable @typescript-eslint/no-explicit-any -->
				<a
					href={resolve(crumb.href as any)}
					class="px-2 py-1 rounded-md hover:bg-[var(--color-3)] transition no-underline"
					style="color: var(--text);"
				>
					{crumb.label}
				</a>
			{:else if crumb.label === collectionLabel}
				<!-- The collection crumb is a switcher button; it carries aria-current itself. -->
				<CollectionSwitcher />
			{:else}
				<span aria-current="page" class="px-2 py-1 rounded-md font-medium" style="color: var(--text);">
					{crumb.label}
				</span>
			{/if}
			{#if index < breadcrumbs.items.length - 1}
				<span style="color: var(--text-secondary);">/</span>
			{/if}
		{/each}
	</nav>
{/if}
