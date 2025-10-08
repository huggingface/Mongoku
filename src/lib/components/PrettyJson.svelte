<script lang="ts">
	import { notificationStore } from '$lib/stores/notifications.svelte';
	import type { MongoDocument } from '$lib/types';
	import { parseJSON } from '$lib/utils/jsonParser';
	import { onMount } from 'svelte';

	interface Props {
		json: MongoDocument;
		autoCollapse?: boolean;
		readOnly?: boolean;
		ongo?: (id: string) => void;
		onedit?: (json: any) => void;
		onremove?: () => void;
	}

	let { json, autoCollapse = false, readOnly = false, ongo, onedit, onremove }: Props = $props();

	let containerRef = $state<HTMLDivElement>();
	let editorVisible = $state(false);
	let editJson = $state('');
	let removing = $state(false);
	let editorRef = $state<HTMLTextAreaElement>();

	onMount(() => {
		renderJson();
	});

	function renderJson() {
		if (!containerRef) return;
		containerRef.innerHTML = '';
		const view = createView('_', { _: json });
		containerRef.appendChild(view);
	}

	function createView(key: string, holder: any): HTMLElement {
		let value = holder[key];

		// Handle different types
		if (typeof value === 'string') {
			return createQuote(value);
		} else if (typeof value === 'number') {
			const span = document.createElement('span');
			span.className = 'value number';
			span.textContent = String(value);
			return span;
		} else if (typeof value === 'boolean') {
			const span = document.createElement('span');
			span.className = 'value boolean';
			span.textContent = String(value);
			return span;
		} else if (value === null) {
			const span = document.createElement('span');
			span.className = 'value null';
			span.textContent = 'null';
			return span;
		} else if (typeof value === 'object') {
			// Handle MongoDB special types
			if (value.$type === 'ObjectId') {
				return createFnCall('ObjectId', [createQuote(value.$value)], 'function');
			}
			if (value.$type === 'Date') {
				return createFnCall('Date', [createQuote(value.$value)], 'function');
			}
			if (value.$type === 'RegExp') {
				const span = document.createElement('span');
				span.className = 'value regexp';
				span.textContent = `/${value.$value.$pattern}/${value.$value.$flags}`;
				return span;
			}

			// Handle arrays
			if (Array.isArray(value)) {
				if (value.length === 0) {
					const span = document.createElement('span');
					span.className = 'value array';
					span.textContent = '[]';
					return span;
				}

				return createCollapsible('array', value, (val) => {
					const elements: HTMLElement[] = [];
					for (let i = 0; i < val.length; i++) {
						elements.push(createView(String(i), val));
					}
					return elements;
				});
			}

			// Handle objects
			const keys = Object.keys(value);
			if (keys.length === 0) {
				const span = document.createElement('span');
				span.className = 'value object';
				span.textContent = '{}';
				return span;
			}

			return createCollapsible('object', value, (val) => {
				const elements: HTMLElement[] = [];
				for (const k of keys) {
					const propSpan = document.createElement('span');
					propSpan.className = 'prop';

					const keyEl = document.createElement('var');
					keyEl.textContent = k;
					propSpan.appendChild(keyEl);
					propSpan.appendChild(document.createTextNode(': '));
					propSpan.appendChild(createView(k, val));

					elements.push(propSpan);
				}
				return elements;
			});
		}

		const span = document.createElement('span');
		span.textContent = String(value);
		return span;
	}

	function createCollapsible(
		type: 'array' | 'object',
		value: any,
		renderContent: (val: any) => HTMLElement[]
	): HTMLElement {
		const wrapper = document.createElement('span');
		wrapper.className = `collapsible-wrapper ${autoCollapse ? 'collapsed' : 'expanded'}`;

		const toggle = document.createElement('span');
		toggle.className = 'collapse-toggle';
		toggle.textContent = autoCollapse ? '▶' : '▼';
		toggle.onclick = (e) => {
			e.stopPropagation();
			toggleCollapse(wrapper, content, toggle, type);
		};

		const container = document.createElement('span');
		container.className = `value ${type}`;

		const openBracket = type === 'array' ? '[' : '{';
		const closeBracket = type === 'array' ? ']' : '}';

		const content = document.createElement('span');
		content.className = 'collapsible-content';

		if (autoCollapse) {
			content.style.display = 'none';
		}

		wrapper.appendChild(toggle);
		wrapper.appendChild(container);
		container.appendChild(document.createTextNode(openBracket));

		const contentWrapper = document.createElement('span');
		contentWrapper.className = 'content-inner';
		contentWrapper.appendChild(document.createTextNode('\n    '));

		const elements = renderContent(value);
		elements.forEach((element, i) => {
			if (i > 0) {
				contentWrapper.appendChild(document.createTextNode(',\n    '));
			}
			contentWrapper.appendChild(element);
		});

		contentWrapper.appendChild(document.createTextNode('\n'));
		content.appendChild(contentWrapper);

		// Summary for collapsed state
		const summary = document.createElement('span');
		summary.className = 'collapsed-summary';
		if (type === 'array') {
			summary.textContent = `... ${value.length} item${value.length !== 1 ? 's' : ''}`;
		} else {
			const keyCount = Object.keys(value).length;
			summary.textContent = `... ${keyCount} key${keyCount !== 1 ? 's' : ''}`;
		}
		if (!autoCollapse) {
			summary.style.display = 'none';
		}

		container.appendChild(content);
		container.appendChild(summary);
		container.appendChild(document.createTextNode(closeBracket));

		return wrapper;
	}

	function toggleCollapse(
		wrapper: HTMLElement,
		content: HTMLElement,
		toggle: HTMLElement,
		type: 'array' | 'object'
	) {
		const isCollapsed = wrapper.classList.contains('collapsed');

		if (isCollapsed) {
			wrapper.classList.remove('collapsed');
			wrapper.classList.add('expanded');
			toggle.textContent = '▼';
			content.style.display = '';
			const summary = wrapper.querySelector('.collapsed-summary') as HTMLElement;
			if (summary) summary.style.display = 'none';
		} else {
			wrapper.classList.add('collapsed');
			wrapper.classList.remove('expanded');
			toggle.textContent = '▶';
			content.style.display = 'none';
			const summary = wrapper.querySelector('.collapsed-summary') as HTMLElement;
			if (summary) summary.style.display = 'inline';
		}
	}

	function createQuote(str: string): HTMLElement {
		const span = document.createElement('span');
		span.className = 'value quoted';

		// Check if it's a URL
		const isUrl = /^https?:\/\/[^\s]+$/.test(str);

		span.appendChild(document.createTextNode('"'));

		if (isUrl) {
			const link = document.createElement('a');
			link.className = 'string';
			link.href = str;
			link.textContent = str;
			link.target = '_blank';
			span.appendChild(link);
		} else {
			const strSpan = document.createElement('span');
			strSpan.className = 'string';
			strSpan.textContent = str;
			span.appendChild(strSpan);
		}

		span.appendChild(document.createTextNode('"'));
		return span;
	}

	function createFnCall(fn: string, values: HTMLElement[], className: string): HTMLElement {
		const span = document.createElement('span');
		span.className = `call ${className}`;

		span.appendChild(document.createTextNode(`${fn}(`));
		values.forEach((value, i) => {
			span.appendChild(value);
			if (i < values.length - 1) {
				span.appendChild(document.createTextNode(', '));
			}
		});
		span.appendChild(document.createTextNode(')'));

		return span;
	}

	function enableEditor() {
		editJson = JSON.stringify(json, null, 2);
		editorVisible = true;
	}

	function disableEditor() {
		editorVisible = false;
		editJson = '';
	}

	function save() {
		try {
			const updatedJson = parseJSON(editJson, false);
			disableEditor();
			onedit?.(updatedJson);
		} catch (err: any) {
			notificationStore.notifyError(err.message || 'Invalid JSON');
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
	{#if !editorVisible}
		<div class="pretty-json" bind:this={containerRef}></div>

		{#if !readOnly}
			<div class="actions">
				{#if json._id}
					<button class="btn btn-sm btn-default" onclick={goToDocument}>View Full Document</button>
				{/if}
				<button class="btn btn-sm btn-default" onclick={enableEditor}>Edit</button>
				{#if !removing}
					<button class="btn btn-sm btn-outline-danger" onclick={showRemove}>Remove</button>
				{:else}
					<button class="btn btn-sm btn-danger" onclick={confirmRemove}>Confirm Remove</button>
					<button class="btn btn-sm btn-default" onclick={cancelRemove}>Cancel</button>
				{/if}
			</div>
		{/if}
	{:else}
		<div class="editor">
			<textarea bind:this={editorRef} bind:value={editJson}></textarea>
			<div class="editor-actions">
				<button class="btn btn-success" onclick={save}>Save (Ctrl+Enter)</button>
				<button class="btn btn-default" onclick={disableEditor}>Cancel</button>
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.pretty-json-container {
		background-color: var(--panel-bg);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		padding: 15px;
		margin-bottom: 15px;
		position: relative;
	}

	.pretty-json {
		font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
		font-size: 14px;
		line-height: 1.6;
		white-space: pre-wrap;
		word-wrap: break-word;

		:global(.collapsible-wrapper) {
			display: inline;
			position: relative;
		}

		:global(.collapse-toggle) {
			display: inline-block;
			width: 16px;
			cursor: pointer;
			user-select: none;
			color: var(--text-secondary, #888);
			font-size: 12px;
			margin-right: 4px;
			transition: color 0.2s;

			&:hover {
				color: var(--text, #fff);
			}
		}

		:global(.collapsed-summary) {
			color: var(--text-secondary, #888);
			font-style: italic;
			margin: 0 4px;
		}

		:global(.value) {
			&:global(.number) {
				color: var(--code-numbers);
			}

			&:global(.boolean) {
				color: var(--code-boolean);
			}

			&:global(.null) {
				color: var(--code-null);
			}

			&:global(.quoted) {
				:global(.string) {
					color: var(--code-string);
				}

				:global(a.string) {
					color: var(--code-links);
					text-decoration: underline;
				}
			}

			&:global(.regexp) {
				color: var(--code-regexp);
			}
		}

		:global(.call) {
			&:global(.function) {
				color: var(--code-function);
			}
		}

		:global(var) {
			color: var(--code-namespace);
			font-style: normal;
		}
	}

	.actions {
		display: flex;
		gap: 10px;
		margin-top: 15px;
		padding-top: 15px;
		border-top: 1px solid var(--border-color);
	}

	.editor {
		textarea {
			width: 100%;
			min-height: 300px;
			font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
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
		display: flex;
		gap: 10px;
		margin-top: 15px;
	}
</style>
