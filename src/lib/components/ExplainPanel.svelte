<script lang="ts">
	import JsonValue from "./JsonValue.svelte";
	import Modal from "./Modal.svelte";

	interface Props {
		data: unknown;
		show: boolean;
		onclose: () => void;
	}

	let { data, show, onclose }: Props = $props();

	// Recursively find index name in the execution plan tree
	function findIndexInPlan(plan: Record<string, unknown> | undefined): string | null {
		if (!plan) return null;

		// Check if this stage has an index
		if (plan.indexName) {
			return String(plan.indexName);
		}

		// Check if this is an IXSCAN stage
		if (plan.stage === "IXSCAN" && plan.indexName) {
			return String(plan.indexName);
		}

		// Recursively check inputStage
		if (plan.inputStage) {
			const result = findIndexInPlan(plan.inputStage as Record<string, unknown>);
			if (result) return result;
		}

		// Check inputStages array (for some aggregation plans)
		if (Array.isArray(plan.inputStages)) {
			for (const stage of plan.inputStages) {
				const result = findIndexInPlan(stage as Record<string, unknown>);
				if (result) return result;
			}
		}

		// Check queryPlan (for some MongoDB versions)
		if (plan.queryPlan) {
			const result = findIndexInPlan(plan.queryPlan as Record<string, unknown>);
			if (result) return result;
		}

		return null;
	}

	// Check if plan contains COLLSCAN (no index used)
	function hasCollScan(plan: Record<string, unknown> | undefined): boolean {
		if (!plan) return false;

		if (plan.stage === "COLLSCAN") return true;

		if (plan.inputStage) {
			if (hasCollScan(plan.inputStage as Record<string, unknown>)) return true;
		}

		if (Array.isArray(plan.inputStages)) {
			for (const stage of plan.inputStages) {
				if (hasCollScan(stage as Record<string, unknown>)) return true;
			}
		}

		if (plan.queryPlan) {
			if (hasCollScan(plan.queryPlan as Record<string, unknown>)) return true;
		}

		return false;
	}

	// Extract key metrics from explain output
	const metrics = $derived.by(() => {
		if (!data || typeof data !== "object") return null;

		const d = data as Record<string, unknown>;
		const execStats = d.executionStats as Record<string, unknown> | undefined;
		const queryPlanner = d.queryPlanner as Record<string, unknown> | undefined;
		const winningPlan = queryPlanner?.winningPlan as Record<string, unknown> | undefined;

		// Find index name recursively in the plan
		const indexName = findIndexInPlan(winningPlan);

		// Determine if COLLSCAN is used
		const isCollScan = hasCollScan(winningPlan);

		// Set index used
		let indexUsed: string;
		if (indexName) {
			indexUsed = indexName;
		} else if (isCollScan) {
			indexUsed = "COLLSCAN";
		} else {
			indexUsed = "N/A";
		}

		// Determine the main stage
		const stage = winningPlan?.stage ?? "N/A";

		return {
			executionTimeMs: execStats?.executionTimeMillis ?? "N/A",
			docsExamined: execStats?.totalDocsExamined ?? "N/A",
			keysExamined: execStats?.totalKeysExamined ?? "N/A",
			nReturned: execStats?.nReturned ?? "N/A",
			indexUsed,
			stage,
		};
	});

	// Calculate efficiency ratio: nReturned / keysExamined
	// When index used: nReturned / keysExamined
	// When COLLSCAN (keysExamined = 0): 0% efficiency
	const efficiency = $derived.by(() => {
		if (!metrics) return null;
		const keysExamined = Number(metrics.keysExamined);
		const returned = Number(metrics.nReturned);

		if (keysExamined > 0) {
			// Index used: nReturned / keysExamined
			return ((returned / keysExamined) * 100).toFixed(1);
		}
		// COLLSCAN: 0% efficiency (no index used)
		return "0.0";
	});

	// For display
	const efficiencyLabel = $derived.by(() => {
		if (!metrics) return "";
		const keysExamined = Number(metrics.keysExamined);
		const docsExamined = Number(metrics.docsExamined);
		const returned = Number(metrics.nReturned);

		if (keysExamined > 0) {
			return `${returned} / ${keysExamined} keys to docs`;
		}
		return `${keysExamined} keys / ${docsExamined} docs`;
	});

	// Determine if the query is efficient
	const isEfficient = $derived.by(() => {
		if (!metrics) return null;
		// COLLSCAN is generally inefficient for large collections
		if (metrics.indexUsed === "COLLSCAN" || metrics.indexUsed === "N/A") return false;
		// Has an index - that's good
		return true;
	});
</script>

<Modal {show} {onclose} title="Execution Stats" wide={true}>
	<!-- Quick metrics summary -->
	{#if metrics}
		<div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
			<div class="metric-card">
				<span class="metric-label">Execution Time</span>
				<span class="metric-value">{metrics.executionTimeMs}ms</span>
			</div>
			<div class="metric-card">
				<span class="metric-label">Documents Returned</span>
				<span class="metric-value"
					>{typeof metrics.nReturned === "number" ? metrics.nReturned.toLocaleString() : metrics.nReturned}</span
				>
			</div>
			<div class="metric-card">
				<span class="metric-label">Documents Examined</span>
				<span class="metric-value"
					>{typeof metrics.docsExamined === "number"
						? metrics.docsExamined.toLocaleString()
						: metrics.docsExamined}</span
				>
			</div>
			<div class="metric-card">
				<span class="metric-label">Keys Examined</span>
				<span class="metric-value"
					>{typeof metrics.keysExamined === "number"
						? metrics.keysExamined.toLocaleString()
						: metrics.keysExamined}</span
				>
			</div>
			<div class="metric-card">
				<span class="metric-label">Index Used</span>
				<span
					class="metric-value"
					class:warning={metrics.indexUsed === "COLLSCAN"}
					class:good={metrics.indexUsed !== "COLLSCAN"}
				>
					{metrics.indexUsed}
				</span>
			</div>
			<div class="metric-card">
				<span class="metric-label">Query Stage</span>
				<span class="metric-value">{metrics.stage}</span>
			</div>
		</div>

		<!-- Efficiency indicator -->
		{#if efficiency !== null}
			<div class="efficiency-bar mb-6">
				<div class="flex justify-between items-center mb-2">
					<span class="text-sm font-semibold" style="color: var(--text);">Efficiency</span>
					<span class="text-sm font-mono" style="color: var(--text-secondary);">
						{efficiencyLabel} ({efficiency}%)
					</span>
				</div>
				<div class="h-2 rounded-full bg-[var(--color-3)] overflow-hidden">
					<div
						class="h-full rounded-full transition-all duration-300"
						class:bg-green-500={isEfficient && Number(efficiency) >= 70}
						class:bg-yellow-500={isEfficient && Number(efficiency) >= 30 && Number(efficiency) < 70}
						class:bg-red-500={!isEfficient || Number(efficiency) < 30}
						style="width: {isEfficient ? Math.min(Number(efficiency), 100) : 100}%"
					></div>
				</div>
				{#if isEfficient === false}
					<p class="text-xs mt-2" style="color: var(--error);">
						⚠️ This query is using a collection scan (COLLSCAN). Consider adding an index for better performance.
					</p>
				{/if}
			</div>
		{/if}
	{/if}

	<!-- Full explain output -->
	<details class="mt-4">
		<summary class="cursor-pointer text-sm font-semibold mb-3" style="color: var(--link);">
			View full explain output
		</summary>
		<div
			class="p-4 rounded-xl bg-[var(--color-3)] font-mono text-sm overflow-auto max-h-[400px] border border-[var(--border-color)]"
		>
			<JsonValue value={data} collapsed={false} />
		</div>
	</details>

	{#snippet footer()}
		<button class="btn btn-default btn-sm" onclick={onclose}>Close</button>
	{/snippet}
</Modal>

<style lang="postcss">
	.metric-card {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 16px;
		border-radius: 12px;
		background-color: var(--color-3);
		border: 1px solid var(--border-color);
	}

	.metric-label {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.metric-value {
		font-size: 20px;
		font-weight: 600;
		font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
		color: var(--text);
	}

	.metric-value.warning {
		color: var(--error);
	}

	.metric-value.good {
		color: var(--button-success);
	}
</style>
