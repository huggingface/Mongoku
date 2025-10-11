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

	let loading = $state({
		content: false,
		count: false,
	});

	let items = $state<MongoDocument[]>(data.results || []);
	let count = $state({
		total: data.count || 0,
		start: data.params.skip,
	});

	let params = $state<SearchParams>({ ...data.params });

	$effect(() => {
		// Update when data changes
		items = data.results || [];
		count.total = data.count || 0;
		count.start = data.params.skip;
	});

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

	async function editDocument(_id: { $value?: string } | undefined, json: MongoDocument) {
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
				}
			} else {
				const error = await response.text();
				notificationStore.notifyError(error || "Failed to update document");
			}
		} catch (error) {
			notificationStore.notifyError(error instanceof Error ? error.message : "Failed to update document");
		}
	}

	async function removeDocument(_id: { $value?: string } | undefined) {
		const documentId = _id?.$value;
		if (!documentId) return;

		try {
			const response = await fetch(
				`/api/servers/${encodeURIComponent(data.server)}/databases/${encodeURIComponent(data.database)}/collections/${encodeURIComponent(data.collection)}/documents/${documentId}`,
				{ method: "DELETE" },
			);

			if (response.ok) {
				notificationStore.notifySuccess("Document removed successfully");
				items = items.filter((item) => item._id?.$value !== documentId);
			} else {
				const error = await response.text();
				notificationStore.notifyError(error || "Failed to remove document");
			}
		} catch (error) {
			notificationStore.notifyError(error instanceof Error ? error.message : "Failed to remove document");
		}
	}

	let hasNext = $derived(count.start + items.length < count.total);
	let hasPrevious = $derived(count.start > 0);

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

<Panel
	title={count.total > 0
		? `${formatNumber(count.start + 1)} - ${formatNumber(count.start + items.length)} of ${formatNumber(count.total)} Documents`
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

{#if loading.content}
	<div class="loading">Loading...</div>
{:else}
	{#each items as item (item._id?.$value)}
		<PrettyJson
			json={item}
			autoCollapse={true}
			readOnly={data.readOnly}
			onedit={(json) => editDocument(item._id, json)}
			onremove={() => removeDocument(item._id)}
			server={data.server}
			database={data.database}
			collection={data.collection}
		/>
	{/each}
{/if}
