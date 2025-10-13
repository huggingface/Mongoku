<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import Panel from "$lib/components/Panel.svelte";
	import PrettyJson from "$lib/components/PrettyJson.svelte";
	import SearchBox from "$lib/components/SearchBox.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import type { MongoDocument, SearchParams } from "$lib/types";
	import { formatNumber } from "$lib/utils/filters";
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

	async function update() {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const queryParams = new URLSearchParams();
		queryParams.set("query", params.query || "{}");
		queryParams.set("sort", params.sort || "");
		queryParams.set("project", params.project || "");
		queryParams.set("skip", String(params.skip));
		queryParams.set("limit", String(params.limit));

		await goto(
			resolve(
				`/servers/${encodeURIComponent(data.server)}/databases/${encodeURIComponent(data.database)}/collections/${encodeURIComponent(data.collection)}?${queryParams.toString()}`,
			),
			{ invalidateAll: true },
		);
	}

	async function editDocument(_id: { $value?: string } | undefined, json: MongoDocument, items: MongoDocument[]) {
		const partial = params.project && params.project !== "{}" && Object.keys(JSON.parse(params.project)).length > 0;
		const newId = json?._id?.$value;
		const oldId = _id?.$value;

		if (newId !== oldId) {
			notificationStore.notifyError("ObjectId changed. This is not supported, update canceled.");
			return;
		}

		try {
			const response = await fetch(
				`/api/servers/${encodeURIComponent(data.server)}/databases/${encodeURIComponent(data.database)}/collections/${encodeURIComponent(data.collection)}/documents/${oldId}${partial ? "?partial=true" : ""}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(json),
				},
			);

			if (response.ok) {
				const result = await response.json();
				if (result.ok) {
					notificationStore.notifySuccess("Document updated successfully");
					// Update the document in the list
					const index = items.findIndex((item) => item._id?.$value === oldId);
					if (index !== -1) {
						items[index] = result.update;
					}
					modifiedItems = items;
				}
			} else {
				const error = await response.text();
				notificationStore.notifyError(error || "Failed to update document");
			}
		} catch (error) {
			notificationStore.notifyError(error instanceof Error ? error.message : "Failed to update document");
		}
	}

	async function removeDocument(_id: { $value?: string } | undefined, items: MongoDocument[]) {
		const documentId = _id?.$value;
		if (!documentId) return;

		try {
			const response = await fetch(
				`/api/servers/${encodeURIComponent(data.server)}/databases/${encodeURIComponent(data.database)}/collections/${encodeURIComponent(data.collection)}/documents/${documentId}`,
				{ method: "DELETE" },
			);

			if (response.ok) {
				notificationStore.notifySuccess("Document removed successfully");
				modifiedItems = items.filter((item) => item._id?.$value !== documentId);
			} else {
				const error = await response.text();
				notificationStore.notifyError(error || "Failed to remove document");
			}
		} catch (error) {
			notificationStore.notifyError(error instanceof Error ? error.message : "Failed to remove document");
		}
	}

	function next() {
		params.skip = params.skip + params.limit;
		update();
	}

	function previous() {
		params.skip = Math.max(0, params.skip - params.limit);
		update();
	}
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
					<button class="btn btn-default btn-sm -my-2" onclick={previous}>Previous</button>
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
					<button class="btn btn-default btn-sm -my-2" onclick={previous}>Previous</button>
				{/if}
				{#if hasNext}
					<button class="btn btn-default btn-sm -my-2" onclick={next}>Next</button>
				{/if}
			{/snippet}
		</Panel>
	{/await}

	{#each items as item (item._id?.$value)}
		<PrettyJson
			json={item}
			autoCollapse={true}
			readOnly={data.readOnly}
			onedit={(json) => editDocument(item._id, json, items)}
			onremove={() => removeDocument(item._id, items)}
			server={data.server}
			database={data.database}
			collection={data.collection}
		/>
	{/each}
{/await}
