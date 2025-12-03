<script lang="ts">
	import { countDocumentsByTimeRange } from "$api/servers.remote";
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { clickOutside } from "$lib/actions/clickOutside";
	import { jsonTextarea } from "$lib/actions/jsonTextarea";
	import { portal } from "$lib/actions/portal";
	import IconChevronDown from "$lib/icons/IconChevronDown.svelte";
	import IconEdit from "$lib/icons/IconEdit.svelte";
	import type { SearchParams } from "$lib/types";
	import { formatNumber } from "$lib/utils/filters";
	import { tick } from "svelte";

	interface Props {
		params: SearchParams;
		editMode?: boolean;
		readonly: boolean;
		explainLoading?: boolean;
		onexplain?: () => void;
		server?: string;
		database?: string;
		collection?: string;
	}

	let {
		params = $bindable(),
		editMode = $bindable(false),
		readonly = $bindable(false),
		explainLoading = false,
		onexplain,
		server,
		database,
		collection,
	}: Props = $props();

	// Show optional fields - start with all hidden
	let showOptionalFields = $state(
		params.sort !== "{}" || params.project !== "{}" || params.skip !== 0 || params.limit !== 20,
	);

	let counter = $state(Math.random());

	let queryInput = $state<HTMLInputElement | HTMLTextAreaElement | undefined>(undefined);

	let showModeDropdown = $state(false);
	let modeButtonElement = $state<HTMLButtonElement>();
	let dropdownPosition = $state({ left: "0px", top: "0px", minWidth: "140px" });

	// Calculate dropdown position when shown
	$effect(() => {
		if (showModeDropdown && modeButtonElement) {
			tick().then(() => {
				if (!modeButtonElement) return;
				const rect = modeButtonElement.getBoundingClientRect();
				dropdownPosition = {
					left: `${rect.left}px`,
					top: `${rect.bottom + 5}px`,
					minWidth: `${rect.width}px`,
				};
			});
		}
	});

	// Disable edit mode when switching to aggregation or distinct mode
	$effect(() => {
		if ((params.mode === "aggregation" || params.mode === "distinct") && editMode) {
			editMode = false;
		}
	});

	$effect(() => {
		if (queryInput) {
			queryInput.setSelectionRange(1, 1 /* queryInput.value.length - 1 */);
			queryInput.focus();
		}
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		counter++;

		const formData = new FormData(form);

		await goto(
			resolve(
				(page.url.pathname +
					"?" +
					[...formData.entries()]
						.map((e) => encodeURIComponent(e[0]) + "=" + encodeURIComponent(e[1] as string))
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						.join("&")) as any,
			),
			{
				keepFocus: true,
			},
		);
	}

	function selectMode(newMode: "query" | "distinct" | "aggregation") {
		params.mode = newMode;
		showModeDropdown = false;

		// Initialize appropriate default values
		if (newMode === "aggregation" && !params.query?.trimStart().startsWith("[")) {
			params.query = "[]";
		} else if (newMode === "query" && params.query?.trimStart().startsWith("[")) {
			params.query = "{}";
		} else if (newMode === "distinct") {
			// When switching to distinct mode, reset field and use current query as filter
			params.field = undefined;
			if (!params.query || params.query.trim() === "") {
				params.query = "{}";
			} else if (params.query.trim() !== "{}") {
				// If there's a non-empty filter, show the optional fields
				showOptionalFields = true;
			}
		}
	}

	let form = $state<HTMLFormElement | undefined>(undefined);

	// New Docs dropdown state
	const TIME_RANGES = [
		{ label: "Last 24 hours", days: 1 },
		{ label: "Last 7 days", days: 7 },
		{ label: "Last 30 days", days: 30 },
		{ label: "Last 90 days", days: 90 },
		{ label: "Last 180 days", days: 180 },
	];

	let showNewDocsDropdown = $state(false);
	let newDocsButtonElement = $state<HTMLButtonElement>();
	let newDocsDropdownPosition = $state({ left: "0px", top: "0px", minWidth: "200px" });
	let isStatsLoading = $state(false);
	let stats = $state<Array<{ label: string; days: number; count: number | null; error: string | null }> | null>(null);

	// Calculate New Docs dropdown position when shown
	$effect(() => {
		if (showNewDocsDropdown && newDocsButtonElement) {
			tick().then(() => {
				if (!newDocsButtonElement) return;
				const rect = newDocsButtonElement.getBoundingClientRect();
				newDocsDropdownPosition = {
					left: `${rect.right - 200}px`,
					top: `${rect.bottom + 5}px`,
					minWidth: "200px",
				};
			});
		}
	});

	async function loadStats() {
		if (!server || !database || !collection || isStatsLoading) return;

		isStatsLoading = true;
		try {
			const result = await countDocumentsByTimeRange({
				server,
				database,
				collection,
				timeRanges: TIME_RANGES,
			});

			if (!result.error) {
				stats = result.data;
			}
		} finally {
			isStatsLoading = false;
		}
	}

	function toggleNewDocsDropdown() {
		showNewDocsDropdown = !showNewDocsDropdown;
		if (showNewDocsDropdown && stats === null) {
			loadStats();
		}
	}

	function selectTimeRange(days: number) {
		// Calculate the ObjectId for X days ago
		const now = Date.now();
		const daysInMs = days * 24 * 60 * 60 * 1000;
		const timestamp = Math.floor((now - daysInMs) / 1000);

		// Create ObjectId hex string from timestamp (first 4 bytes are timestamp)
		const objectIdHex = timestamp.toString(16).padStart(8, "0") + "0000000000000000";

		// Set the query with the ObjectId filter
		params.query = `{_id: {$gte: ObjectId("${objectIdHex}")}}`;
		params.mode = "query";
		showNewDocsDropdown = false;

		tick().then(() => {
			// Submit the form
			form?.requestSubmit();
		});
	}
</script>

<div class="rounded-2xl border border-[var(--border-color)] bg-[var(--light-background)]/70 shadow-sm p-3 sm:p-4">
	<form class="flex flex-col gap-3" method="GET" action="?" onsubmit={submit} bind:this={form}>
		<!-- Query input (always shown) -->
		<div class="flex items-stretch gap-2">
			<div
				class="flex-1 flex items-stretch rounded-xl border border-[var(--border-color)] overflow-hidden bg-[var(--color-3)]/50"
			>
				<!-- Mode selector dropdown -->
				<button
					type="button"
					bind:this={modeButtonElement}
					class="h-full px-3 flex items-center gap-1 text-[13px] border-r border-[var(--border-color)] hover:bg-[var(--color-3)] transition cursor-pointer"
					style="color: var(--text-secondary);"
					onclick={() => (showModeDropdown = !showModeDropdown)}
				>
					<span class="capitalize">{params.mode}</span>
					<IconChevronDown class="w-3 h-3" />
				</button>

				{#if params.mode === "aggregation"}
					<textarea
						bind:this={queryInput}
						bind:value={params.query}
						placeholder="[]"
						name="query"
						rows="5"
						use:jsonTextarea={{ onsubmit: () => form?.requestSubmit() }}
						class="w-full px-3 py-2 bg-transparent outline-none font-mono text-[13px] resize-y"
						style="color: var(--text);"
					></textarea>
				{:else if params.mode === "distinct"}
					<input
						type="text"
						bind:value={params.field}
						name="field"
						placeholder="field name"
						class="w-full h-9 px-3 bg-transparent outline-none font-mono text-[13px] border-0 !rounded-none"
						style="color: var(--text);"
					/>
				{:else}
					<input
						type="text"
						bind:this={queryInput}
						bind:value={params.query}
						placeholder={"{}"}
						name="query"
						class="w-full h-9 px-3 bg-transparent outline-none font-mono text-[13px] border-0 !rounded-none"
						style="color: var(--text);"
					/>
				{/if}
			</div>

			<input type="hidden" value={params.mode} name="mode" />
			<input type="hidden" value={counter} name="v" />

			<div class="flex items-center gap-2">
				{#if server && database && collection}
					<button
						type="button"
						bind:this={newDocsButtonElement}
						class="h-9 px-3 rounded-xl border border-[var(--border-color)] bg-[var(--light-background)] hover:bg-[var(--color-3)] transition cursor-pointer text-[13px] font-medium flex items-center gap-1"
						style="color: var(--text-secondary);"
						title="Filter by document creation time"
						onclick={toggleNewDocsDropdown}
					>
						<span>📊</span>
						<IconChevronDown class="w-3 h-3" />
					</button>
				{/if}
				<button
					type="button"
					class="h-9 px-3 rounded-xl border border-[var(--border-color)] bg-[var(--light-background)] hover:bg-[var(--color-3)] text-[15px] font-semibold leading-none transition cursor-pointer"
					style="color: var(--text);"
					title="Toggle optional fields"
					onclick={() => {
						showOptionalFields = !showOptionalFields;
					}}
				>
					{showOptionalFields ? "−" : "+"}
				</button>
				{#if !readonly}
					<button
						type="button"
						class="h-9 px-3 rounded-xl border border-[var(--border-color)] bg-[var(--light-background)] hover:bg-[var(--color-3)] transition disabled:opacity-50 cursor-pointer"
						style="color: var(--text);"
						title={params.mode !== "query" ? "Update not available in this mode" : "Update multiple documents"}
						disabled={params.mode !== "query"}
						onclick={() => {
							editMode = !editMode;
						}}
					>
						<IconEdit class="w-4 h-4" />
					</button>
				{/if}
				{#if onexplain}
					<button
						type="button"
						class="h-9 px-3 rounded-xl border border-[var(--border-color)] bg-[var(--light-background)] hover:bg-[var(--color-3)] transition disabled:opacity-50 cursor-pointer text-[13px] font-medium"
						style="color: var(--link);"
						title={params.mode === "distinct"
							? "Explain not available for distinct queries"
							: "Show query execution plan"}
						disabled={params.mode === "distinct" || explainLoading}
						onclick={onexplain}
					>
						{explainLoading ? "..." : "Explain"}
					</button>
				{/if}
				<button type="submit" class="h-9 px-4 py-0 rounded-xl btn btn-success text-lg font-semibold transition">
					Go
				</button>
			</div>
		</div>

		<!-- Optional fields -->
		{#if showOptionalFields}
			<div class="grid gap-2 sm:grid-cols-2">
				{#if params.mode === "distinct"}
					<!-- Distinct Filter -->
					<div
						class="rounded-xl border border-[var(--border-color)] overflow-hidden bg-[var(--color-3)]/50 sm:col-span-2"
					>
						<div
							class="px-3 py-1.5 text-[12px] border-b border-[var(--border-color)]"
							style="color: var(--text-secondary);"
						>
							Filter (optional)
						</div>
						<input
							type="text"
							bind:value={params.query}
							name="query"
							placeholder={"{}"}
							class="w-full h-9 px-3 bg-transparent outline-none font-mono text-[13px] border-0 !rounded-none"
							style="color: var(--text);"
						/>
					</div>
				{:else}
					<!-- Sort -->
					<div class="rounded-xl border border-[var(--border-color)] overflow-hidden bg-[var(--color-3)]/50">
						<div
							class="px-3 py-1.5 text-[12px] border-b border-[var(--border-color)]"
							style="color: var(--text-secondary);"
						>
							Sort
						</div>
						<input
							type="text"
							bind:value={params.sort}
							name="sort"
							placeholder={"{}"}
							class="w-full h-9 px-3 bg-transparent outline-none font-mono text-[13px] border-0 !rounded-none"
							style="color: var(--text);"
						/>
					</div>

					<!-- Project -->
					<div class="rounded-xl border border-[var(--border-color)] overflow-hidden bg-[var(--color-3)]/50">
						<div
							class="px-3 py-1.5 text-[12px] border-b border-[var(--border-color)]"
							style="color: var(--text-secondary);"
						>
							Project
						</div>
						<input
							type="text"
							bind:value={params.project}
							name="project"
							placeholder={"{}"}
							class="w-full h-9 px-3 bg-transparent outline-none font-mono text-[13px] border-0 !rounded-none"
							style="color: var(--text);"
						/>
					</div>
				{/if}

				<!-- Skip -->
				<div class="rounded-xl border border-[var(--border-color)] overflow-hidden bg-[var(--color-3)]/50">
					<div
						class="px-3 py-1.5 text-[12px] border-b border-[var(--border-color)]"
						style="color: var(--text-secondary);"
					>
						Skip
					</div>
					<input
						type="number"
						bind:value={params.skip}
						name="skip"
						min="0"
						class="w-full h-9 px-3 bg-transparent outline-none font-mono text-[13px] border-0 !rounded-none"
						style="color: var(--text);"
					/>
				</div>

				<!-- Limit -->
				<div class="rounded-xl border border-[var(--border-color)] overflow-hidden bg-[var(--color-3)]/50">
					<div
						class="px-3 py-1.5 text-[12px] border-b border-[var(--border-color)]"
						style="color: var(--text-secondary);"
					>
						Limit
					</div>
					<input
						type="number"
						bind:value={params.limit}
						name="limit"
						min="1"
						class="w-full h-9 px-3 bg-transparent outline-none font-mono text-[13px] border-0 !rounded-none"
						style="color: var(--text);"
					/>
				</div>
			</div>
		{/if}

		<!-- Help text -->
	</form>
</div>

<!-- Mode dropdown (rendered via portal to avoid overflow issues) -->
{#if showModeDropdown}
	<div
		use:portal
		use:clickOutside={() => (showModeDropdown = false)}
		class="fixed z-[1000] rounded-lg border border-[var(--border-color)] bg-[var(--light-background)] shadow-lg overflow-hidden"
		style:left={dropdownPosition.left}
		style:top={dropdownPosition.top}
		style:min-width={dropdownPosition.minWidth}
	>
		<button
			type="button"
			class="w-full px-3 py-2 text-left text-[13px] hover:bg-[var(--color-3)] transition cursor-pointer"
			style="color: var(--text);"
			onclick={() => selectMode("query")}
		>
			Query
		</button>
		<button
			type="button"
			class="w-full px-3 py-2 text-left text-[13px] hover:bg-[var(--color-3)] transition cursor-pointer"
			style="color: var(--text);"
			onclick={() => selectMode("distinct")}
		>
			Distinct
		</button>
		<button
			type="button"
			class="w-full px-3 py-2 text-left text-[13px] hover:bg-[var(--color-3)] transition cursor-pointer"
			style="color: var(--text);"
			onclick={() => selectMode("aggregation")}
		>
			Aggregation
		</button>
	</div>
{/if}

<!-- New Docs dropdown (rendered via portal to avoid overflow issues) -->
{#if showNewDocsDropdown}
	<div
		use:portal
		use:clickOutside={() => (showNewDocsDropdown = false)}
		class="fixed z-[1000] rounded-lg border border-[var(--border-color)] bg-[var(--light-background)] shadow-lg overflow-hidden"
		style:left={newDocsDropdownPosition.left}
		style:top={newDocsDropdownPosition.top}
		style:min-width={newDocsDropdownPosition.minWidth}
	>
		{#if isStatsLoading}
			<div class="px-3 py-2 text-[13px]" style="color: var(--text-secondary);">Loading...</div>
		{:else if stats && stats.length > 0}
			{#each stats as stat (stat.label)}
				<button
					type="button"
					class="w-full px-3 py-2 text-left text-[13px] hover:bg-[var(--color-3)] transition cursor-pointer flex justify-between items-center"
					style="color: var(--text);"
					onclick={() => selectTimeRange(stat.days)}
				>
					<span>{stat.label}</span>
					<span class="font-medium tabular-nums" style="color: var(--text-secondary);">
						{#if stat.error}
							⚠️
						{:else if stat.count !== null}
							{formatNumber(stat.count)}
						{:else}
							—
						{/if}
					</span>
				</button>
			{/each}
		{:else}
			<div class="px-3 py-2 text-[13px]" style="color: var(--text-secondary);">No data available</div>
		{/if}
	</div>
{/if}

<style lang="postcss">
	input[type="text"],
	input[type="number"],
	textarea {
		border-radius: 0 !important;
	}
</style>
