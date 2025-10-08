<script lang="ts">
	import type { PageData } from './$types';
	import Panel from '$lib/components/Panel.svelte';
	import { formatBytes } from '$lib/utils/filters';

	let { data }: { data: PageData } = $props();
</script>

<div class="databases-page">
	<Panel>
		<div class="title">
			<span>Databases on {data.server}</span>
		</div>

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
										database.name
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
							<div class="center">No databases...</div>
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</Panel>
</div>

<style lang="scss">
	.databases-page {
		padding: 40px 0;
	}
</style>
