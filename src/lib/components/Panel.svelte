<script lang="ts">
	let { children } = $props();
</script>

<div class="panel">
	{@render children()}
</div>

<style lang="postcss">
	.panel {
		background-color: var(--panel-bg);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		margin-bottom: 20px;
		padding-left: 20px;
		padding-right: 20px;
		padding-top: 5px;
		padding-bottom: 5px;

		:global(.title) {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 20px;
			font-size: 20px;
			font-weight: 500;

			:global(.actions) {
				display: flex;
				gap: 10px;
				align-items: center;
			}
		}
	}
</style>
