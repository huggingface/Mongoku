<script lang="ts">
	import Panel from "$lib/components/Panel.svelte";
	import TooltipTable from "$lib/components/TooltipTable.svelte";
	import { formatBytes } from "$lib/utils/filters";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
</script>

<Panel title="Databases on {data.server}">
	<table class="table">
		<thead>
			<tr>
				<th>Name</th>
				<th>Collections</th>
				<th>Size</th>
			</tr>
		</thead>
		<tbody>
			{#if data.databases && data.databases.length > 0}
				{#each data.databases as database}
					<tr>
						<td>
							<a
								href="/servers/{encodeURIComponent(data.server)}/databases/{encodeURIComponent(
									database.name,
								)}/collections"
							>
								{database.name}
							</a>
						</td>
						<td>
							{#if database.collections}
								<TooltipTable
									columns={[
										{ header: "Collection", key: "name", align: "left" },
										{ header: "Size", key: "size", align: "right", formatter: formatBytes },
									]}
									rows={database.collections.map((collection) => ({
										name: collection.name,
										size: collection.size,
									}))}
								>
									{database.collections.length}
								</TooltipTable>
							{/if}
						</td>
						<td>
							{#if database.size !== undefined}
								<TooltipTable
									hideHeader
									columns={[
										{ header: "Metric", key: "metric", align: "left" },
										{ header: "Value", key: "value", align: "right" },
									]}
									rows={[
										{ metric: "Total Size", value: database.size },
										{ metric: "Data Size", value: database.dataSize },
										{ metric: "Storage Size", value: database.storageSize },
										{ metric: "Index Size", value: database.totalIndexSize },
										{ metric: "Avg Object Size", value: database.avgObjSize },
										{ metric: "Empty", value: database.empty ? "Yes" : "No" },
									].map((row) => ({
										...row,
										value: typeof row.value === "number" ? formatBytes(row.value) : row.value,
									}))}
								>
									{formatBytes(database.size)}
								</TooltipTable>
							{/if}
						</td>
					</tr>
				{/each}
			{:else}
				<tr>
					<td colspan="3">
						<div class="text-center">No databases...</div>
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
</Panel>
