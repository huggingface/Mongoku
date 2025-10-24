<script lang="ts">
	import { fetchMappedDocument as fetchMappedDocumentRemote } from "$api/servers.remote";
	import { resolve } from "$app/paths";
	import { jsonTextarea } from "$lib/actions/jsonTextarea";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import type { Mappings, MongoDocument } from "$lib/types";
	import { parseJSON } from "$lib/utils/jsonParser";
	import JsonValue from "./JsonValue.svelte";
	import Panel from "./Panel.svelte";

	/* eslint-disable @typescript-eslint/no-explicit-any */

	interface Props {
		json: MongoDocument;
		autoCollapse?: boolean;
		onedit?: (json: any) => void;
		onremove?: () => void;
		server: string;
		database: string;
		collection: string;
		mappings?: Mappings;
		startInEditMode?: boolean;
	}

	let {
		json,
		autoCollapse = false,
		onedit,
		onremove,
		server,
		database,
		collection,
		mappings,
		startInEditMode = false,
	}: Props = $props();

	// Helper to get ID value from any type
	function getIdValue(val: any): string | null {
		if (val === null || val === undefined) return null;
		if (typeof val === "string" || typeof val === "number") return String(val);
		if (val.$type === "ObjectId" && val.$value) return val.$value;
		return null;
	}

	// Check if a key path has a mapping
	function isKeyMapped(path: string): boolean {
		return !!mappings?.[path] && (Array.isArray(mappings[path]) ? mappings[path].length > 0 : true);
	}

	// Fetch mapped document and return it with its navigation URL
	async function fetchMappedDocument(
		path: string,
		value: any,
	): Promise<{ document: MongoDocument | null; url: string | null; collection: string | null }> {
		if (!mappings || !mappings[path] || (Array.isArray(mappings[path]) && mappings[path].length === 0)) {
			return { document: null, url: null, collection: null };
		}

		const idValue = getIdValue(value);

		if (!idValue) {
			return { document: null, url: null, collection: null };
		}

		// Fetch the document - remote function will try all mappings and return first match
		try {
			const result = await fetchMappedDocumentRemote({
				server,
				database,
				mappings: Array.isArray(mappings[path]) ? mappings[path] : [mappings[path]],
				value,
			});

			if (result.error || !result.data || !result.collection) {
				return { document: null, url: null, collection: null };
			}

			// Generate URL for navigation
			const url = resolve(
				`/servers/${encodeURIComponent(server)}/databases/${encodeURIComponent(database)}/collections/${encodeURIComponent(result.collection)}/documents/${encodeURIComponent(idValue)}`,
			);

			return { document: result.data, url, collection: result.collection };
		} catch {
			return { document: null, url: null, collection: null };
		}
	}

	let editorVisible = $state(false);
	let editJson = $state("");
	let removing = $state(false);
	let contentContainerRef = $state<HTMLDivElement>();
	let editorHeight = $state<string>("300px");

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

	// Custom serializer that converts ObjectId objects back to new ObjectId() format
	function serializeForEditing(obj: any, depth = 0): string {
		const indent = "\t".repeat(depth);
		const nextIndent = "\t".repeat(depth + 1);

		if (obj === null) return "null";
		if (obj === undefined) return "undefined";
		if (typeof obj === "string") return JSON.stringify(obj);
		if (typeof obj === "number") return obj.toString();
		if (typeof obj === "boolean") return obj.toString();

		if (Array.isArray(obj)) {
			if (obj.length === 0) return "[]";
			const items = obj.map((item) => `${nextIndent}${serializeForEditing(item, depth + 1)}`).join(",\n");
			return `[\n${items}\n${indent}]`;
		}

		if (typeof obj === "object") {
			// Handle special MongoDB types
			if (obj.$type === "ObjectId") {
				return `new ObjectId("${obj.$value}")`;
			}
			if (obj.$type === "Date") {
				return `new Date("${obj.$value}")`;
			}
			if (obj.$type === "RegExp") {
				return `new RegExp("${obj.$value.$pattern}", "${obj.$value.$flags}")`;
			}

			// Handle regular objects
			const keys = Object.keys(obj);
			if (keys.length === 0) return "{}";

			const pairs = keys
				.map((key) => {
					const value = serializeForEditing(obj[key], depth + 1);
					return `${nextIndent}${JSON.stringify(key)}: ${value}`;
				})
				.join(",\n");

			return `{\n${pairs}\n${indent}}`;
		}

		return JSON.stringify(obj);
	}

	function enableEditor() {
		editJson = serializeForEditing(json);

		// Set editor height to match the full content container (including padding)
		if (contentContainerRef) {
			const height = contentContainerRef.offsetHeight;
			editorHeight = `${Math.max(height, 300)}px`;
		}

		editorVisible = true;
	}

	// Automatically enable editor if startInEditMode is true
	$effect(() => {
		if (startInEditMode && !editorVisible && contentContainerRef) {
			enableEditor();
		}
	});

	function disableEditor() {
		editorVisible = false;
		editJson = "";
	}

	function save() {
		try {
			const updatedJson = parseJSON(editJson);
			disableEditor();
			onedit?.(updatedJson);
		} catch (err) {
			notificationStore.notifyError(err, "Invalid JSON");
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

	async function copyToClipboard() {
		try {
			const jsonString = serializeForEditing(json);
			await navigator.clipboard.writeText(jsonString);
			notificationStore.notifySuccess("Document copied to clipboard");
		} catch (err) {
			notificationStore.notifyError(err, "Failed to copy to clipboard");
		}
	}
</script>

{#snippet title()}
	{#if json._id}
		{@const idValue = json._id.$value ?? json._id}
		<div class="">
			<a
				type="button"
				class="bg-transparent border-none text-[var(--text)] no-underline cursor-pointer text-xl font-inherit p-0 hover:underline normal-case"
				href={resolve(
					`/servers/${encodeURIComponent(server)}/databases/${encodeURIComponent(database)}/collections/${encodeURIComponent(collection)}/documents/${idValue}`,
				)}
			>
				{idValue}
			</a>
			{#if json._id.$value}
				{@const timestamp = getTimestampFromObjectId(json._id.$value)}
				{#if timestamp}
					<span class="ml-2 text-md text-[var(--text-secondary,#888)]">{timestamp.toLocaleString()}</span>
				{/if}
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet actions()}
	<div class="hidden group-hover:block">
		<button class="btn btn-outline-light btn-sm ml-2 -my-2" onclick={copyToClipboard}>Copy</button>
		{#if onedit}
			<button class="btn btn-outline-light btn-sm ml-2 -my-2" onclick={enableEditor}>Edit</button>
		{/if}
		{#if onremove}
			<button class="btn btn-outline-danger btn-sm ml-2 -my-2" onclick={showRemove}>Remove</button>
		{/if}
	</div>
{/snippet}

<Panel class="group" title={json._id ? title : undefined} {actions}>
	<div bind:this={contentContainerRef} class="p-4 relative border-t border-[var(--border-color)]">
		<div class="font-mono text-sm leading-tight whitespace-pre-wrap break-words relative">
			<JsonValue value={json} {autoCollapse} collapsed={false} {isKeyMapped} {fetchMappedDocument} />
		</div>

		<div class="absolute h-full z-[100] w-full top-0 left-0" class:hidden={!editorVisible} class:block={editorVisible}>
			<div class="absolute z-10 right-5 top-4">
				<button class="btn btn-success ml-2" onclick={save}>Save</button>
				<button class="btn btn-default ml-2" onclick={disableEditor}>Cancel</button>
			</div>
			<textarea
				bind:value={editJson}
				style="height: {editorHeight};"
				use:jsonTextarea={{ onsubmit: save, onescape: disableEditor }}
				class="w-full font-mono text-sm leading-relaxed p-2.5 bg-[var(--color-1)] text-[var(--text)] border border-[var(--border-color)] rounded resize-y"
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
