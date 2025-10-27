<script lang="ts">
	import {
		deleteDocument as deleteDocumentCommand,
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
	import { SvelteURLSearchParams } from "svelte/reactivity";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	/* eslint-disable-next-line svelte/prefer-writable-derived */
	let params = $state<SearchParams>({ ...data.params });
	let dataPromise = $derived(data.results);
	let editMode = $state(false);
	let updateQuery = $state("{}");
	let isUpdating = $state(false);

	let finalCount = $state<number | null>(null);
	let countCount = 0;

	$effect(() => {
		params = { ...data.params };
	});

	$effect(() => {
		const currentCount = ++countCount;
		finalCount = null;
		data.count.then((result) => {
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
		dataPromise.then((result) => {
			if (result.error) {
				notificationStore.notifyError(result.error);
			}
		});
	});

	$effect(() => {
		data.count.then((result) => {
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
			params.project && params.project !== "{}" && Object.keys(JSON.parse(params.project)).length > 0,
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
			console.log(error);
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
</script>

<SearchBox bind:params bind:editMode readonly={data.readOnly} />

{#if editMode}
	<Panel title="Update Multiple Documents">
		<div class="p-4 space-y-4">
			<div>
				<label for="update-filter" class="block text-sm font-medium mb-2">Filter (which documents to update):</label>
				<input
					type="text"
					id="update-filter"
					value={params.query || "{}"}
					readonly
					class="w-full p-2 border border-[var(--color-4)] bg-[var(--light-background)] rounded font-mono text-sm opacity-75 cursor-not-allowed"
				/>
				<p class="text-xs text-[var(--text-secondary,#888)] mt-1">
					This filter is taken from the query above. Modify the query to change which documents will be updated.
				</p>
			</div>
			<div>
				<label for="update-operation" class="block text-sm font-medium mb-2"
					>Update Operation (e.g., $set, $inc, $unset):</label
				>
				<textarea
					bind:value={updateQuery}
					placeholder="Update operation"
					rows="4"
					use:jsonTextarea={{ onsubmit: executeUpdateMany }}
					class="w-full p-2 border border-[var(--color-4)] bg-[var(--color-3)] rounded font-mono text-sm"
				></textarea>
			</div>
			<div class="flex gap-2">
				<button class="btn btn-success" disabled={isUpdating} onclick={executeUpdateMany}>
					{isUpdating ? "Updating..." : "Execute Update"}
				</button>
				<button class="btn btn-default" onclick={() => (editMode = false)}>Cancel</button>
			</div>
			<div class="text-sm text-[var(--text-secondary,#888)]">
				<p class="mb-1"><strong>Examples:</strong></p>
				<p class="mb-1">
					• Set a field: <code class="bg-[var(--color-3)] px-1 rounded">{'{"$set": {"status": "active"}}'}</code>
				</p>
				<p class="mb-1">
					• Increment a value: <code class="bg-[var(--color-3)] px-1 rounded">{'{"$inc": {"count": 1}}'}</code>
				</p>
				<p>• Unset a field: <code class="bg-[var(--color-3)] px-1 rounded">{'{"$unset": {"oldField": ""}}'}</code></p>
			</div>
		</div>
	</Panel>
{/if}

{#await items}
	<Panel
		title={finalCount !== null
			? `${formatNumber(data.params.skip + 1)} - ${formatNumber(data.params.skip + data.params.limit)} of ${formatNumber(finalCount)} documents...`
			: "Loading documents..."}
	>
		{#snippet actions()}
			{#if finalCount !== null}
				{#if data.params.skip > 0}
					<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
					<a href={resolve(previousUrl as any)} onclick={navigatePrevious} class="btn btn-default btn-sm -my-2">
						Previous
					</a>
				{/if}
				{#if data.params.skip + data.params.limit < finalCount}
					<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
					<a href={resolve(nextUrl as any)} onclick={navigateNext} class="btn btn-default btn-sm -my-2">Next</a>
				{/if}
			{/if}
		{/snippet}
	</Panel>
{:then resultsData}
	<!-- Sometimes resultsData is undefined when navigating to indexes page -->
	{@const items = resultsData?.data ?? []}
	{#await data.count}
		<Panel
			title={items.length > 0
				? `${formatNumber(data.params.skip + 1)} - ${formatNumber(data.params.skip + items.length)} Documents (counting...)`
				: "No documents"}
		>
			{#snippet actions()}
				{#if data.params.skip > 0}
					<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
					<a href={resolve(previousUrl as any)} onclick={navigatePrevious} class="btn btn-default btn-sm -my-2">
						Previous
					</a>
				{/if}
				{#if items.length >= data.params.limit}
					<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
					<a href={resolve(nextUrl as any)} onclick={navigateNext} class="btn btn-default btn-sm -my-2">Next</a>
				{/if}
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
						? `${formatNumber(data.params.skip + 1)} - ${formatNumber(data.params.skip + items.length)} of ${formatNumber(count)} Documents`
						: `${formatNumber(data.params.skip + 1)} - ${formatNumber(data.params.skip + items.length)} Documents (count ${isTimeout ? "timeout" : "unavailable"})`
					: "No documents"}
			>
				{#snippet actions()}
					{#if hasPrevious}
						<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
						<a href={resolve(previousUrl as any)} onclick={navigatePrevious} class="btn btn-default btn-sm -my-2">
							Previous
						</a>
					{/if}
					{#if hasNext}
						<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
						<a href={resolve(nextUrl as any)} onclick={navigateNext} class="btn btn-default btn-sm -my-2">Next</a>
					{/if}
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
