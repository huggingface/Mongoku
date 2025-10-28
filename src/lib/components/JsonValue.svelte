<script lang="ts">
	import { resolve } from "$app/paths";
	import type { MongoDocument } from "$lib/types";
	import JsonValue from "./JsonValue.svelte";
	import Tooltip from "./Tooltip.svelte";

	const INDENT = "    ";

	interface Props {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		value: any;
		key?: string;
		/** are sub items collapsed by default*/
		autoCollapse?: boolean;
		/** is it collapsed at top level */
		collapsed?: boolean;
		depth?: number;
		/** Function to check if a key path has a mapping */
		isKeyMapped?: (path: string) => boolean;
		/** Function to fetch a mapped document and get its URL */
		fetchMappedDocument?: (
			path: string,
			value: unknown,
		) => Promise<{ document: MongoDocument | null; url: string | null; collection: string | null }>;
		/** full path to current key (e.g., "user.address.city") */
		keyPath?: string;
	}

	let {
		value,
		key,
		autoCollapse = false,
		collapsed = false,
		depth = 0,
		isKeyMapped,
		fetchMappedDocument,
		keyPath = "",
	}: Props = $props();

	function getIndent(level: number): string {
		return INDENT.repeat(level);
	}

	function isUrl(str: string): boolean {
		return /^https?:\/\/[^\s]+$/.test(str);
	}

	// Mapping-related state and functions
	let showTooltip = $state(false);
	let fetchedDocument = $state<MongoDocument | null>(null);
	let fetchedUrl = $state<string | null>(null);
	let fetchedCollection = $state<string | null>(null);
	let isFetching = $state(false);
	let fetchError = $state<string | null>(null);

	// Check if current key has a mapping
	const currentKeyPath = $derived([keyPath, key].filter(Boolean).join("."));

	async function handleMouseEnter() {
		if (!hasMappings || !fetchMappedDocument) return;

		showTooltip = true;

		// If already fetched, don't fetch again
		if (fetchedDocument || isFetching) return;

		isFetching = true;
		fetchError = null;

		try {
			const result = await fetchMappedDocument(currentKeyPath, value);

			if (!result.document) {
				fetchError = "Document not found";
			} else {
				fetchedDocument = result.document;
				fetchedUrl = result.url;
				fetchedCollection = result.collection;
			}
		} catch (err) {
			fetchError = err instanceof Error ? err.message : "Failed to fetch document";
		} finally {
			isFetching = false;
		}
	}

	function handleMouseLeave() {
		showTooltip = false;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function getValueType(val: any): string {
		if (val === null) return "null";
		if (Array.isArray(val)) return "array";

		switch (typeof val) {
			case "boolean":
				return "boolean";
			case "number":
				return "number";
			case "string":
				return "string";
			case "object":
				switch (val.$type) {
					case "ObjectId":
						return "objectid";
					case "Date":
						return "date";
					case "RegExp":
						return "regexp";
					case "Binary":
						return "binary";
					default:
						return "object";
				}
			default:
				return "unknown";
		}
	}

	const valueType = $derived(getValueType(value));

	const hasMappings = $derived(
		!!isKeyMapped &&
			!!fetchMappedDocument &&
			key === undefined &&
			isKeyMapped(currentKeyPath) &&
			value !== null &&
			value !== undefined &&
			valueType !== "array" &&
			valueType !== "object",
	);

	let isCollapsible = $derived(valueType === "array" || valueType === "object");
	let isEmpty = $derived(
		(valueType === "array" && value.length === 0) || (valueType === "object" && Object.keys(value).length === 0),
	);
	let innerCollapsed = $state(autoCollapse);

	function toggleInnerCollapse() {
		innerCollapsed = !innerCollapsed;
	}
</script>

{#if key !== undefined}
	{#if isCollapsible && !isEmpty}
		{#if innerCollapsed}
			<span
				class="prop collapsible collapsed"
				onclick={toggleInnerCollapse}
				role="button"
				tabindex="0"
				onkeydown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						toggleInnerCollapse();
					}
				}}
			>
				{getIndent(depth + 1)}<span class="collapse-arrow"> ▶ </span><var>{key}</var>: <JsonValue
					{value}
					{autoCollapse}
					collapsed={innerCollapsed}
					depth={depth + 1}
					{isKeyMapped}
					{fetchMappedDocument}
					keyPath={currentKeyPath}
				/>
			</span>
		{:else}
			<span class="prop collapsible">
				{getIndent(depth + 1)}<span
					class="collapse-arrow arrow-only"
					onclick={(e) => {
						e.stopPropagation();
						toggleInnerCollapse();
					}}
					role="button"
					tabindex="0"
					onkeydown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							e.stopPropagation();
							toggleInnerCollapse();
						}
					}}
				>
					▼
				</span><var>{key}</var>: <JsonValue
					{value}
					{autoCollapse}
					collapsed={innerCollapsed}
					depth={depth + 1}
					{isKeyMapped}
					{fetchMappedDocument}
					keyPath={currentKeyPath}
				/>
			</span>
		{/if}
	{:else}
		<span class="prop">
			{getIndent(depth + 1)}<var>{key}</var>: <JsonValue
				{value}
				{autoCollapse}
				collapsed={innerCollapsed}
				depth={depth + 1}
				{isKeyMapped}
				{fetchMappedDocument}
				keyPath={currentKeyPath}
			/>
		</span>
	{/if}
{:else}
	{#snippet valueSnippet()}
		<!-- Root value rendering -->
		{#if valueType === "string"}
			<span class="value quoted">
				"<span class="string" class:url={isUrl(value)}>
					{#if isUrl(value)}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={value} target="_blank">{value}</a>
					{:else}
						{value}
					{/if}
				</span>"
			</span>
		{:else if valueType === "number"}
			<span class="value number">{value}</span>
		{:else if valueType === "boolean"}
			<span class="value boolean">{value}</span>
		{:else if valueType === "null"}
			<span class="value null">null</span>
		{:else if valueType === "objectid"}
			<span class="call function">ObjectId("<span class="string">{value.$value}</span>")</span>
		{:else if valueType === "date"}
			<span class="call function">Date("<span class="string">{value.$value}</span>")</span>
		{:else if valueType === "regexp"}
			<span class="value regexp">/{value.$value.$pattern}/{value.$value.$flags}</span>
		{:else if valueType === "binary"}
			<span class="call function"
				>BinData(<span class="number">{value.$subType}</span>, "<span class="string"
					>{value.$value.length > 40 ? value.$value.substring(0, 40) + "..." : value.$value}</span
				>")</span
			>
		{:else if valueType === "array"}
			{#if isEmpty}
				<span class="value array">[]</span>
			{:else}
				<span class="value array">
					[<span class="collapsible-content" class:hidden={collapsed}>
						{#each value as item, i (i)}
							<br />{getIndent(depth + 1)}<JsonValue
								value={item}
								{autoCollapse}
								collapsed={false}
								depth={depth + 1}
								keyPath={currentKeyPath}
								{isKeyMapped}
								{fetchMappedDocument}
							/>{/each}
						<br />{getIndent(depth)}
					</span>{#if collapsed}
						<span class="collapsed-summary">... {value.length} item{value.length !== 1 ? "s" : ""}</span>
					{/if}]
				</span>
			{/if}
		{:else if valueType === "object"}
			{#if isEmpty}
				<span class="value object">{"{}"}</span>
			{:else}
				<span class="value object">
					{"{"}<span class="collapsible-content" class:hidden={collapsed}
						>{#each Object.keys(value) as objKey (objKey)}
							<JsonValue
								value={value[objKey]}
								key={objKey}
								{autoCollapse}
								collapsed={autoCollapse}
								{depth}
								{isKeyMapped}
								{fetchMappedDocument}
								keyPath={currentKeyPath}
							/>{/each}
					</span>{#if collapsed}
						<span class="collapsed-summary"
							>... {Object.keys(value).length} key{Object.keys(value).length !== 1 ? "s" : ""}</span
						>
					{:else}
						{getIndent(depth)}
					{/if}}
				</span>
			{/if}
		{:else}
			<span>{String(value)}</span>
		{/if}
	{/snippet}
	{#if hasMappings}
		<Tooltip show={showTooltip} tooltipClass="max-w-[600px] max-h-[400px] overflow-auto whitespace-pre-wrap">
			{#snippet trigger()}
				<span
					class="string mapped"
					class:url={isUrl(value)}
					onmouseenter={handleMouseEnter}
					onmouseleave={handleMouseLeave}
					role="button"
					tabindex="0"
				>
					{#if fetchedUrl}
						<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
						<a href={resolve(fetchedUrl as any)}>{@render valueSnippet?.()}</a>
					{:else}
						{@render valueSnippet?.()}
					{/if}
				</span>
			{/snippet}
			{#snippet content()}
				{#if isFetching}
					<div class="text-[var(--text-secondary)]">Loading...</div>
				{:else if fetchError}
					<div class="text-[var(--danger,#f44336)]">{fetchError}</div>
				{:else if fetchedDocument}
					<!-- prettier-ignore -->
					<div>
						{#if fetchedCollection}<div
								class="px-2 py-1 pt-2 border-b border-[var(--border-color)] bg-[var(--color-4)] font-bold"
							>
								{fetchedCollection}
							</div>{/if}<div class="font-mono text-sm p-2">
							<JsonValue value={fetchedDocument} autoCollapse={true} collapsed={false} />
						</div>
					</div>
				{/if}
			{/snippet}
		</Tooltip>
	{:else}
		{@render valueSnippet?.()}
	{/if}{#if depth !== 0},{/if}
{/if}

<style lang="postcss">
	.prop {
		position: relative;
		display: block;

		&.collapsible {
			&.collapsed {
				cursor: pointer;
				user-select: none;

				&:hover .collapse-arrow {
					color: var(--text, #fff);
				}
			}
		}
	}

	.collapse-arrow {
		display: inline-block;
		width: 16px;
		color: var(--text-secondary, #888);
		font-size: 12px;
		margin-right: 4px;
		margin-left: -20px;
		transition: color 0.2s;

		&.arrow-only {
			cursor: pointer;

			&:hover {
				color: var(--text, #fff);
			}
		}
	}

	.collapsible-content {
		white-space: pre;

		&.hidden {
			display: none;
		}
	}

	.collapsed-summary {
		color: var(--text-secondary, #888);
		font-style: italic;
		margin: 0 4px;
	}

	.value {
		&.number {
			color: var(--code-numbers);
		}

		&.boolean {
			color: var(--code-boolean);
		}

		&.null {
			color: var(--code-null);
		}

		&.quoted {
			.string {
				color: var(--code-string);

				&.url a {
					color: var(--code-string);
					text-decoration: underline;

					&:hover {
						color: var(--code-links);
					}
				}
			}
		}

		&.regexp {
			color: var(--code-regexp);
		}
	}

	.call {
		&.function {
			color: var(--code-function);
		}
	}

	var {
		color: var(--code-namespace);
		font-style: normal;
	}

	/* Mapped value styles */
	.mapped {
		text-decoration: underline;
		text-decoration-style: dotted;
		text-decoration-color: var(--code-links, #61afef);
		text-underline-offset: 2px;
		cursor: pointer;

		a {
			color: inherit;
			text-decoration: inherit;

			&:hover {
				color: var(--code-links, #61afef);
			}
		}
	}
</style>
