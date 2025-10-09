<script lang="ts">
	import { resolve } from "$app/paths";
	import Panel from "$lib/components/Panel.svelte";
	import TooltipTable from "$lib/components/TooltipTable.svelte";
	import { formatBytes, formatNumber } from "$lib/utils/filters";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
</script>

<Panel title="{data.database} collections">
	<table class="table">
		<thead>
			<tr>
				<th>Name</th>
				<th>Documents</th>
				<th>Indexes</th>
				<th>Size</th>
			</tr>
		</thead>
		<tbody>
			{#if data.collections && data.collections.length > 0}
				{#each data.collections as collection (collection.name)}
					<tr>
						<td>
							<a
								href={resolve(`/servers/${encodeURIComponent(data.server)}/databases/${encodeURIComponent(
									data.database,
								)}/collections/{encodeURIComponent(collection.name)}?query={encodeURIComponent(
									'{}',
								)}&sort=&project=&skip=0&limit=20`)}
							>
								{collection.name}
							</a>
						</td>
						<td>
							{#if collection.count !== undefined}
								{formatNumber(collection.count)}
							{/if}
						</td>
						<td>
							{#if collection.nIndexes !== undefined}
								<TooltipTable
									columns={[
										{ header: "Index", key: "definition", align: "left" },
										{ header: "Size", key: "size", align: "right" },
									]}
									rows={(collection.indexes || []).map((index) => ({
										definition: index.key ? JSON.stringify(index.key, null, 1) : index.name,
										size: formatBytes(index.size),
									}))}
								>
									{formatNumber(collection.nIndexes)}
								</TooltipTable>
							{/if}
						</td>
						<td>
							{#if collection.size !== undefined}
								<TooltipTable
									hideHeader
									columns={[
										{ header: "Label", key: "label", align: "left" },
										{ header: "Value", key: "value", align: "right" },
									]}
									rows={[
										{ label: "Average obj. size", value: collection.avgObjSize },
										{ label: "Data size", value: collection.dataSize },
										{ label: "Storage size", value: collection.storageSize },
										{ label: "Index size", value: collection.totalIndexSize },
									].map((row) => ({
										...row,
										value: typeof row.value === "number" ? formatBytes(row.value) : row.value,
									}))}
								>
									{formatBytes(collection.size)}
								</TooltipTable>
							{/if}
						</td>
					</tr>
				{/each}
			{:else}
				<tr>
					<td colspan="4">
						<div class="text-center">No collections...</div>
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
</Panel>
