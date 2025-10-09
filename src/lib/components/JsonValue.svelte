<script lang="ts">
	import JsonValue from "./JsonValue.svelte";

	const INDENT = "    ";

	interface Props {
		value: any;
		key?: string;
		/** are sub items collapsed by default*/
		autoCollapse?: boolean;
		/** is it collapsed at top level */
		collapsed?: boolean;
		depth?: number;
		localTopLevel?: boolean;
	}

	let { value, key, autoCollapse = false, collapsed = false, localTopLevel = true, depth = 0 }: Props = $props();

	function toggleCollapse() {
		collapsed = !collapsed;
	}

	function getIndent(level: number): string {
		return INDENT.repeat(level);
	}

	function isUrl(str: string): boolean {
		return /^https?:\/\/[^\s]+$/.test(str);
	}

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
</script>

{#if key !== undefined}
	<span class="prop" class:collapsible={isCollapsible && !isEmpty} class:collapsed>
		{getIndent(depth + 1)}<var>{key}</var>: <JsonValue
			{value}
			{autoCollapse}
			collapsed={autoCollapse}
			depth={depth + 1}
			localTopLevel={false}
		/>
	</span>
{:else}
	<!-- Root value rendering -->
	{#if valueType === "string"}
		<span class="value quoted">
			"<span class="string" class:url={isUrl(value)}>
				{#if isUrl(value)}
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
						{#each value as item, i}
							<br />{getIndent(depth + 1)}<JsonValue
								value={item}
								{autoCollapse}
								collapsed={false}
								depth={depth + 1}
							/>{/each}
						<br />{getIndent(depth)}
					</span>{#if collapsed}
						<span class="collapsed-summary">... {value.length} item{value.length !== 1 ? "s" : ""}</span>
					{/if}]
				</span>
			</span>
		{/if}
	{:else if valueType === "object"}
		{#if isEmpty}
			<span class="value object">{"{}"}</span>
		{:else}
			<span class="collapsible-wrapper" class:collapsed class:expanded={!collapsed}>
				{#if depth !== 0}<button class="collapse-toggle" class:local-top-level={localTopLevel} onclick={toggleCollapse}>
						{collapsed ? "▶" : "▼"}
					</button>{/if}<span class="value object">
					{"{"}<span class="collapsible-content" class:hidden={collapsed}
						>{#each Object.keys(value) as objKey, i}
							<JsonValue value={value[objKey]} key={objKey} {autoCollapse} collapsed={autoCollapse} {depth} />{/each}
					</span>{#if collapsed}
						<span class="collapsed-summary"
							>... {Object.keys(value).length} key{Object.keys(value).length !== 1 ? "s" : ""}</span
						>
					{:else}
						{getIndent(depth)}
					{/if}{"}"}
				</span>
			</span>
		{/if}
	{:else}
		<span>{String(value)}</span>
	{/if},
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
</style>
