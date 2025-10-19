<script lang="ts">
	import { browser } from "$app/environment";
	import { page } from "$app/state";

	let { serverOrigin, readOnly } = $props<{
		serverOrigin: string;
		readOnly: boolean;
	}>();

	const STORAGE_KEY = "mongoku:origin-warning-dismissed";

	let showOriginWarning = $state(false);

	// Check if we should show the origin warning
	$effect(() => {
		if (browser && serverOrigin !== page.url.origin) {
			const dismissed = sessionStorage.getItem(STORAGE_KEY);
			showOriginWarning = !dismissed;
		}
	});

	function dismissWarning() {
		sessionStorage.setItem(STORAGE_KEY, "true");
		showOriginWarning = false;
	}
</script>

{#if showOriginWarning}
	<div class="warning-banner">
		<div class="warning-content">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
				<line x1="12" y1="9" x2="12" y2="13" />
				<line x1="12" y1="17" x2="12.01" y2="17" />
			</svg>
			<span>
				To enable {readOnly ? "server configuration" : "write operations"}, set the <code>MONGOKU_SERVER_ORIGIN</code>
				environment variable to
				<code>{page.url.origin}</code>. Current server origin is <code>{serverOrigin}</code>
			</span>
			<button class="dismiss-button" onclick={dismissWarning} aria-label="Dismiss warning">&times;</button>
		</div>
	</div>
{/if}

<style lang="postcss">
	.warning-banner {
		background-color: #f59e0b;
		color: #111827;
		padding: 12px 24px;
		border-bottom: 1px solid #d97706;
	}

	.warning-content {
		display: flex;
		align-items: center;
		gap: 12px;
		max-width: 1400px;
		margin: 0 auto;

		svg {
			flex-shrink: 0;
		}

		span {
			flex: 1;
			font-size: 14px;
			line-height: 1.5;
		}

		code {
			background-color: rgba(0, 0, 0, 0.1);
			padding: 2px 6px;
			border-radius: 3px;
			font-family: monospace;
			font-size: 13px;
		}
	}

	.dismiss-button {
		background: none;
		border: none;
		font-size: 24px;
		cursor: pointer;
		opacity: 0.7;
		padding: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: #111827;

		&:hover {
			opacity: 1;
		}
	}
</style>
