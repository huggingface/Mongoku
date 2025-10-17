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
								href={resolve(
									`/servers/${encodeURIComponent(data.server)}/databases/${encodeURIComponent(
										data.database,
									)}/collections/${encodeURIComponent(collection.name)}?query=${encodeURIComponent(
										"{}",
									)}&sort=&project=&skip=0&limit=20`,
								)}
							>
								{collection.name}
							</a>
							{#if collection.hasMapping}
								<span class="ml-2" title="Has mappings">🔗</span>
							{/if}
						</td>
						<td>
							{#await collection.details}
								<span class="text-gray-400">...</span>
							{:then details}
								{#if details}
									{formatNumber(details.count)}
								{:else}
									<span title="Failed to load">❌</span>
								{/if}
							{/await}
						</td>
						<td>
							{#await collection.details}
								<span class="text-gray-400">...</span>
							{:then details}
								{#if details}
									<TooltipTable
										columns={[
											{ header: "Index", key: "definition", align: "left" },
											{ header: "Size", key: "size", align: "right" },
										]}
										rows={details.indexes.map((index) => ({
											definition: index.key ? JSON.stringify(index.key, null, 1) : index.name,
											size: formatBytes(index.size),
										}))}
									>
										{formatNumber(details.nIndexes)}
									</TooltipTable>
								{:else}
									<span title="Failed to load">❌</span>
								{/if}
							{/await}
						</td>
						<td>
							{#await collection.details}
								<span class="text-gray-400">...</span>
							{:then details}
								{#if details}
									<TooltipTable
										hideHeader
										columns={[
											{ header: "Label", key: "label", align: "left" },
											{ header: "Value", key: "value", align: "right" },
										]}
										rows={[
											{ label: "Average obj. size", value: details.avgObjSize },
											{ label: "Data size", value: details.dataSize },
											{ label: "Storage size", value: details.storageSize },
											{ label: "Index size", value: details.totalIndexSize },
										].map((row) => ({
											...row,
											value: typeof row.value === "number" ? formatBytes(row.value) : row.value,
										}))}
									>
										{formatBytes(details.size)}
									</TooltipTable>
								{:else}
									<span title="Failed to load">❌</span>
								{/if}
							{/await}
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
