<script lang="ts">
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import type { MongoDocument } from "$lib/types";
	import { parseJSON } from "$lib/utils/jsonParser";
	import JsonValue from "./JsonValue.svelte";
	import Panel from "./Panel.svelte";

	/* eslint-disable @typescript-eslint/no-explicit-any */

	interface Props {
		json: MongoDocument;
		autoCollapse?: boolean;
		readOnly?: boolean;
		onedit?: (json: any) => void;
		onremove?: () => void;
		server: string;
		database: string;
		collection: string;
	}

	let {
		json,
		autoCollapse = false,
		readOnly = false,
		onedit,
		onremove,
		server,
		database,
		collection,
	}: Props = $props();

	let editorVisible = $state(false);
	let editJson = $state("");
	let removing = $state(false);
	let editorRef = $state<HTMLTextAreaElement>();

	// Extract timestamp from ObjectId
	function getTimestampFromObjectId(objectId: string): Date | null {
		try {
			// ObjectId is 24 hex characters, first 8 represent timestamp
			const timestamp = parseInt(objectId.substring(0, 8), 16);
			return new Date(timestamp * 1000);
		} catch {
			return null;
		}
	}

	function enableEditor() {
		editJson = JSON.stringify(json, null, 2);
		editorVisible = true;
	}

	function disableEditor() {
		editorVisible = false;
		editJson = "";
	}

	function save() {
		try {
			const updatedJson = parseJSON(editJson);
			disableEditor();
			onedit?.(updatedJson);
		} catch (err: any) {
			notificationStore.notifyError(err.message || "Invalid JSON");
		}
	}

	function showRemove() {
		removing = true;
	}

	function cancelRemove() {
		removing = false;
	}

	function confirmRemove() {
		onremove?.();
	}
</script>

<Panel>
	{#snippet title()}
		{#if json._id}
			<div class="">
				<a
					type="button"
					class="bg-transparent border-none text-[var(--text)] no-underline cursor-pointer text-xl font-inherit p-0 hover:underline"
					href={`/servers/${encodeURIComponent(server)}/databases/${encodeURIComponent(database)}/collections/${encodeURIComponent(collection)}/documents/${json._id?.$value}`}
				>
					{json._id?.$value}
				</a>
				{#if json._id?.$value}
					{@const timestamp = getTimestampFromObjectId(json._id.$value)}
					{#if timestamp}
						<span class="ml-2 text-md text-[var(--text-secondary,#888)]">{timestamp.toLocaleString()}</span>
					{/if}
				{/if}
			</div>
		{/if}
	{/snippet}

	{#snippet actions()}
		{#if !readOnly}
			<div class="hidden group-hover:block">
				<button class="btn btn-outline-light btn-sm ml-2 -my-2" onclick={enableEditor}>Edit</button>
				<button class="btn btn-outline-danger btn-sm ml-2 -my-2" onclick={showRemove}>Remove</button>
			</div>
		{/if}
	{/snippet}

	<div class="p-4 relative border-t border-[var(--border-color)]">
		<div class="font-mono text-sm leading-tight whitespace-pre-wrap break-words relative">
			<JsonValue value={json} {autoCollapse} collapsed={false} />
		</div>

		<div class="absolute h-full z-[100] w-full top-0 left-0" class:hidden={!editorVisible} class:block={editorVisible}>
			<div class="absolute z-10 right-5 top-4">
				<button class="btn btn-success ml-2" onclick={save}>Save</button>
				<button class="btn btn-default ml-2" onclick={disableEditor}>Cancel</button>
			</div>
			<textarea
				bind:this={editorRef}
				bind:value={editJson}
				class="w-full min-h-[300px] font-mono text-sm leading-relaxed p-2.5 bg-[var(--color-1)] text-[var(--text)] border border-[var(--border-color)] rounded resize-y"
			></textarea>
		</div>

		{#if removing}
			<div class="absolute z-10 top-0 left-0 w-full h-full rounded bg-[var(--text-inverse)] opacity-70">
				<p class="text-[var(--text)] text-center mt-5 text-2xl">Are you sure?</p>
				<div class="absolute w-full h-full top-0 flex justify-center items-center">
					<button class="btn btn-danger m-5" onclick={confirmRemove}>Yes - Remove</button>
					<button class="btn btn-success m-5" onclick={cancelRemove}>No - Cancel</button>
				</div>
			</div>
		{/if}
	</div>
</Panel>
