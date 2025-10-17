<script lang="ts">
	import { resolve } from "$app/paths";
	import type { MappingTarget, MongoDocument } from "$lib/types";
	import JsonValue from "./JsonValue.svelte";

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
		localTopLevel?: boolean;
		/** Mappings for the collection */
		mappings?: Record<string, MappingTarget | MappingTarget[]>;
		/** Server name */
		server?: string;
		/** Database name */
		database?: string;
		/** Collection name */
		collection?: string;
		/** Current field path (for nested fields) */
		fieldPath?: string;
	}

	let {
		value,
		key,
		autoCollapse = false,
		collapsed = false,
		localTopLevel = true,
		depth = 0,
		mappings,
		server,
		database,
		collection,
		fieldPath = "",
	}: Props = $props();

	function toggleCollapse() {
		collapsed = !collapsed;
	}

	function getIndent(level: number): string {
		return INDENT.repeat(level);
	}

	function isUrl(str: string): boolean {
		return /^https?:\/\/[^\s]+$/.test(str);
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
					default:
						return "object";
				}
			default:
				return "unknown";
		}
	}

	let valueType = $derived(getValueType(value));
	let isCollapsible = $derived(valueType === "array" || valueType === "object");
	let isEmpty = $derived(
		(valueType === "array" && value.length === 0) || (valueType === "object" && Object.keys(value).length === 0),
	);

	// Compute current field path
	let currentFieldPath = $derived(key ? (fieldPath ? `${fieldPath}.${key}` : key) : fieldPath);

	// Helper function to normalize field path by removing numeric array indices
	// e.g., "comments.0.authorId" -> "comments.authorId"
	function normalizeFieldPath(path: string): string {
		return path.replace(/\.\d+\./g, ".").replace(/\.\d+$/, "");
	}

	// Check if this field has a mapping (only primitive values can have mappings, not arrays/objects)
	// For array items, we normalize the path to match patterns like "comments.authorId"
	let hasMapping = $derived.by(() => {
		if (!mappings || !currentFieldPath || valueType === "array" || valueType === "object") {
			return false;
		}
		// Check exact match first
		if (mappings[currentFieldPath] !== undefined) {
			return true;
		}
		// Check normalized path (for array items)
		const normalized = normalizeFieldPath(currentFieldPath);
		return normalized !== currentFieldPath && mappings[normalized] !== undefined;
	});

	// Get the actual mapping key (either exact or normalized)
	let mappingKey = $derived.by(() => {
		if (!hasMapping || !mappings || !currentFieldPath) return null;
		if (mappings[currentFieldPath] !== undefined) return currentFieldPath;
		const normalized = normalizeFieldPath(currentFieldPath);
		return mappings[normalized] !== undefined ? normalized : null;
	});

	// State for tooltip
	let showTooltip = $state(false);
	let tooltipTimeout: ReturnType<typeof setTimeout> | null = null;
	let mappedDocs = $state<Record<string, MongoDocument | null>>({});
	let loadingMapped = $state(false);

	// Derived: Get the first found document for navigation
	let firstFoundDoc = $derived.by(() => {
		if (!hasMapping || !mappingKey) return null;

		const targets = Array.isArray(mappings![mappingKey])
			? (mappings![mappingKey] as MappingTarget[])
			: [mappings![mappingKey] as MappingTarget];

		for (const target of targets) {
			const doc = mappedDocs[target.collection];
			if (doc) {
				return { doc, collection: target.collection };
			}
		}
		return null;
	});

	function handleMouseEnter() {
		if (!hasMapping || !mappingKey || !server || !database || !collection || value === null || value === undefined)
			return;

		showTooltip = true;

		// Delay loading the mapped documents
		tooltipTimeout = setTimeout(async () => {
			loadingMapped = true;

			try {
				const targets = Array.isArray(mappings![mappingKey])
					? (mappings![mappingKey] as MappingTarget[])
					: [mappings![mappingKey] as MappingTarget];

				const docs: Record<string, MongoDocument | null> = {};

				// Extract the actual value to search for
				// Handle special types like ObjectId, Date, etc.
				let searchValue = value;
				if (value?.$type === "ObjectId" && value?.$value) {
					searchValue = value.$value;
				} else if (value?.$type === "Date" && value?.$value) {
					searchValue = value.$value;
				}

				// Fetch documents via API for each target
				for (const target of targets) {
					try {
						const response = await fetch("/api/fetch-document", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								server,
								database,
								collection: target.collection,
								field: target.on,
								value: searchValue,
							}),
						});

						if (response.ok) {
							const result = await response.json();
							docs[target.collection] = result.found ? result.document : null;
						} else {
							docs[target.collection] = null;
						}
					} catch (err) {
						console.error(`Failed to fetch from ${target.collection}:`, err);
						docs[target.collection] = null;
					}
				}

				mappedDocs = docs;
			} catch (error) {
				console.error("Failed to load mapped documents:", error);
			} finally {
				loadingMapped = false;
			}
		}, 300);
	}

	function handleMouseLeave() {
		showTooltip = false;
		if (tooltipTimeout) {
			clearTimeout(tooltipTimeout);
			tooltipTimeout = null;
		}
	}

	function handleMappedClick() {
		if (!firstFoundDoc || !server || !database) return;

		const documentId = firstFoundDoc.doc._id?.$value;
		const url = `/servers/${encodeURIComponent(server)}/databases/${encodeURIComponent(database)}/collections/${encodeURIComponent(firstFoundDoc.collection)}/documents/${documentId}`;
		window.location.href = url;
	}
</script>

{#if key !== undefined}
	<span class="prop" class:collapsible={isCollapsible && !isEmpty} class:collapsed>
		{getIndent(depth + 1)}<var>{key}</var>: <JsonValue
			{value}
			{autoCollapse}
			collapsed={autoCollapse}
			depth={depth + 1}
			localTopLevel={false}
			{mappings}
			{server}
			{database}
			{collection}
			fieldPath={currentFieldPath}
		/>
	</span>
{:else}
	{#snippet renderValue()}
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
		{:else if valueType === "array"}
			{#if isEmpty}
				<span class="value array">[]</span>
			{:else}
				<span class="collapsible-wrapper" class:collapsed class:expanded={!collapsed}>
					<button class="collapse-toggle" onclick={toggleCollapse}>
						{collapsed ? "▶" : "▼"}
					</button><span class="value array">
						[<span class="collapsible-content" class:hidden={collapsed}>
							{#each value as item, i (i)}
								<br />{getIndent(depth + 1)}<JsonValue
									value={item}
									{autoCollapse}
									collapsed={false}
									depth={depth + 1}
									{mappings}
									{server}
									{database}
									{collection}
									fieldPath={`${currentFieldPath}.${i}`}
								/>{/each}
							<br />{getIndent(depth)}
						</span>{#if collapsed}
							<button class="collapsed-summary" onclick={toggleCollapse}
								>... {value.length} item{value.length !== 1 ? "s" : ""}</button
							>
						{/if}]
					</span>
				</span>
			{/if}
		{:else if valueType === "object"}
			{#if isEmpty}
				<span class="value object">{"{}"}</span>
			{:else}
				<span class="collapsible-wrapper" class:collapsed class:expanded={!collapsed}>
					{#if depth !== 0}<button
							class="collapse-toggle"
							class:local-top-level={localTopLevel}
							onclick={toggleCollapse}
						>
							{collapsed ? "▶" : "▼"}
						</button>{/if}<span class="value object">
						{"{"}<span class="collapsible-content" class:hidden={collapsed}
							>{#each Object.keys(value) as objKey (objKey)}
								<JsonValue
									value={value[objKey]}
									key={objKey}
									{autoCollapse}
									collapsed={autoCollapse}
									{depth}
									{mappings}
									{server}
									{database}
									{collection}
									fieldPath={currentFieldPath}
								/>{/each}
						</span>{#if collapsed}
							<button class="collapsed-summary" onclick={toggleCollapse}
								>... {Object.keys(value).length} key{Object.keys(value).length !== 1 ? "s" : ""}</button
							>
						{:else}
							{getIndent(depth)}
						{/if}}
					</span>
				</span>
			{/if}
		{:else}
			<span>{String(value)}</span>
		{/if}
	{/snippet}
	<!-- Root value rendering -->
	{#if hasMapping && server && database}
		<!-- Mapped value wrapper -->
		<span class="relative inline-block">
			<span
				role="button"
				tabindex="0"
				class="mapped-value"
				class:has-mapping={hasMapping}
				class:clickable={firstFoundDoc}
				onmouseenter={handleMouseEnter}
				onmouseleave={handleMouseLeave}
				onclick={handleMappedClick}
				onkeydown={(e) => e.key === "Enter" && handleMappedClick()}
			>
				<!-- Render the actual value -->
				{@render renderValue()}
			</span>
			{#if showTooltip}
				<span class="mapping-tooltip">
					{#if loadingMapped}
						<div class="p-2">Loading...</div>
					{:else}
						{@const targets = mappingKey
							? Array.isArray(mappings![mappingKey])
								? (mappings![mappingKey] as MappingTarget[])
								: [mappings![mappingKey] as MappingTarget]
							: []}
						{@const hasAnyMatch = Object.values(mappedDocs).some((doc) => doc !== null)}
						{#each targets as target}
							{@const doc = mappedDocs[target.collection]}
							{#if doc}
								<div class="mapping-entry">
									<div class="mapping-header">
										{target.collection}
									</div>
									<div class="mapping-content">
										<a
											href={resolve(
												`/servers/${encodeURIComponent(server)}/databases/${encodeURIComponent(database)}/collections/${encodeURIComponent(target.collection)}/documents/${doc._id?.$value}`,
											)}
											class="mapped-link"
											target="_blank"
										>
											<JsonValue value={doc} autoCollapse={true} collapsed={false} depth={0} />
										</a>
									</div>
								</div>
							{/if}
						{/each}
						{#if !hasAnyMatch}
							<div class="mapping-not-found">Not found in any collection</div>
						{/if}
					{/if}
				</span>
			{/if}
		</span>
	{:else}
		{@render renderValue()}
	{/if}
	{#if depth !== 0},{/if}
{/if}

<style lang="postcss">
	.prop {
		position: relative;
		display: block;
	}

	.collapsible-wrapper {
		display: inline;
		position: relative;

		.collapse-toggle {
			display: inline-block;
			width: 16px;
			cursor: pointer;
			user-select: none;
			color: var(--text-secondary, #888);
			font-size: 12px;
			margin-right: 4px;
			transition: color 0.2s;
			background: none;
			border: none;
			padding: 0;
			font-family: inherit;

			&.local-top-level {
				position: absolute;
				left: -18px;
				margin-top: 4px;
			}

			&:hover {
				color: var(--text, #fff);
			}
		}

		&.collapsed .collapsible-content {
			display: none;
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
		cursor: pointer;
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

	.mapped-value {
		position: relative;

		&.has-mapping {
			border-bottom: 1px dotted var(--code-function);
		}

		&.clickable {
			cursor: pointer;

			&:hover {
				border-bottom-style: solid;
			}
		}

		&:not(.clickable) {
			cursor: help;
		}
	}

	.mapping-tooltip {
		position: absolute;
		top: 100%;
		left: 0;
		margin-top: 5px;
		background: var(--color-2);
		border: 1px solid var(--color-3);
		border-radius: 4px;
		padding: 8px;
		z-index: 1000;
		min-width: 300px;
		max-width: 600px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		white-space: normal;
	}

	.mapping-entry {
		margin-bottom: 8px;

		&:last-child {
			margin-bottom: 0;
		}
	}

	.mapping-header {
		font-weight: bold;
		color: var(--text);
		margin-bottom: 4px;
		padding-bottom: 4px;
		border-bottom: 1px solid var(--color-3);
	}

	.mapping-content {
		padding: 4px;
		font-size: 0.9em;
	}

	.mapped-link {
		color: var(--code-function);
		text-decoration: none;

		&:hover {
			text-decoration: underline;
		}
	}

	.mapping-not-found {
		color: var(--text-secondary);
		font-style: italic;
		cursor: help;
	}
</style>
