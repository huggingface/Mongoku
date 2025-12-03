<script lang="ts">
	import { countDocumentsByTimeRange } from "$api/servers.remote";
	import IconChevronDown from "$lib/icons/IconChevronDown.svelte";
	import { formatNumber } from "$lib/utils/filters";

	interface Props {
		server: string;
		database: string;
		collection: string;
	}

	let { server, database, collection }: Props = $props();

	const TIME_RANGES = [
		{ label: "Last 24 hours", days: 1 },
		{ label: "Last 7 days", days: 7 },
		{ label: "Last 30 days", days: 30 },
		{ label: "Last 90 days", days: 90 },
	];

	let isOpen = $state(false);
	let isLoading = $state(false);
	let stats = $state<Array<{ label: string; days: number; count: number | null; error: string | null }> | null>(null);
	let loadError = $state<string | null>(null);

	async function loadStats() {
		if (stats !== null || isLoading) return;

		isLoading = true;
		loadError = null;

		try {
			const result = await countDocumentsByTimeRange({
				server,
				database,
				collection,
				timeRanges: TIME_RANGES,
			});

			if (result.error) {
				loadError = result.error;
			} else {
				stats = result.data;
			}
		} catch (err) {
			loadError = err instanceof Error ? err.message : String(err);
		} finally {
			isLoading = false;
		}
	}

	function toggle() {
		isOpen = !isOpen;
		if (isOpen && stats === null) {
			loadStats();
		}
	}

	function refresh() {
		stats = null;
		loadStats();
	}
</script>

<div class="time-range-stats">
	<button class="toggle-btn" onclick={toggle} aria-expanded={isOpen} aria-label="Toggle new documents statistics">
		<span class="icon">📊</span>
		<span class="label">New Documents</span>
		<IconChevronDown class="chevron {isOpen ? 'rotate' : ''}" />
	</button>

	{#if isOpen}
		<div class="stats-panel">
			{#if isLoading}
				<div class="loading">
					<span class="spinner"></span>
					<span>Loading statistics...</span>
				</div>
			{:else if loadError}
				<div class="error">
					<span>⚠️ {loadError}</span>
					<button class="retry-btn" onclick={refresh}>Retry</button>
				</div>
			{:else if stats}
				<div class="stats-grid">
					{#each stats as stat (stat.label)}
						<div class="stat-item">
							<div class="stat-label">{stat.label}</div>
							<div class="stat-value">
								{#if stat.error}
									<span class="stat-error" title={stat.error}>⚠️</span>
								{:else if stat.count !== null}
									<span class="count">{formatNumber(stat.count)}</span>
									<span class="docs">docs</span>
								{:else}
									<span class="stat-error">—</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
				<button class="refresh-btn" onclick={refresh} title="Refresh statistics"> 🔄 </button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.time-range-stats {
		position: relative;
		margin-bottom: 1rem;
	}

	.toggle-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: var(--light-background);
		border: 1px solid var(--border-color);
		border-radius: 0.75rem;
		color: var(--text);
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.toggle-btn:hover {
		background: var(--color-3);
	}

	.icon {
		font-size: 1rem;
	}

	.label {
		color: var(--text);
	}

	:global(.chevron) {
		width: 1rem;
		height: 1rem;
		transition: transform 0.2s ease;
		color: var(--text-secondary);
	}

	:global(.chevron.rotate) {
		transform: rotate(180deg);
	}

	.stats-panel {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 50;
		margin-top: 0.5rem;
		padding: 1rem;
		background: var(--background);
		border: 1px solid var(--border-color);
		border-radius: 0.75rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		min-width: 280px;
	}

	.loading {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--text-secondary);
		font-size: 0.875rem;
	}

	.spinner {
		width: 1rem;
		height: 1rem;
		border: 2px solid var(--border-color);
		border-top-color: var(--link);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		color: var(--error);
		font-size: 0.875rem;
	}

	.retry-btn {
		padding: 0.25rem 0.75rem;
		background: var(--color-3);
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		color: var(--text);
		cursor: pointer;
		font-size: 0.75rem;
		transition: background 0.2s ease;
	}

	.retry-btn:hover {
		background: var(--light-background);
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
	}

	.stat-item {
		padding: 0.75rem;
		background: var(--color-3);
		border-radius: 0.5rem;
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--text-secondary);
		margin-bottom: 0.25rem;
	}

	.stat-value {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
	}

	.count {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}

	.docs {
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.stat-error {
		color: var(--error);
	}

	.refresh-btn {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		padding: 0.25rem;
		background: transparent;
		border: none;
		cursor: pointer;
		font-size: 0.875rem;
		opacity: 0.6;
		transition: opacity 0.2s ease;
	}

	.refresh-btn:hover {
		opacity: 1;
	}
</style>
