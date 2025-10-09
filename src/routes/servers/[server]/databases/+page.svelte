<script lang="ts">
	import Panel from "$lib/components/Panel.svelte";
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
								<span class="dotted" title="Collections">{database.collections.length}</span>
							{/if}
						</td>
						<td>
							{#if database.size !== undefined}
								{formatBytes(database.size)}
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
