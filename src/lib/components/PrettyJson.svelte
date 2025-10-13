<script lang="ts">
	import { resolve } from "$app/paths";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import type { MongoDocument } from "$lib/types";
	import { parseJSON } from "$lib/utils/jsonParser";
	import z from "zod";
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

	// Custom serializer that converts ObjectId objects back to new ObjectId() format
	function serializeForEditing(obj: any, depth = 0): string {
		const indent = "  ".repeat(depth);
		const nextIndent = "  ".repeat(depth + 1);

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
			notificationStore.notifyError(z.object({ message: z.string() }).safeParse(err).data?.message ?? "Invalid JSON");
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

<Panel class="group">
	{#snippet title()}
		{#if json._id}
			<div class="">
				<a
					type="button"
					class="bg-transparent border-none text-[var(--text)] no-underline cursor-pointer text-xl font-inherit p-0 hover:underline"
					href={resolve(
						`/servers/${encodeURIComponent(server)}/databases/${encodeURIComponent(database)}/collections/${encodeURIComponent(collection)}/documents/${json._id?.$value}`,
					)}
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
