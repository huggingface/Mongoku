<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		show: boolean;
		onclose: () => void;
		title?: string;
		children?: Snippet;
		footer?: Snippet;
	}

	let { show = false, onclose, title, children, footer }: Props = $props();

	function handleOverlayClick() {
		onclose();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Escape" && show) {
			onclose();
		}
	}
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if show}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={handleOverlayClick}>
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			{#if title}
				<div class="modal-header">
					<h3 style="color: var(--text);">{title}</h3>
				</div>
			{/if}
			<div class="modal-body" style="color: var(--text);">
				{@render children?.()}
			</div>
			{#if footer}
				<div class="modal-footer">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style lang="postcss">
	.modal-header {
		padding: 24px 24px 0;
	}

	.modal-header h3 {
		margin: 0;
		font-size: 1.375rem;
		font-weight: 600;
	}
</style>
