<script lang="ts">
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import type { MongoDocument } from "$lib/types";
	import { parseJSON } from "$lib/utils/jsonParser";
	import JsonValue from "./JsonValue.svelte";

	/* eslint-disable @typescript-eslint/no-explicit-any */

	interface Props {
		json: MongoDocument;
		autoCollapse?: boolean;
		readOnly?: boolean;
		ongo?: (id: string) => void;
		onedit?: (json: any) => void;
		onremove?: () => void;
	}

	let { json, autoCollapse = false, readOnly = false, ongo, onedit, onremove }: Props = $props();

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

	function goToDocument() {
		if (json._id?.$value) {
			ongo?.(json._id.$value);
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

<div class="pretty-json-container">
	{#if json._id}
		<div class="title">
			<div class="object-info">
				<div class="objectid">
					<button type="button" class="objectid-link" onclick={goToDocument}>{json._id?.$value}</button>
					{#if json._id?.$value}
						{@const timestamp = getTimestampFromObjectId(json._id.$value)}
						{#if timestamp}
							<span class="date">{timestamp.toLocaleString()}</span>
						{/if}
					{/if}
				</div>
				{#if !readOnly}
					<div class="actions">
						<button class="btn btn-outline-light btn-sm" onclick={enableEditor}>Edit</button>
						<button class="btn btn-outline-danger btn-sm" onclick={showRemove}>Remove</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<div class="pretty-json">
		<JsonValue value={json} {autoCollapse} collapsed={false} />
	</div>

	<div class="editor" class:visible={editorVisible}>
		<div class="editor-actions">
			<button class="btn btn-success" onclick={save}>Save</button>
			<button class="btn btn-default" onclick={disableEditor}>Cancel</button>
		</div>
		<textarea bind:this={editorRef} bind:value={editJson}></textarea>
	</div>

	{#if removing}
		<div class="remove-layer">
			<p>Are you sure?</p>
			<div class="remove-actions">
				<button class="btn btn-danger" onclick={confirmRemove}>Yes - Remove</button>
				<button class="btn btn-success" onclick={cancelRemove}>No - Cancel</button>
			</div>
		</div>
	{/if}
</div>

<style lang="postcss">
	.pretty-json-container {
		background-color: var(--panel-bg);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		padding: 15px;
		margin-bottom: 15px;
		position: relative;
	}

	.title {
		.object-info {
			display: flex;
			justify-content: space-between;
			align-items: center;

			.objectid {
				font-size: 1.2em;

				.objectid-link {
					background: none;
					border: none;
					color: var(--text);
					text-decoration: none;
					cursor: pointer;
					font-size: inherit;
					font-family: inherit;
					padding: 0;

					&:hover {
						text-decoration: underline;
					}
				}

				.date {
					margin-left: 20px;
					font-size: 0.7em;
					color: var(--text-secondary, #888);
				}
			}

			.actions {
				display: none;

				& > .btn {
					margin-left: 10px;
					padding: 2px 5px 0;
				}
			}
		}

		&:hover .object-info .actions {
			display: initial;
		}
	}

	.pretty-json {
		font-family: "Source Code Pro", "Consolas", "Monaco", "Courier New", monospace;
		font-size: 0.9em;
		line-height: 1.3;
		white-space: pre-wrap;
		word-wrap: break-word;
		position: relative;
	}

	.editor {
		display: none;
		position: absolute;
		height: 100%;
		z-index: 100;
		width: 100%;
		top: 0;

		&.visible {
			display: block;
		}

		textarea {
			width: 100%;
			min-height: 300px;
			font-family: "Source Code Pro", "Consolas", "Monaco", "Courier New", monospace;
			font-size: 14px;
			line-height: 1.6;
			padding: 10px;
			background-color: var(--color-1);
			color: var(--text);
			border: 1px solid var(--border-color);
			border-radius: 4px;
			resize: vertical;
		}
	}

	.editor-actions {
		position: absolute;
		z-index: 10;
		right: 20px;
		top: 15px;

		& > .btn {
			margin-left: 10px;
			padding: 2px 5px 0;
		}
	}

	.remove-layer {
		position: absolute;
		z-index: 10;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		border-radius: 5px;
		background: var(--text-inverse);
		opacity: 0.7;

		p {
			color: var(--text);
			text-align: center;
			margin-top: 20px;
			font-size: 2em;
		}

		.remove-actions {
			position: absolute;
			width: 100%;
			height: 100%;
			top: 0;
			display: flex;
			justify-content: center;
			align-items: center;

			.btn {
				margin: 20px;
			}
		}
	}
</style>
