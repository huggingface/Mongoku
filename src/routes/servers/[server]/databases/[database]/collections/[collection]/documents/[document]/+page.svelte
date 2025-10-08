<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import Panel from '$lib/components/Panel.svelte';
	import PrettyJson from '$lib/components/PrettyJson.svelte';
	import { notificationStore } from '$lib/stores/notifications.svelte';

	let { data }: { data: PageData } = $props();

	let loading = $state(false);
	let item = $state(data.document);

	$effect(() => {
		item = data.document;
	});

	async function editDocument(json: any) {
		const newId = json?._id?.$value;
		const oldId = item?._id?.$value;

		if (newId !== oldId) {
			notificationStore.notifyError('ObjectId changed. This is not supported, update canceled.');
			return;
		}

		loading = true;
		try {
			const response = await fetch(
				`/api/servers/${encodeURIComponent(data.server)}/databases/${encodeURIComponent(data.database)}/collections/${encodeURIComponent(data.collection)}/documents/${oldId}`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(json)
				}
			);

			if (response.ok) {
				const result = await response.json();
				if (result.ok) {
					notificationStore.notifySuccess('Document updated successfully');
					item = result.update;
				}
			} else {
				const error = await response.text();
				notificationStore.notifyError(error || 'Failed to update document');
			}
		} catch (error: any) {
			notificationStore.notifyError(error.message || 'Failed to update document');
		} finally {
			loading = false;
		}
	}

	async function removeDocument() {
		const documentId = item?._id?.$value;
		if (!documentId) return;

		try {
			const response = await fetch(
				`/api/servers/${encodeURIComponent(data.server)}/databases/${encodeURIComponent(data.database)}/collections/${encodeURIComponent(data.collection)}/documents/${documentId}`,
				{ method: 'DELETE' }
			);

			if (response.ok) {
				notificationStore.notifySuccess('Document removed successfully');
				// Navigate back to the collection explore page
				goto(
					`/servers/${encodeURIComponent(data.server)}/databases/${encodeURIComponent(data.database)}/collections/${encodeURIComponent(data.collection)}/explore?query=${encodeURIComponent('{}')}&sort=&project=&skip=0&limit=20`
				);
			} else {
				const error = await response.text();
				notificationStore.notifyError(error || 'Failed to remove document');
			}
		} catch (error: any) {
			notificationStore.notifyError(error.message || 'Failed to remove document');
		}
	}
</script>

<div class="document-page">
	<Panel>
		<div class="title">
			<span>Document</span>
		</div>

		{#if loading}
			<div class="loading">Loading...</div>
		{:else if item}
			<PrettyJson
				json={item}
				readOnly={data.readOnly}
				onedit={editDocument}
				onremove={removeDocument}
			/>
		{:else}
			<div class="center">Document not found</div>
		{/if}
	</Panel>
</div>

<style lang="scss">
	.document-page {
		padding: 40px 0;
	}
</style>
