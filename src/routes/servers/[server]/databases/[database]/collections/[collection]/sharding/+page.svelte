<script lang="ts">
	import Panel from "$lib/components/Panel.svelte";
	import { formatBytes, formatNumber } from "$lib/utils/filters";
	import { formatShardKey } from "$lib/utils/shardKey";

	const { data } = $props();

	function pct(value: number, total: number): number {
		if (total <= 0) {
			return 0;
		}
		return Math.round((value / total) * 100);
	}

	// Deterministic color per shard for the distribution bar.
	const shardColors = [
		"hsl(210, 70%, 55%)",
		"hsl(150, 60%, 45%)",
		"hsl(38, 92%, 50%)",
		"hsl(280, 60%, 58%)",
		"hsl(0, 70%, 58%)",
		"hsl(190, 65%, 48%)",
		"hsl(330, 65%, 58%)",
		"hsl(95, 55%, 45%)",
	];
</script>

{#await data.sharding}
	<Panel title="Sharding">
		<div class="loading p-4">Loading sharding info...</div>
	</Panel>
{:then result}
	{#if !result || result.error}
		<Panel title="Sharding">
			<div class="p-4">
				<p class="error">{result?.error ?? "Failed to load sharding info"}</p>
			</div>
		</Panel>
	{:else}
		{@const info = result.data}
		{#if !info}
			<Panel title="Sharding">
				<div class="p-4 text-center" style="color: var(--text-darker);">No data</div>
			</Panel>
		{:else if !info.shardingEnabled}
			<Panel title="Sharding">
				<div class="p-6 text-center">
					<div class="text-3xl mb-2">⛁</div>
					<p style="color: var(--text);">This server is not a sharded cluster.</p>
					<p class="text-sm mt-1" style="color: var(--text-darker);">
						Connect through a <code>mongos</code> router to view shard distribution.
					</p>
				</div>
			</Panel>
		{:else}
			{@const totalChunks = info.totalChunks}
			{@const totalDocs = info.shards.reduce((acc, s) => acc + (s.documents ?? 0), 0)}
			{@const totalSize = info.shards.reduce((acc, s) => acc + (s.size ?? 0), 0)}

			<!-- Status summary -->
			<Panel title="Sharding status" class="mb-4">
				<div class="p-4 flex flex-wrap gap-4 items-center">
					{#if info.sharded}
						<span class="badge badge-sharded">Sharded</span>
					{:else}
						<span class="badge badge-unsharded">Not sharded</span>
					{/if}
					{#if info.hashed}
						<span class="badge badge-prop">hashed</span>
					{/if}
					{#if info.unique}
						<span class="badge badge-prop">unique key</span>
					{/if}
					{#if info.sharded}
						{#if info.balancerEnabled}
							<span class="badge badge-ok">balancer on</span>
						{:else}
							<span class="badge badge-warn">balancing disabled</span>
						{/if}
					{/if}

					{#if info.shardKey}
						<div class="key-pill" title="Shard key">
							<span class="key-label">shard key</span>
							<span class="font-mono text-sm">{formatShardKey(info.shardKey)}</span>
						</div>
					{/if}

					{#if info.sharded}
						<div class="ml-auto text-sm" style="color: var(--text-darker);">
							{formatNumber(totalChunks)} chunk{totalChunks === 1 ? "" : "s"} across {info.shards.length} shard{info
								.shards.length === 1
								? ""
								: "s"}
						</div>
					{/if}
				</div>

				{#if info.warning}
					<div class="px-4 pb-3 text-sm" style="color: var(--warning, hsl(38, 92%, 45%));">⚠ {info.warning}</div>
				{/if}
			</Panel>

			<!-- Distribution bar (chunks) -->
			{#if info.sharded && totalChunks > 0}
				<Panel title="Chunk distribution" class="mb-4">
					<div class="p-4">
						<div class="dist-bar">
							{#each info.shards as shard, i (shard.shardId)}
								{#if shard.chunks > 0}
									<div
										class="dist-seg"
										style="width: {pct(shard.chunks, totalChunks)}%; background: {shardColors[i % shardColors.length]};"
										title="{shard.shardId}: {shard.chunks} chunks ({pct(shard.chunks, totalChunks)}%)"
									>
										{#if pct(shard.chunks, totalChunks) >= 8}
											{pct(shard.chunks, totalChunks)}%
										{/if}
									</div>
								{/if}
							{/each}
						</div>
						<div class="legend">
							{#each info.shards as shard, i (shard.shardId)}
								<div class="legend-item">
									<span class="legend-dot" style="background: {shardColors[i % shardColors.length]};"></span>
									<span class="font-mono text-xs">{shard.shardId}</span>
								</div>
							{/each}
						</div>
					</div>
				</Panel>
			{/if}

			<!-- Per-shard table -->
			<Panel title="Per-shard breakdown">
				<div class="table-wrapper">
					<table class="table">
						<thead>
							<tr>
								<th>Shard</th>
								<th>Host</th>
								{#if info.sharded}
									<th class="shrink-column">Chunks</th>
								{/if}
								<th class="shrink-column">Documents</th>
								<th class="shrink-column">Size</th>
							</tr>
						</thead>
						<tbody>
							{#each info.shards as shard, i (shard.shardId)}
								<tr>
									<td>
										<span
											class="legend-dot inline-block mr-2"
											style="background: {shardColors[i % shardColors.length]};"
										></span>
										<span class="font-mono text-sm">{shard.shardId}</span>
									</td>
									<td>
										<span class="font-mono text-xs" style="color: var(--text-darker);">{shard.host}</span>
									</td>
									{#if info.sharded}
										<td>
											{formatNumber(shard.chunks)}
											<span class="text-xs" style="color: var(--text-darker);">
												({pct(shard.chunks, totalChunks)}%)
											</span>
										</td>
									{/if}
									<td>
										{#if shard.documents != null}
											{formatNumber(shard.documents)}
											{#if totalDocs > 0}
												<span class="text-xs" style="color: var(--text-darker);">
													({pct(shard.documents, totalDocs)}%)
												</span>
											{/if}
										{:else}
											<span style="color: var(--text-darker);">-</span>
										{/if}
									</td>
									<td>
										{#if shard.size != null}
											{formatBytes(shard.size)}
											{#if totalSize > 0}
												<span class="text-xs" style="color: var(--text-darker);">
													({pct(shard.size, totalSize)}%)
												</span>
											{/if}
										{:else}
											<span style="color: var(--text-darker);">-</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Panel>
		{/if}
	{/if}
{:catch err}
	<Panel title="Sharding">
		<div class="p-4">
			<p class="error">Error loading sharding info: {err}</p>
		</div>
	</Panel>
{/await}

<style lang="postcss">
	.table-wrapper {
		overflow-x: auto;
	}

	.shrink-column {
		width: 1%;
		white-space: nowrap;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		border-radius: 6px;
		padding: 4px 10px;
		font-size: 13px;
		font-weight: 600;
	}

	.badge-sharded {
		background-color: hsl(150, 60%, 45%);
		color: white;
	}

	.badge-unsharded {
		background-color: hsl(0, 0%, 45%);
		color: white;
	}

	.badge-prop {
		background-color: hsl(220, 70%, 55%);
		color: white;
	}

	.badge-ok {
		background-color: var(--color-3);
		color: var(--text);
		border: 1px solid var(--color-4);
	}

	.badge-warn {
		background-color: hsl(38, 92%, 50%);
		color: var(--text-inverse);
	}

	.key-pill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border-radius: 6px;
		padding: 4px 10px;
		background-color: var(--color-3);
		border: 1px solid var(--color-4);
		color: var(--text);
	}

	.key-label {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-darker);
	}

	.dist-bar {
		display: flex;
		width: 100%;
		height: 28px;
		border-radius: 6px;
		overflow: hidden;
		background-color: var(--color-1);
		border: 1px solid var(--border-color);
	}

	.dist-seg {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		font-weight: 600;
		color: white;
		overflow: hidden;
		white-space: nowrap;
		transition: width 0.2s ease;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 12px;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.legend-dot {
		width: 12px;
		height: 12px;
		border-radius: 3px;
		flex-shrink: 0;
	}

	.error {
		color: var(--error);
	}
</style>
