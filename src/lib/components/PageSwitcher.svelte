<script lang="ts">
	import { countDocumentsByTimeRange } from "$api/servers.remote";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import IconChevronDown from "$lib/icons/IconChevronDown.svelte";
	import { formatNumber } from "$lib/utils/filters";

	const { class: className }: { class: string } = $props();

	const categories = $derived(
		((page.data.categories ?? []) as Array<{ key: string; label: string }>).map((x) => ({
			...x,
			href: page.url.pathname.split("/").slice(0, -1).join("/") + "/" + x.key,
		})),
	);
	const currentPath = $derived(page.url.pathname.split("/").pop());

	// Check if we're on a collection page
	const collectionContext = $derived.by(() => {
		const pageData = page.data as { server?: string; database?: string; collection?: string };
		if (pageData.server && pageData.database && pageData.collection) {
			return {
				server: pageData.server,
				database: pageData.database,
				collection: pageData.collection,
			};
		}
		return null;
	});

	const TIME_RANGES = [
		{ label: "Last 24 hours", days: 1 },
		{ label: "Last 7 days", days: 7 },
		{ label: "Last 30 days", days: 30 },
		{ label: "Last 90 days", days: 90 },
		{ label: "Last 180 days", days: 180 },
	];

	let isStatsOpen = $state(false);
	let isStatsLoading = $state(false);
	let stats = $state<Array<{ label: string; days: number; count: number | null; error: string | null }> | null>(null);
	let statsError = $state<string | null>(null);

	async function loadStats() {
		if (!collectionContext || isStatsLoading) return;

		isStatsLoading = true;
		statsError = null;
		try {
			const result = await countDocumentsByTimeRange({
				server: collectionContext.server,
				database: collectionContext.database,
				collection: collectionContext.collection,
				timeRanges: TIME_RANGES,
			});

			if (result.error) {
				statsError = result.error;
				stats = null;
			} else {
				stats = result.data;
			}
		} catch (err) {
			statsError = err instanceof Error ? err.message : String(err);
			stats = null;
		} finally {
			isStatsLoading = false;
		}
	}
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

		{#if collectionContext}
			<div class="relative border-l border-[var(--border-color)]">
				<button
					onclick={(e) => {
						e.stopPropagation();
						isStatsOpen = !isStatsOpen;
						if (isStatsOpen) loadStats();
					}}
					class="px-3 py-1.5 text-[13px] hover:bg-[var(--color-3)] transition flex items-center gap-1.5"
					style="color: var(--text-secondary);"
				>
					<span>📊</span>
					<span>New Docs</span>
					<IconChevronDown class="w-3 h-3 transition-transform {isStatsOpen ? 'rotate-180' : ''}" />
				</button>

				{#if isStatsOpen}
					<div
						class="fixed p-3 border border-[var(--border-color)] rounded-lg shadow-xl min-w-[220px] bg-white dark:bg-gray-800"
						style="z-index: 9999; top: 56px; right: 80px;"
					>
						{#if isStatsLoading}
							<div class="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-300">
								<span class="animate-spin">⏳</span>
								<span>Loading...</span>
							</div>
						{:else if statsError}
							<div class="text-[13px] text-red-600 dark:text-red-400">
								⚠️ {statsError}
							</div>
						{:else if stats && stats.length > 0}
							<div class="space-y-2">
								{#each stats as stat (stat.label)}
									<div class="flex justify-between items-center text-[13px]">
										<span class="text-gray-600 dark:text-gray-300">{stat.label}</span>
										<span class="font-semibold tabular-nums text-gray-900 dark:text-white">
											{#if stat.error}
												<span title={stat.error}>⚠️</span>
											{:else if stat.count !== null}
												{formatNumber(stat.count)}
											{:else}
												—
											{/if}
										</span>
									</div>
								{/each}
							</div>
						{:else}
							<div class="text-[13px] text-gray-600 dark:text-gray-300">No data available</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
