<script lang="ts">
	import Panel from "$lib/components/Panel.svelte";
	import { formatBytes, formatNumber } from "$lib/utils/filters";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
</script>

<Panel title="Collections in {data.database}">
	<table class="table">
		<thead>
			<tr>
				<th>Name</th>
				<th>Documents</th>
				<th>Size</th>
			</tr>
		</thead>
		<tbody>
			{#if data.collections && data.collections.length > 0}
				{#each data.collections as collection}
					<tr>
						<td>
							<a
								href="/servers/{encodeURIComponent(data.server)}/databases/{encodeURIComponent(
									data.database,
								)}/collections/{encodeURIComponent(collection.name)}?query={encodeURIComponent(
									'{}',
								)}&sort=&project=&skip=0&limit=20"
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
							{#if collection.size !== undefined}
								{formatBytes(collection.size)}
							{/if}
						</td>
					</tr>
				{/each}
			{:else}
				<tr>
					<td colspan="3">
						<div class="text-center">No collections...</div>
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
</Panel>
