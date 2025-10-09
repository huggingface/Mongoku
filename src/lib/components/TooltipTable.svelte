<script lang="ts">
	import { tick, type Snippet } from "svelte";

	interface TableColumn {
		header: string;
		key: string;
		align?: "left" | "right" | "center";
		formatter?: (value: any) => string;
	}

	interface TableRow {
		[key: string]: any;
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
	let tooltipElement = $state<HTMLDivElement>();
	let containerElement = $state<HTMLDivElement>();

	let tooltipPosition = $state({
		left: "",
		right: "",
		top: "",
		bottom: "",
		marginTop: "",
		marginBottom: "",
	});

	function handleMouseEnter() {
		showTooltip = true;
	}

	function handleMouseLeave() {
		showTooltip = false;
	}

	$effect(() => {
		if (showTooltip && tooltipElement && containerElement) {
			tick().then(() => {
				if (!containerElement || !tooltipElement) return;

				const tooltipRect = tooltipElement.getBoundingClientRect();
				const viewportWidth = window.innerWidth;
				const viewportHeight = window.innerHeight;

				// Reset positioning
				tooltipPosition = {
					left: "",
					right: "",
					top: "",
					bottom: "",
					marginTop: "",
					marginBottom: "",
				};

				// Position horizontally
				if (tooltipRect.right > viewportWidth) {
					tooltipPosition.right = "0";
				} else {
					tooltipPosition.left = "0";
				}

				// Position vertically
				if (tooltipRect.bottom > viewportHeight) {
					tooltipPosition.bottom = "100%";
					tooltipPosition.marginBottom = "5px";
				} else {
					tooltipPosition.top = "100%";
					tooltipPosition.marginTop = "5px";
				}
			});
		}
	});
</script>

<div class="relative inline-block" bind:this={containerElement}>
	<button class="dotted text-center" onmouseenter={handleMouseEnter} onmouseleave={handleMouseLeave}>
		{@render children?.()}
	</button>
	{#if showTooltip}
		<div
			class="absolute bg-[var(--color-2)] border border-[var(--color-3)] rounded p-0 z-[1000] whitespace-nowrap shadow-lg"
			bind:this={tooltipElement}
			style:left={tooltipPosition.left}
			style:right={tooltipPosition.right}
			style:top={tooltipPosition.top}
			style:bottom={tooltipPosition.bottom}
			style:margin-top={tooltipPosition.marginTop}
			style:margin-bottom={tooltipPosition.marginBottom}
		>
			<table class="w-full border-collapse text-base font-medium">
				{#if !hideHeader}
					<thead>
						<tr>
							{#each columns as column}
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
					{#each rows as row}
						<tr>
							{#each columns as column}
								<td
									class="px-2 py-1 border-b border-[var(--color-3)]"
									class:text-left={column.align === "left" || !column.align}
									class:text-right={column.align === "right"}
									class:text-center={column.align === "center"}
								>
									{column.formatter ? column.formatter(row[column.key]) : row[column.key]}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
