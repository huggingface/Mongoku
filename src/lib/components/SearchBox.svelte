<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { jsonTextarea } from "$lib/actions/jsonTextarea";
	import type { SearchParams } from "$lib/types";

	interface Props {
		params: SearchParams;
		editMode?: boolean;
		readonly: boolean;
	}

	let { params = $bindable(), editMode = $bindable(false), readonly = $bindable(false) }: Props = $props();

	// Show optional fields - start with all hidden
	let showOptionalFields = $state(
		params.sort !== "{}" || params.project !== "{}" || params.skip !== 0 || params.limit !== 20,
	);

	let counter = $state(Math.random());

	let queryInput = $state<HTMLInputElement | HTMLTextAreaElement | undefined>(undefined);

	// Detect if query is an aggregation (starts with [)
	let isAggregation = $derived(params.query?.trimStart().startsWith("["));

	// Disable edit mode when switching to aggregation mode
	$effect(() => {
		if (isAggregation && editMode) {
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

	let form = $state<HTMLFormElement | undefined>(undefined);
</script>

<div class="rounded-2xl border border-[var(--border-color)] bg-[var(--light-background)]/70 shadow-sm p-3 sm:p-4">
	<form class="flex flex-col gap-3" method="GET" action="?" onsubmit={submit} bind:this={form}>
		<!-- Query input (always shown) -->
		<div class="flex items-stretch gap-2">
			<div
				class="flex-1 flex items-stretch rounded-xl border border-[var(--border-color)] overflow-hidden bg-[var(--color-3)]/50"
			>
				<div
					class="px-3 flex items-center text-[13px] border-r border-[var(--border-color)]"
					style="color: var(--text-secondary);"
				>
					{isAggregation ? "Aggregation" : "Query"}
				</div>
				{#if isAggregation}
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

			<input type="hidden" value={counter} name="v" />

			<div class="flex items-center gap-2">
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
						title={isAggregation ? "Update not available in aggregation mode" : "Update multiple documents"}
						disabled={isAggregation}
						onclick={() => {
							editMode = !editMode;
						}}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
							<path d="m15 5 4 4"></path>
						</svg>
					</button>
				{/if}
				<button
					type="submit"
					class="h-9 px-4 rounded-xl bg-[var(--button-success)] text-white font-semibold transition cursor-pointer hover:bg-[var(--button-success-l)] active:brightness-95"
				>
					Go
				</button>
			</div>
		</div>

		<!-- Optional fields -->
		{#if showOptionalFields}
			<div class="grid gap-2 sm:grid-cols-2">
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
		{#if !showOptionalFields && !isAggregation && params.query === "{}"}
			<div class="text-xs" style="color: var(--text-secondary);">
				Tip: Use <code class="px-1.5 py-0.5 rounded bg-[var(--color-3)] border border-[var(--border-color)] font-mono"
					>[{"{...}"}]</code
				> to switch to aggregation mode
			</div>
		{/if}
	</form>
</div>

<style lang="postcss">
	input[type="text"],
	input[type="number"],
	textarea {
		border-radius: 0 !important;
	}
</style>
