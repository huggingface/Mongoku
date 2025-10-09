<script lang="ts">
	import type { SearchParams } from "$lib/types";

	interface Props {
		params: SearchParams;
	}

	let { params = $bindable() }: Props = $props();

	// Show optional fields - start with all hidden
	let showOptionalFields = $state(
		params.sort !== "{}" || params.project !== "{}" || params.skip !== 0 || params.limit !== 20,
	);
</script>

<form class="flex items-stretch w-full" method="GET" action="?">
	<!-- Parameters group -->
	<div class="flex-grow">
		<!-- Query input (always shown) -->
		<div class="flex items-stretch w-full h-10">
			<div
				class="min-w-[100px] flex justify-center items-center border border-[var(--color-4)] {!showOptionalFields
					? 'border-b rounded-bl-md'
					: 'border-b-0'} bg-[var(--color-1)] rounded-tl-md"
			>
				Query:
			</div>
			<input
				type="text"
				bind:value={params.query}
				placeholder={"{}"}
				name="query"
				class="flex-grow border-0 bg-[var(--color-3)] pl-2.5 font-mono"
			/>
		</div>

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

	<!-- Search button -->
	<button class="btn btn-success !rounded-l-none !rounded-r-md font-bold !py-1.5" type="submit"> GO! </button>
</form>

<style lang="postcss">
	input {
		border-radius: 0;
	}
</style>
