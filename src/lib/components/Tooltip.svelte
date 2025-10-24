<script lang="ts">
	import { tick, type Snippet } from "svelte";

	interface Props {
		/** Content to trigger the tooltip */
		trigger: Snippet;
		/** Content to display in the tooltip */
		content: Snippet;
		/** Whether the tooltip is visible */
		show?: boolean;
		/** Additional class for the tooltip container */
		tooltipClass?: string;
	}

	let { trigger, content, show = false, tooltipClass = "" }: Props = $props();

	let tooltipElement = $state<HTMLDivElement>();
	let containerElement = $state<HTMLDivElement>();

	let tooltipPosition = $state({
		left: "",
		right: "",
		top: "",
		bottom: "",
		marginTop: "",
		marginBottom: "",
	});

	$effect(() => {
		if (show && tooltipElement && containerElement) {
			tick().then(() => {
				if (!containerElement || !tooltipElement) return;

				const tooltipRect = tooltipElement.getBoundingClientRect();
				const viewportWidth = window.innerWidth;
				const viewportHeight = window.innerHeight;

				// Reset positioning
				tooltipPosition = {
					left: "",
					right: "",
					top: "",
					bottom: "",
					marginTop: "",
					marginBottom: "",
				};

				// Position horizontally
				if (tooltipRect.right > viewportWidth) {
					tooltipPosition.right = "0";
				} else {
					tooltipPosition.left = "0";
				}

				// Position vertically
				if (tooltipRect.bottom > viewportHeight) {
					tooltipPosition.bottom = "100%";
					tooltipPosition.marginBottom = "5px";
				} else {
					tooltipPosition.top = "100%";
					tooltipPosition.marginTop = "5px";
				}
			});
		}
	});
</script>

<div class="relative inline-block" bind:this={containerElement}>
	{@render trigger()}{#if show}
		<div
			class="absolute bg-[var(--color-2)] border border-[var(--color-3)] rounded z-[1000] shadow-lg {tooltipClass}"
			bind:this={tooltipElement}
			style:left={tooltipPosition.left}
			style:right={tooltipPosition.right}
			style:top={tooltipPosition.top}
			style:bottom={tooltipPosition.bottom}
			style:margin-top={tooltipPosition.marginTop}
			style:margin-bottom={tooltipPosition.marginBottom}
		>
			{@render content()}
		</div>
	{/if}
</div>
