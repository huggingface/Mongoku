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

<div>
	<form class="flex items-stretch w-full" method="GET" action="?" onsubmit={submit} bind:this={form}>
		<!-- Parameters group -->
		<div class="flex-grow">
			<!-- Query input (always shown) -->
			<div class="flex items-stretch w-full {isAggregation ? 'min-h-10' : 'h-10'}">
				<div
					class="min-w-[100px] flex justify-center items-center border border-[var(--color-4)] {!showOptionalFields
						? 'border-b rounded-bl-md'
						: 'border-b-0'} bg-[var(--color-1)] rounded-tl-md"
				>
					{isAggregation ? "Aggregation:" : "Query:"}
				</div>
				{#if isAggregation}
					<textarea
						bind:this={queryInput}
						bind:value={params.query}
						placeholder="[]"
						name="query"
						rows="5"
						use:jsonTextarea={{ onsubmit: () => form?.requestSubmit() }}
						class="flex-grow border-0 bg-[var(--color-3)] pl-2.5 font-mono py-2 resize-y"
					></textarea>
				{:else}
					<input
						type="text"
						bind:this={queryInput}
						bind:value={params.query}
						placeholder={"{}"}
						name="query"
						class="flex-grow border-0 bg-[var(--color-3)] pl-2.5 font-mono"
					/>
				{/if}
			</div>

			<input type="hidden" value={counter} name="v" />
			<!-- Sort input -->
			{#if showOptionalFields}
				<div class="flex items-stretch w-full h-10">
					<div
						class="min-w-[100px] flex justify-center items-center border border-[var(--color-4)] border-b-0 bg-[var(--color-1)]"
					>
						Sort:
					</div>
					<input
						type="text"
						bind:value={params.sort}
						name="sort"
						placeholder={"{}"}
						class="flex-grow border-0 border-t border-[var(--color-4)] bg-[var(--color-3)] pl-2.5 font-mono"
					/>
				</div>

				<!-- Skip input -->
				<div class="flex items-stretch w-full h-10">
					<div
						class="min-w-[100px] flex justify-center items-center border border-[var(--color-4)] border-b-0 bg-[var(--color-1)]"
					>
						Skip:
					</div>
					<input
						type="number"
						bind:value={params.skip}
						name="skip"
						min="0"
						class="flex-grow border-0 border-t border-[var(--color-4)] bg-[var(--color-3)] pl-2.5 font-mono"
					/>
				</div>

				<!-- Limit input -->
				<div class="flex items-stretch w-full h-10">
					<div
						class="min-w-[100px] flex justify-center items-center border border-[var(--color-4)] border-b-0 bg-[var(--color-1)]"
					>
						Limit:
					</div>
					<input
						type="number"
						bind:value={params.limit}
						name="limit"
						min="1"
						class="flex-grow border-0 border-t border-[var(--color-4)] bg-[var(--color-3)] pl-2.5 font-mono"
					/>
				</div>

				<!-- Project input -->
				<div class="flex items-stretch w-full h-10">
					<div
						class="min-w-[100px] flex justify-center items-center border border-[var(--color-4)] border-b bg-[var(--color-1)] rounded-bl-md"
					>
						Project:
					</div>
					<input
						type="text"
						bind:value={params.project}
						name="project"
						placeholder={"{}"}
						class="flex-grow border-0 border-t border-[var(--color-4)] bg-[var(--color-3)] pl-2.5 font-mono"
					/>
				</div>
			{/if}
		</div>

		<!-- Toggle optional fields button -->
		<button
			class="btn btn-default !w-12 !rounded-none !border-r-0 text-2xl leading-none font-bold !py-1.5"
			type="button"
			onclick={() => {
				showOptionalFields = !showOptionalFields;
			}}
		>
			{showOptionalFields ? "−" : "+"}
		</button>

		<!-- Edit/Update button -->
		{#if !readonly}
			<button
				class="btn btn-default !w-12 !rounded-none !border-r-0 text-lg leading-none font-bold !py-1.5"
				type="button"
				title={isAggregation ? "Update not available in aggregation mode" : "Update multiple documents"}
				disabled={isAggregation}
				onclick={() => {
					editMode = !editMode;
				}}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
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

		<!-- Search button -->
		<button class="btn btn-success !rounded-l-none !rounded-r-md font-bold !py-1.5" type="submit"> GO! </button>
	</form>

	<!-- Help text when collapsed -->
	{#if !showOptionalFields && !isAggregation && params.query === "{}"}
		<div class="text-xs text-[var(--text-secondary,#888)] mt-1 ml-1">
			Tip: Use <code class="bg-[var(--color-3)] px-1 py-0.5 rounded font-mono">[{"{...}"}]</code> to switch to aggregation
			mode
		</div>
	{/if}
</div>

<style lang="postcss">
	input,
	textarea {
		border-radius: 0;
	}
</style>
