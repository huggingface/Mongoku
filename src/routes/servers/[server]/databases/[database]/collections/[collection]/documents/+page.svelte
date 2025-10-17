<script lang="ts">
	import {
		deleteDocument as deleteDocumentCommand,
		updateDocument as updateDocumentCommand,
	} from "$api/servers.remote";
	import { resolve } from "$app/paths";
	import Panel from "$lib/components/Panel.svelte";
	import PrettyJson from "$lib/components/PrettyJson.svelte";
	import SearchBox from "$lib/components/SearchBox.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import type { MongoDocument, SearchParams } from "$lib/types";
	import { formatNumber } from "$lib/utils/filters";
	import { SvelteURLSearchParams } from "svelte/reactivity";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let params = $state<SearchParams>({ ...data.params });

	// Handle errors from streamed promises
	$effect(() => {
		// @ts-expect-error I just want to trigger the dependency
		if (data.results) {
			modifiedItems = null;
		}
		data.results.then((result) => {
			if (result.error) {
				notificationStore.notifyError(result.error);
			}
		});
	});

	$effect(() => {
		data.count.then((result) => {
			if (result.error) {
				notificationStore.notifyError(result.error);
			}
		});
	});

	let modifiedItems = $state<MongoDocument[] | null>(null);
	let items = $derived(modifiedItems ? { data: modifiedItems, error: null } : data.results);

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

		return `/servers/${encodeURIComponent(data.server)}/databases/${encodeURIComponent(data.database)}/collections/${encodeURIComponent(data.collection)}?${queryParams.toString()}`;
	}

	const nextUrl = $derived(buildUrl(params.skip + params.limit));
	const previousUrl = $derived(buildUrl(Math.max(0, params.skip - params.limit)));
</script>

<SearchBox bind:params />

{#await items}
	<Panel title="Loading documents...">
		{#snippet actions()}
			<span class="text-sm text-gray-500">Loading...</span>
		{/snippet}
	</Panel>
{:then resultsData}
	{@const items = resultsData.data}
	{#await data.count}
		<Panel
			title={items.length > 0
				? `${formatNumber(data.params.skip + 1)} - ${formatNumber(data.params.skip + items.length)} Documents (counting...)`
				: "No documents"}
		>
			{#snippet actions()}
				{#if data.params.skip > 0}
					<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
					<a href={resolve(previousUrl as any)} class="btn btn-default btn-sm -my-2">Previous</a>
				{/if}
			{/snippet}
		</Panel>
	{:then countData}
		{@const count = countData.data}
		{@const hasNext = data.params.skip + items.length < count}
		{@const hasPrevious = data.params.skip > 0}
		<Panel
			title={count > 0
				? `${formatNumber(data.params.skip + 1)} - ${formatNumber(data.params.skip + items.length)} of ${formatNumber(count)} Documents`
				: "No documents"}
		>
			{#snippet actions()}
				{#if hasPrevious}
					<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
					<a href={resolve(previousUrl as any)} class="btn btn-default btn-sm -my-2">Previous</a>
				{/if}
				{#if hasNext}
					<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
					<a href={resolve(nextUrl as any)} class="btn btn-default btn-sm -my-2">Next</a>
				{/if}
			{/snippet}
		</Panel>
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
		/>
	{/each}
{/await}
