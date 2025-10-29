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
	let textareaRef = $state<HTMLTextAreaElement>();
	let panelRef = $state<HTMLDivElement>();
	let lastSetHeight = $state<number>(0);

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
		editorVisible = true;
	}

	// Automatically enable editor if startInEditMode is true
	$effect(() => {
		if (startInEditMode && !editorVisible && contentContainerRef) {
			enableEditor();
		}
	});

	// Watch for textarea resize and update panel height
	$effect(() => {
		if (!textareaRef || !panelRef || !editorVisible) return;

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const newHeight = entry.borderBoxSize[0].blockSize;
				// Only update if height changed and is different from what we last set
				if (newHeight > 0 && Math.abs(newHeight - lastSetHeight) > 1) {
					const totalHeight = newHeight; // Add padding for buttons
					lastSetHeight = newHeight;
					if (panelRef) {
						panelRef.style.minHeight = `${totalHeight}px`;
					}
				}
			}
		});

		resizeObserver.observe(textareaRef);

		return () => {
			resizeObserver.disconnect();
		};
	});

	function disableEditor() {
		editorVisible = false;
		editJson = "";
		lastSetHeight = 0;
		// Reset panel min-height when editor closes
		if (panelRef) {
			panelRef.style.minHeight = "";
		}
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
		<div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0 flex-1">
			<h2 class="truncate">
				<a
					class="text-[15px] sm:text-base font-semibold hover:underline no-underline"
					style="color: var(--text); text-decoration-color: var(--link);"
					href={resolve(
						`/servers/${encodeURIComponent(server)}/databases/${encodeURIComponent(database)}/collections/${encodeURIComponent(collection)}/documents/${idValue}`,
					)}
				>
					{idValue}
				</a>
			</h2>
			{#if json._id.$value}
				{@const timestamp = getTimestampFromObjectId(json._id.$value)}
				{#if timestamp}
					<p class="text-xs" style="color: var(--text-secondary);">
						Created on {timestamp.toLocaleDateString()} · {timestamp.toLocaleTimeString()}
					</p>
				{/if}
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet actions()}
	<div class="hidden group-hover:flex items-center gap-2 -my-2">
		<button
			class="px-3 py-1 rounded-lg border border-[var(--border-color)] bg-[var(--light-background)] hover:bg-[var(--color-3)] text-[13px] transition cursor-pointer"
			style="color: var(--text);"
			onclick={copyToClipboard}
		>
			Copy
		</button>
		{#if onedit}
			<button
				class="px-3 py-1 rounded-lg border border-[var(--border-color)] bg-[var(--light-background)] hover:bg-[var(--color-3)] text-[13px] transition cursor-pointer"
				style="color: var(--text);"
				onclick={enableEditor}
			>
				Edit
			</button>
		{/if}
		{#if onremove}
			<button
				class="px-3 py-1 rounded-lg border border-red-200 hover:bg-red-50 text-[13px] transition cursor-pointer"
				style="color: var(--button-danger);"
				onclick={showRemove}
			>
				Delete
			</button>
		{/if}
	</div>
{/snippet}

<Panel class="group relative" title={json._id ? title : undefined} {actions} bind:ref={panelRef}>
	<div bind:this={contentContainerRef} class="relative p-4 sm:p-6">
		<div class="font-mono text-[13px] sm:text-[14px] leading-relaxed whitespace-pre-wrap break-words overflow-x-auto">
			<JsonValue value={json} {autoCollapse} collapsed={false} {isKeyMapped} {fetchMappedDocument} />
		</div>

		{#if removing}
			<div
				class="absolute z-10 top-0 left-0 w-full h-full rounded-2xl backdrop-blur-sm flex items-center justify-center"
				style="background-color: rgba(0, 0, 0, 0.4);"
			>
				<div
					class="bg-[var(--light-background)] rounded-2xl p-6 shadow-xl border border-[var(--border-color)] max-w-sm mx-4"
				>
					<p class="text-lg font-semibold mb-4" style="color: var(--text);">Delete this document?</p>
					<p class="text-sm mb-6" style="color: var(--text-secondary);">This action cannot be undone.</p>
					<div class="flex gap-3">
						<button class="btn btn-danger flex-1" onclick={confirmRemove}>Delete</button>
						<button class="btn btn-default flex-1" onclick={cancelRemove}>Cancel</button>
					</div>
				</div>
			</div>
		{/if}
	</div>

	{#if editorVisible}
		<div class="absolute inset-0 z-[100] bg-[var(--light-background)]">
			<textarea
				bind:this={textareaRef}
				bind:value={editJson}
				use:jsonTextarea={{ onsubmit: save, onescape: disableEditor }}
				class="w-full h-full font-mono text-[13px] sm:text-[14px] leading-relaxed p-4 border-0 bg-[var(--color-3)] focus:outline-none focus:ring-0"
				style="color: var(--text);"
			></textarea>
			<div class="absolute top-3 right-3 flex items-center gap-2">
				<button class="btn btn-success" onclick={save}>Save</button>
				<button class="btn btn-default" onclick={disableEditor}>Cancel</button>
			</div>
		</div>
	{/if}
</Panel>
