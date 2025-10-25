<script lang="ts">
	import {
		deleteDocument as deleteDocumentCommand,
		insertDocument as insertDocumentCommand,
		updateDocument as updateDocumentCommand,
	} from "$api/servers.remote";
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import PrettyJson from "$lib/components/PrettyJson.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import type { MongoDocument } from "$lib/types";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let loading = $state(false);
	let item = $derived(data.document);
	let showInsertEditor = $state(false);

	async function editDocument(json: MongoDocument) {
		const newId = json?._id?.$value ?? json?._id;
		const oldId = item?._id?.$value ?? item?._id;

		if (newId !== oldId) {
			notificationStore.notifyError("ObjectId changed. This is not supported, update canceled.");
			return;
		}

		if (!oldId) return;

		loading = true;
		try {
			const result = await updateDocumentCommand({
				server: data.server,
				database: data.database,
				collection: data.collection,
				document: oldId,
				value: json,
				partial: false,
			});

			if (result.ok) {
				notificationStore.notifySuccess("Document updated successfully");
				item = result.update;
			}
		} catch (error) {
			notificationStore.notifyError(error, "Failed to update document");
		} finally {
			loading = false;
		}
	}

	async function removeDocument() {
		const documentId = item?._id?.$value ?? item?._id;
		if (!documentId) return;

		try {
			await deleteDocumentCommand({
				server: data.server,
				database: data.database,
				collection: data.collection,
				document: documentId,
			});

			notificationStore.notifySuccess("Document removed successfully");
			// Navigate back to the collection explore page
			goto(
				resolve(
					`/servers/${encodeURIComponent(data.server)}/databases/${encodeURIComponent(data.database)}/collections/${encodeURIComponent(data.collection)}?query=${encodeURIComponent("{}")}&sort=&project=&skip=0&limit=20`,
				),
			);
		} catch (error) {
			notificationStore.notifyError(error, "Failed to remove document");
		}
	}

	async function insertDocument(json: MongoDocument) {
		loading = true;
		try {
			const result = await insertDocumentCommand({
				server: data.server,
				database: data.database,
				collection: data.collection,
				document: data.documentId,
				value: json,
			});

			if (result.ok) {
				notificationStore.notifySuccess("Document inserted successfully");
				// Reload the page to show the newly inserted document
				window.location.reload();
			}
		} catch (error) {
			notificationStore.notifyError(error, "Failed to insert document");
		} finally {
			loading = false;
		}
	}

	function handleInsertClick() {
		showInsertEditor = true;
	}
</script>

{#if loading}
	<div class="loading">Loading...</div>
{:else if item}
	<PrettyJson
		json={item}
		onedit={data.readOnly ? undefined : editDocument}
		onremove={data.readOnly ? undefined : removeDocument}
		server={data.server}
		database={data.database}
		collection={data.collection}
		mappings={data.mappings}
	/>
{:else if showInsertEditor}
	<div class="insert-container">
		<h3>Insert Document with ID: {data.documentId}</h3>
		<PrettyJson
			json={{ _id: { $type: "ObjectId", $value: data.documentId } }}
			onedit={insertDocument}
			server={data.server}
			database={data.database}
			collection={data.collection}
			mappings={data.mappings}
			startInEditMode={true}
		/>
		<button class="btn btn-default mt-4" onclick={() => (showInsertEditor = false)}>Cancel</button>
	</div>
{:else}
	<div class="not-found-container">
		<div class="text-center">Document not found</div>
		{#if !data.readOnly}
			<button class="btn btn-success" onclick={handleInsertClick}>Insert Document</button>
		{/if}
	</div>
{/if}

<style>
	.not-found-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		margin-top: 2rem;
	}

	.insert-container {
		padding: 1rem;
	}

	.insert-container h3 {
		margin-bottom: 1rem;
		color: var(--text);
	}

	.loading,
	.text-center {
		text-align: center;
		padding: 2rem;
		color: var(--text);
	}
</style>
