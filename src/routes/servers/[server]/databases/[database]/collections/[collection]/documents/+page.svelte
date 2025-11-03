<script lang="ts">
	import {
		deleteDocument as deleteDocumentCommand,
		insertDocument as insertDocumentCommand,
		loadDocuments,
		updateDocument as updateDocumentCommand,
		updateMany as updateManyCommand,
	} from "$api/servers.remote";
	import { pushState } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { jsonTextarea } from "$lib/actions/jsonTextarea";
	import Panel from "$lib/components/Panel.svelte";
	import PrettyJson from "$lib/components/PrettyJson.svelte";
	import SearchBox from "$lib/components/SearchBox.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import type { MongoDocument, SearchParams } from "$lib/types";
	import { formatNumber } from "$lib/utils/filters";
	import { parseJSON, serializeForEditing } from "$lib/utils/jsonParser";
	import { SvelteURLSearchParams } from "svelte/reactivity";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	/* eslint-disable-next-line svelte/prefer-writable-derived */
	let params = $state<SearchParams>({ ...data.params });
	let dataPromise = $derived(data.results);
	let editMode = $state(false);
	let updateQuery = $state("{}");
	let isUpdating = $state(false);
	let showInsertEditor = $state(false);

	let finalCount = $state<number | null>(null);
	let countCount = 0;

	$effect(() => {
		params = { ...data.params };
	});

	$effect(() => {
		const currentCount = ++countCount;
		finalCount = null;
		data.count?.then((result) => {
			if (currentCount !== countCount) {
				return;
			}
			finalCount = result.error ? null : result.data;
		});
	});

	// Handle errors from streamed promises
	$effect(() => {
		// @ts-expect-error I just want to trigger the dependency
		if (dataPromise) {
			modifiedItems = null;
		}
		dataPromise?.then((result) => {
			if (result.error) {
				notificationStore.notifyError(result.error);
			}
		});
	});

	$effect(() => {
		data.count?.then((result) => {
			// Don't show notification for timeout errors - they're displayed in the UI
			if (result.error && !result.error.includes("operation exceeded time limit")) {
				notificationStore.notifyError(result.error);
			}
		});
	});

	let modifiedItems = $state<MongoDocument[] | null>(null);
	let items = $derived(modifiedItems ? { data: modifiedItems, error: null } : dataPromise);

	async function editDocument(_id: { $value?: string } | undefined, json: MongoDocument, items: MongoDocument[]) {
		const partial = Boolean(
			params.project && params.project !== "{}" && Object.keys(parseJSON(params.project) as object).length > 0,
		);
		const newId = json?._id?.$value;
		const oldId = _id?.$value;

		if (newId !== oldId) {
			notificationStore.notifyError("ObjectId changed. This is not supported, update canceled.");
			return;
		}

		if (!oldId) return;

		try {
			const result = await updateDocumentCommand({
				server: data.server,
				database: data.database,
				collection: data.collection,
				document: oldId,
				value: json,
				partial,
			});

			if (result.ok) {
				notificationStore.notifySuccess("Document updated successfully");
				// Update the document in the list
				const index = items.findIndex((item) => item._id?.$value === oldId);
				if (index !== -1) {
					items[index] = result.update;
				}
				modifiedItems = items;
			}
		} catch (error) {
			console.error(error);
			notificationStore.notifyError(error, "Failed to update document");
		}
	}

	async function removeDocument(_id: { $value?: string } | undefined, items: MongoDocument[]) {
		const documentId = _id?.$value;
		if (!documentId) return;

		try {
			await deleteDocumentCommand({
				server: data.server,
				database: data.database,
				collection: data.collection,
				document: documentId,
			});

			notificationStore.notifySuccess("Document removed successfully");
			modifiedItems = items.filter((item) => item._id?.$value !== documentId);
		} catch (error) {
			notificationStore.notifyError(error, "Failed to remove document");
		}
	}

	function buildUrl(skip: number) {
		const queryParams = new SvelteURLSearchParams();
		queryParams.set("query", params.query || "{}");
		queryParams.set("sort", params.sort || "");
		queryParams.set("project", params.project || "");
		queryParams.set("skip", String(skip));
		queryParams.set("limit", String(params.limit));

		return `/servers/${encodeURIComponent(data.server)}/databases/${encodeURIComponent(data.database)}/collections/${encodeURIComponent(data.collection)}/documents?${queryParams.toString()}`;
	}

	const nextUrl = $derived(buildUrl(params.skip + params.limit));
	const previousUrl = $derived(buildUrl(Math.max(0, params.skip - params.limit)));

	function navigateNext(e: MouseEvent) {
		e.preventDefault();
		data.params.skip += data.params.limit;
		params.skip = data.params.skip;
		/* eslint-disable-next-line svelte/no-navigation-without-resolve */
		pushState(nextUrl, {});
		dataPromise = loadDocuments({
			server: data.server,
			database: data.database,
			collection: data.collection,
			query: params.query,
			sort: params.sort,
			project: params.project,
			skip: params.skip,
			limit: params.limit,
		});
	}

	function navigatePrevious(e: MouseEvent) {
		e.preventDefault();
		data.params.skip = Math.max(0, data.params.skip - data.params.limit);
		params.skip = data.params.skip;
		/* eslint-disable-next-line svelte/no-navigation-without-resolve */
		pushState(previousUrl, {});
		dataPromise = loadDocuments({
			server: data.server,
			database: data.database,
			collection: data.collection,
			query: params.query,
			sort: params.sort,
			project: params.project,
			skip: params.skip,
			limit: params.limit,
		});
	}

	async function executeUpdateMany() {
		isUpdating = true;
		try {
			const result = await updateManyCommand({
				server: data.server,
				database: data.database,
				collection: data.collection,
				filter: params.query || "{}",
				update: updateQuery,
			});

			if (result.ok) {
				notificationStore.notifySuccess(`Updated ${result.modifiedCount} document(s) (matched ${result.matchedCount})`);
				// Reset the modified items to force a refresh
				modifiedItems = null;
				editMode = false;
			}
		} catch (error) {
			console.error(error);
			notificationStore.notifyError(error, "Failed to update documents");
		} finally {
			isUpdating = false;
		}
	}

	let insertJson = $state("{}");

	async function executeInsert() {
		isUpdating = true;
		try {
			const json = parseJSON(insertJson);
			const result = await insertDocumentCommand({
				server: data.server,
				database: data.database,
				collection: data.collection,
				document: null,
				value: json,
			});

			if (result.ok) {
				notificationStore.notifySuccess("Document inserted successfully");
				// Reset the modified items to force a refresh
				modifiedItems = null;
				showInsertEditor = false;
				insertJson = "{}";
			}
		} catch (error) {
			console.error(error);
			notificationStore.notifyError(error, "Failed to insert document");
		} finally {
			isUpdating = false;
		}
	}

	function handleInsertClick() {
		showInsertEditor = true;
		insertJson = "{}";
	}

	function cancelInsert() {
		showInsertEditor = false;
		insertJson = "{}";
	}

	function getReversedSort(): string {
		const currentSort = params.sort || "{}";

		// If no sort is defined, default to _id: -1
		if (currentSort.replace(/\s/g, "") === "{}") {
			return serializeForEditing({ _id: -1 })
				.replace(/[\n\t]/g, " ")
				.replace(/\s+/g, " ");
		}

		const sortObj = parseJSON(currentSort) as Record<string, unknown>;
		const reversedSort: Record<string, number> = {};

		// Reverse each sort field
		for (const [key, value] of Object.entries(sortObj)) {
			if (typeof value === "number") {
				reversedSort[key] = value === 1 ? -1 : 1;
			} else {
				// Keep non-numeric values as-is
				reversedSort[key] = value as number;
			}
		}

		// Serialize and compact the output (remove newlines and extra spaces)
		return serializeForEditing(reversedSort)
			.replace(/[\n\t]/g, " ")
			.replace(/\s+/g, " ");
	}

	function toggleSort(e: MouseEvent) {
		e.preventDefault();
		const newSort = getReversedSort();

		params.sort = newSort;
		data.params.sort = newSort;
		data.params.skip = 0;
		params.skip = 0;

		const queryParams = new SvelteURLSearchParams();
		queryParams.set("query", params.query || "{}");
		queryParams.set("sort", newSort);
		queryParams.set("project", params.project || "");
		queryParams.set("skip", "0");
		queryParams.set("limit", String(params.limit));

		const url = `/servers/${encodeURIComponent(data.server)}/databases/${encodeURIComponent(data.database)}/collections/${encodeURIComponent(data.collection)}/documents?${queryParams.toString()}`;

		/* eslint-disable-next-line svelte/no-navigation-without-resolve */
		pushState(url, {});
		dataPromise = loadDocuments({
			server: data.server,
			database: data.database,
			collection: data.collection,
			query: params.query,
			sort: newSort,
			project: params.project,
			skip: 0,
			limit: params.limit,
		});
	}
</script>

{#snippet previousButton(url: string, onClick: (e: MouseEvent) => void)}
	<!-- eslint-disable @typescript-eslint/no-explicit-any -->
	<a
		href={resolve(url as any)}
		onclick={onClick}
		class="px-3 py-1 rounded-lg border border-[var(--border-color)] bg-[var(--light-background)] hover:bg-[var(--color-3)] text-[13px] transition no-underline -my-2"
		style="color: var(--text);"
	>
		Previous
	</a>
{/snippet}

{#snippet nextButton(url: string, onClick: (e: MouseEvent) => void)}
	<!-- eslint-disable @typescript-eslint/no-explicit-any -->
	<a
		href={resolve(url as any)}
		onclick={onClick}
		class="px-3 py-1 rounded-lg border border-[var(--border-color)] bg-[var(--light-background)] hover:bg-[var(--color-3)] text-[13px] transition no-underline"
		style="color: var(--text);"
	>
		Next
	</a>
{/snippet}

{#snippet sortButton()}
	<button
		onclick={toggleSort}
		class="px-3 py-1 rounded-lg border border-[var(--border-color)] bg-[var(--light-background)] hover:bg-[var(--color-3)] text-[13px] transition"
		style="color: var(--text); cursor: pointer;"
		title="Reverse sort order"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="w-4 h-4"
		>
			<path d="M3 6h18" />
			<path d="M7 12h10" />
			<path d="M10 18h4" />
			<path d="m7 16 3 3 3-3" />
		</svg>
	</button>
{/snippet}

<SearchBox bind:params bind:editMode readonly={data.readOnly} />

{#if editMode}
	<Panel title="Edit Mode">
		<div class="p-4 sm:p-6 space-y-6">
			<!-- Insert Document Section -->
			<div class="rounded-xl bg-[var(--color-3)]/30 p-4 border border-[var(--border-color)]">
				<h3 class="text-lg font-semibold mb-3" style="color: var(--text);">Insert New Document</h3>
				{#if !showInsertEditor}
					<button class="btn btn-success" onclick={handleInsertClick}>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="w-4 h-4 inline mr-2"
						>
							<path d="M12 5v14M5 12h14" />
						</svg>
						Insert Document
					</button>
				{:else}
					<div class="space-y-3">
						<label for="insert-document" class="block text-sm font-semibold mb-2" style="color: var(--text);">
							Document JSON:
						</label>
						<textarea
							id="insert-document"
							bind:value={insertJson}
							placeholder="Document JSON"
							rows="6"
							use:jsonTextarea={{ onsubmit: executeInsert }}
							class="w-full p-3 rounded-xl border border-[var(--border-color)] bg-[var(--color-3)] font-mono text-sm focus:outline-none focus:ring-2"
							style="color: var(--text); --tw-ring-color: var(--link);"
						></textarea>
						<div class="flex gap-3">
							<button
								class="btn btn-success hover:bg-[var(--button-success-l)]"
								disabled={isUpdating}
								onclick={executeInsert}
							>
								{isUpdating ? "Inserting..." : "Insert"}
							</button>
							<button class="btn btn-default" onclick={cancelInsert} disabled={isUpdating}>Cancel</button>
						</div>
					</div>
				{/if}
			</div>

			<!-- Update Multiple Documents Section -->
			<div class="rounded-xl bg-[var(--color-3)]/30 p-4 border border-[var(--border-color)]">
				<h3 class="text-lg font-semibold mb-3" style="color: var(--text);">Update Multiple Documents</h3>
				<div class="space-y-4">
					<div>
						<label for="update-filter" class="block text-sm font-semibold mb-2" style="color: var(--text);">
							Filter (which documents to update):
						</label>
						<input
							type="text"
							id="update-filter"
							value={params.query || "{}"}
							readonly
							class="w-full p-3 rounded-xl border border-[var(--border-color)] bg-[var(--color-3)] font-mono text-sm opacity-75 cursor-not-allowed"
							style="color: var(--text);"
						/>
						<p class="text-xs mt-2" style="color: var(--text-secondary);">
							This filter is taken from the query above. Modify the query to change which documents will be updated.
						</p>
					</div>
					<div>
						<label for="update-operation" class="block text-sm font-semibold mb-2" style="color: var(--text);">
							Update Operation (e.g., $set, $inc, $unset):
						</label>
						<textarea
							bind:value={updateQuery}
							placeholder="Update operation"
							rows="4"
							use:jsonTextarea={{ onsubmit: executeUpdateMany }}
							class="w-full p-3 rounded-xl border border-[var(--border-color)] bg-[var(--color-3)] font-mono text-sm focus:outline-none focus:ring-2"
							style="color: var(--text); --tw-ring-color: var(--link);"
						></textarea>
					</div>
					<div class="flex gap-3">
						<button
							class="btn btn-success hover:bg-[var(--button-success-l)]"
							disabled={isUpdating}
							onclick={executeUpdateMany}
						>
							{isUpdating ? "Updating..." : "Execute Update"}
						</button>
					</div>
				</div>
			</div>

			<!-- Close Edit Mode -->
			<div class="flex justify-end">
				<button
					class="btn btn-default hover:bg-[var(--color-3)]"
					onclick={() => {
						editMode = false;
						showInsertEditor = false;
					}}
				>
					Close Edit Mode
				</button>
			</div>

			<!-- Update Operation Examples -->
			<div
				class="text-sm rounded-xl bg-[var(--color-3)]/50 p-4 border border-[var(--border-color)]"
				style="color: var(--text-secondary);"
			>
				<p class="mb-2 font-semibold" style="color: var(--text);">Update Operation Examples:</p>
				<p class="mb-2">
					• Set a field: <code
						class="bg-[var(--light-background)] px-2 py-1 rounded border border-[var(--border-color)] font-mono text-xs"
						>{'{"$set": {"status": "active"}}'}</code
					>
				</p>
				<p class="mb-2">
					• Increment a value: <code
						class="bg-[var(--light-background)] px-2 py-1 rounded border border-[var(--border-color)] font-mono text-xs"
						>{'{"$inc": {"count": 1}}'}</code
					>
				</p>
				<p>
					• Unset a field: <code
						class="bg-[var(--light-background)] px-2 py-1 rounded border border-[var(--border-color)] font-mono text-xs"
						>{'{"$unset": {"oldField": ""}}'}</code
					>
				</p>
			</div>
		</div>
	</Panel>
{/if}

{#await items}
	<Panel
		title={finalCount !== null
			? `${formatNumber(data.params.skip + 1)} - ${formatNumber(data.params.skip + data.params.limit)} of ${formatNumber(finalCount)} documents...`
			: "Loading documents..."}
		titleClass="py-1"
	>
		{#snippet actions()}
			{#if finalCount !== null}
				{#if data.params.skip > 0}
					{@render previousButton(previousUrl, navigatePrevious)}
				{/if}
				{#if data.params.skip + data.params.limit < finalCount}
					{@render nextButton(nextUrl, navigateNext)}
				{/if}
				{@render sortButton()}
			{/if}
		{/snippet}
	</Panel>
{:then resultsData}
	<!-- Sometimes resultsData is undefined when navigating to indexes page -->
	{@const items = resultsData?.data ?? []}
	{#await data.count}
		<Panel
			titleClass="py-1"
			title={items.length > 0
				? `${formatNumber(data.params.skip + 1)} - ${formatNumber(data.params.skip + items.length)} Documents (counting...)`
				: "No documents"}
		>
			{#snippet actions()}
				{#if data.params.skip > 0}
					{@render previousButton(previousUrl, navigatePrevious)}
				{/if}
				{#if items.length >= data.params.limit}
					{@render nextButton(nextUrl, navigateNext)}
				{/if}
				{@render sortButton()}
			{/snippet}
		</Panel>
	{:then countData}
		<!-- Sometimes data.params can be undefined when switching to indexes page-->
		{#if data.params}
			{@const count = countData.data}
			{@const hasNext = countData.error ? items.length >= data.params.limit : data.params.skip + items.length < count}
			{@const hasPrevious = data.params.skip > 0}
			{@const isTimeout = countData.error?.includes("operation exceeded time limit")}
			<Panel
				title={items.length > 0
					? count > 0
						? `${formatNumber(data.params.skip + 1)} - ${formatNumber(data.params.skip + items.length)} of ${formatNumber(count)} documents`
						: `${formatNumber(data.params.skip + 1)} - ${formatNumber(data.params.skip + items.length)} documents (count ${isTimeout ? "timeout" : "unavailable"})`
					: "No documents"}
				titleClass="py-1"
			>
				{#snippet actions()}
					{#if hasPrevious}
						{@render previousButton(previousUrl, navigatePrevious)}
					{/if}
					{#if hasNext}
						{@render nextButton(nextUrl, navigateNext)}
					{/if}
					{@render sortButton()}
				{/snippet}
			</Panel>
		{/if}
	{/await}

	{#each items as item, index (item._id?.$value || index)}
		<PrettyJson
			json={item}
			autoCollapse={true}
			onedit={data.isAggregation || data.readOnly ? undefined : (json) => editDocument(item._id, json, items)}
			onremove={data.isAggregation || data.readOnly ? undefined : () => removeDocument(item._id, items)}
			server={data.server}
			database={data.database}
			collection={data.collection}
			mappings={data.mappings}
		/>
	{/each}
{/await}
