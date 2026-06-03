<script lang="ts">
	import { formatShardKey, type ShardKey } from "$lib/utils/shardKey";

	interface Props {
		/** The shard key to display. */
		shardKey: ShardKey;
		/** Optional link target (e.g. the collection's sharding tab). */
		href?: string;
		/** Whether to show the formatted key inline next to the "sharded" label. */
		showKey?: boolean;
	}

	const { shardKey, href, showKey = true }: Props = $props();

	const formatted = $derived(formatShardKey(shardKey));
	const tooltip = $derived(`Shard key: ${formatted}`);
</script>

{#if href}
	<!-- href is passed in already resolved by the caller -->
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a class="shard-badge" {href} title={tooltip}>
		sharded
		{#if showKey}
			<span class="shard-key font-mono">{formatted}</span>
		{/if}
	</a>
{:else}
	<span class="shard-badge" title={tooltip}>
		sharded
		{#if showKey}
			<span class="shard-key font-mono">{formatted}</span>
		{/if}
	</span>
{/if}

<style lang="postcss">
	.shard-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border-radius: 6px;
		padding: 1px 8px;
		font-size: 11px;
		font-weight: 600;
		line-height: 1.6;
		background-color: hsl(150, 60%, 45%);
		color: white;
		text-decoration: none;
		white-space: nowrap;
	}

	a.shard-badge:hover {
		background-color: hsl(150, 60%, 40%);
	}

	.shard-key {
		font-weight: 500;
		font-size: 10px;
		padding-left: 6px;
		border-left: 1px solid rgba(255, 255, 255, 0.4);
		max-width: 220px;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
