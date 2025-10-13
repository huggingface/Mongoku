<script lang="ts">
	import {
		deleteDocument as deleteDocumentCommand,
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

	async function editDocument(json: MongoDocument) {
		const newId = json?._id?.$value;
		const oldId = item?._id?.$value;

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
		const documentId = item?._id?.$value;
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
</script>

{#if loading}
	<div class="loading">Loading...</div>
{:else if item}
	<PrettyJson
		json={item}
		readOnly={data.readOnly}
		onedit={editDocument}
		onremove={removeDocument}
		server={data.server}
		database={data.database}
		collection={data.collection}
	/>
{:else}
	<div class="text-center">Document not found</div>
{/if}
