<script lang="ts">
	import type { Snippet } from "svelte";
	import Tooltip from "./Tooltip.svelte";

	interface TableColumn {
		header: string;
		key: string;
		align?: "left" | "right" | "center";
	}

	interface TableRow {
		[key: string]: unknown;
	}

	let {
		columns,
		rows,
		children,
		hideHeader,
	}: {
		columns: TableColumn[];
		rows: TableRow[];
		children: Snippet;
		hideHeader?: boolean;
	} = $props();

	let showTooltip = $state(false);

	function handleMouseEnter() {
		showTooltip = true;
	}

	function handleMouseLeave() {
		showTooltip = false;
	}
</script>

<Tooltip show={showTooltip} tooltipClass="p-0 whitespace-nowrap">
	{#snippet trigger()}
		<button class="dotted text-center" onmouseenter={handleMouseEnter} onmouseleave={handleMouseLeave}>
			{@render children?.()}
		</button>
	{/snippet}
	{#snippet content()}
		<table class="w-full border-collapse text-base font-medium">
			{#if !hideHeader}
				<thead>
					<tr>
						{#each columns as column, index (index)}
							<th
								class="px-2 py-1 border-b border-[var(--color-3)] bg-[var(--color-4)] font-bold"
								class:text-left={column.align === "left" || !column.align}
								class:text-right={column.align === "right"}
								class:text-center={column.align === "center"}
							>
								{column.header}
							</th>
						{/each}
					</tr>
				</thead>
			{/if}
			<tbody>
				{#each rows as row, rowIndex (rowIndex)}
					<tr>
						{#each columns as column, index (index)}
							<td
								class="px-2 py-1"
								class:border-b={rowIndex < rows.length - 1}
								class:border-[var(--color-3)]={rowIndex < rows.length - 1}
								class:text-left={column.align === "left" || !column.align}
								class:text-right={column.align === "right"}
								class:text-center={column.align === "center"}
							>
								{row[column.key]}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	{/snippet}
</Tooltip>
