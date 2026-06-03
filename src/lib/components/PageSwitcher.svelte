<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { clickOutside } from "$lib/actions/clickOutside";
	import type { CollectionCategory } from "$lib/collectionCategories";
	import IconChevronDown from "$lib/icons/IconChevronDown.svelte";

	const { class: className }: { class: string } = $props();

	const categories = $derived(
		((page.data.categories ?? []) as CollectionCategory[]).map((x) => ({
			...x,
			href: page.url.pathname.split("/").slice(0, -1).join("/") + "/" + x.key,
		})),
	);
	const currentPath = $derived(page.url.pathname.split("/").pop());

	// Primary tabs stay inline; the rest collapse into a "More" dropdown.
	const primary = $derived(categories.filter((c) => c.primary));
	const secondary = $derived(categories.filter((c) => !c.primary));

	// If we're currently on a secondary tab, surface its label on the trigger.
	const activeSecondary = $derived(secondary.find((c) => c.key === currentPath));

	// We dropped `overflow-hidden` on the wrapper (it was clipping the dropdown),
	// so round the outer edges explicitly to keep the pill shape.
	const lastPrimaryKey = $derived(primary.at(-1)?.key);

	let menuOpen = $state(false);
</script>

{#if categories.length}
	<div
		class="hidden sm:flex items-stretch rounded-lg border border-[var(--border-color)] bg-[var(--light-background)] shadow-sm {className}"
	>
		{#each primary as category, i (category.key)}
			{@const isActive = currentPath === category.key}
			{@const edge = `${i === 0 ? "rounded-l-lg " : ""}${
				secondary.length === 0 && category.key === lastPrimaryKey ? "rounded-r-lg " : ""
			}`}
			{#if isActive}
				<span
					class="{edge}px-3 py-1.5 text-[13px] font-medium bg-[var(--color-1)] shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)] cursor-default"
					style="color: var(--text);"
				>
					{category.label}
				</span>
			{:else}
				<!-- data-sveltekit-reload because sometimes, when on documents pages and switching to indexes page, I get an error -->
				<!-- eslint-disable @typescript-eslint/no-explicit-any -->
				<a
					data-sveltekit-reload
					href={resolve(category.href as any)}
					class="{edge}px-3 py-1.5 text-[13px] hover:bg-[var(--color-3)] transition no-underline"
					style="color: var(--text-secondary);"
				>
					{category.label}
				</a>
			{/if}
		{/each}

		{#if secondary.length}
			<span class="self-stretch w-px bg-[var(--border-color)]" aria-hidden="true"></span>

			<div class="relative flex" use:clickOutside={() => (menuOpen = false)}>
				<button
					type="button"
					onclick={() => (menuOpen = !menuOpen)}
					class="flex items-center gap-1 rounded-r-lg px-3 py-1.5 text-[13px] hover:bg-[var(--color-3)] transition cursor-pointer"
					class:font-medium={activeSecondary}
					style="color: {activeSecondary ? 'var(--text)' : 'var(--text-secondary)'}; background: {activeSecondary
						? 'var(--color-1)'
						: 'transparent'};"
					aria-haspopup="menu"
					aria-expanded={menuOpen}
					title="More views"
				>
					{activeSecondary?.label ?? "More"}
					<IconChevronDown class="w-3.5 h-3.5 transition-transform {menuOpen ? 'rotate-180' : ''}" />
				</button>

				{#if menuOpen}
					<div
						class="absolute right-0 top-full mt-1 min-w-[10rem] rounded-lg border border-[var(--border-color)] bg-[var(--light-background)] shadow-lg overflow-hidden z-50"
						role="menu"
					>
						{#each secondary as category (category.key)}
							{@const isActive = currentPath === category.key}
							<!-- data-sveltekit-reload mirrors the primary tabs above -->
							<!-- eslint-disable @typescript-eslint/no-explicit-any -->
							<a
								data-sveltekit-reload
								href={resolve(category.href as any)}
								role="menuitem"
								onclick={() => (menuOpen = false)}
								class="flex items-center justify-between gap-3 px-3 py-1.5 text-[13px] no-underline hover:bg-[var(--color-3)] transition"
								style="color: {isActive ? 'var(--text)' : 'var(--text-secondary)'};"
								class:font-medium={isActive}
							>
								{category.label}
								{#if isActive}
									<span class="text-[var(--link)]" aria-hidden="true">✓</span>
								{/if}
							</a>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
