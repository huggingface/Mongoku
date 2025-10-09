<script lang="ts">
	import type { SearchParams } from "$lib/types";

	interface Props {
		params: SearchParams;
		onsearch: () => void;
	}

	let { params, onsearch }: Props = $props();

	let show = $state({
		limit: params.limit !== 20,
		skip: params.skip !== 0,
		sort: params.sort !== "",
		project: params.project !== "",
	});

	function toggle(type: keyof typeof show) {
		show[type] = !show[type];
		if (!show[type]) {
			// Reset to default when hiding
			if (type === "limit") params.limit = 20;
			if (type === "skip") params.skip = 0;
			if (type === "sort") params.sort = "";
			if (type === "project") params.project = "";
			onsearch();
		}
	}

	function canAddParams() {
		return !show.limit || !show.skip || !show.sort || !show.project;
	}

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === "Enter") {
			onsearch();
		}
	}

	function go() {
		if (params.query === "") {
			params.query = "{}";
		}
		onsearch();
	}
</script>

<div class="search-box">
	<div class="search-row">
		<label>Query:</label>
		<input type="text" bind:value={params.query} onkeypress={handleKeyPress} placeholder="&#123;&#125;" />
	</div>

	{#if show.project}
		<div class="search-row">
			<label>Project:</label>
			<input type="text" bind:value={params.project} onkeypress={handleKeyPress} placeholder="&#123;&#125;" />
			<button class="btn btn-sm btn-default" onclick={() => toggle("project")}>×</button>
		</div>
	{/if}

	{#if show.sort}
		<div class="search-row">
			<label>Sort:</label>
			<input type="text" bind:value={params.sort} onkeypress={handleKeyPress} placeholder="&#123;&#125;" />
			<button class="btn btn-sm btn-default" onclick={() => toggle("sort")}>×</button>
		</div>
	{/if}

	{#if show.skip}
		<div class="search-row">
			<label>Skip:</label>
			<input type="number" bind:value={params.skip} onkeypress={handleKeyPress} min="0" />
			<button class="btn btn-sm btn-default" onclick={() => toggle("skip")}>×</button>
		</div>
	{/if}

	{#if show.limit}
		<div class="search-row">
			<label>Limit:</label>
			<input type="number" bind:value={params.limit} onkeypress={handleKeyPress} min="1" />
			<button class="btn btn-sm btn-default" onclick={() => toggle("limit")}>×</button>
		</div>
	{/if}

	<div class="search-actions">
		{#if canAddParams()}
			<div class="dropdown">
				<button class="btn btn-sm btn-default">Add Parameter</button>
				<div class="dropdown-content">
					{#if !show.project}
						<button onclick={() => toggle("project")}>Project</button>
					{/if}
					{#if !show.sort}
						<button onclick={() => toggle("sort")}>Sort</button>
					{/if}
					{#if !show.skip}
						<button onclick={() => toggle("skip")}>Skip</button>
					{/if}
					{#if !show.limit}
						<button onclick={() => toggle("limit")}>Limit</button>
					{/if}
				</div>
			</div>
		{/if}
		<button class="btn btn-success" onclick={go}>Search</button>
	</div>
</div>

<style lang="postcss">
	.search-box {
		background-color: var(--panel-bg);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		padding: 20px;
		margin-bottom: 20px;
	}

	.search-row {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 15px;

		label {
			min-width: 80px;
			font-weight: 500;
		}

		input {
			flex: 1;
		}

		button {
			font-size: 18px;
			padding: 4px 10px;
		}
	}

	.search-actions {
		display: flex;
		gap: 10px;
		justify-content: flex-end;
		margin-top: 20px;
	}

	.dropdown {
		position: relative;
		display: inline-block;

		&:hover .dropdown-content {
			display: block;
		}
	}

	.dropdown-content {
		display: none;
		position: absolute;
		bottom: 100%;
		left: 0;
		background-color: var(--panel-bg);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		z-index: 1;
		margin-bottom: 5px;

		button {
			display: block;
			width: 100%;
			text-align: left;
			padding: 10px 20px;
			border: none;
			background: none;
			color: var(--text);
			cursor: pointer;
			white-space: nowrap;

			&:hover {
				background-color: var(--color-3);
			}
		}
	}
</style>
