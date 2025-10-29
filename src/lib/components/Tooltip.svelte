<script lang="ts">
	import { portal } from "$lib/actions/portal";
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
		/** Callback when mouse enters the tooltip content */
		onTooltipMouseEnter?: () => void;
		/** Callback when mouse leaves the tooltip content */
		onTooltipMouseLeave?: () => void;
	}

	let { trigger, content, show = false, tooltipClass = "", onTooltipMouseEnter, onTooltipMouseLeave }: Props = $props();

	let tooltipElement = $state<HTMLDivElement>();
	let containerElement = $state<HTMLDivElement>();

	let tooltipPosition = $state({
		left: "",
		right: "",
		top: "",
	});

	$effect(() => {
		if (show && tooltipElement && containerElement) {
			tick().then(() => {
				if (!containerElement || !tooltipElement) return;

				const containerRect = containerElement.getBoundingClientRect();
				const tooltipRect = tooltipElement.getBoundingClientRect();
				const viewportWidth = window.innerWidth;
				const viewportHeight = window.innerHeight;

				// Reset positioning
				tooltipPosition = {
					left: "",
					right: "",
					top: "",
				};

				// Position horizontally
				const wouldOverflowRight = containerRect.left + tooltipRect.width > viewportWidth;
				if (wouldOverflowRight) {
					// Align to the right edge of the container
					tooltipPosition.right = `${viewportWidth - containerRect.right}px`;
				} else {
					// Align to the left edge of the container
					tooltipPosition.left = `${containerRect.left}px`;
				}

				// Position vertically - prefer below, but show above if no room
				const spaceBelow = viewportHeight - containerRect.bottom;
				const spaceAbove = containerRect.top;
				const MARGIN = 5;

				if (spaceBelow >= tooltipRect.height + MARGIN || spaceBelow > spaceAbove) {
					// Show below
					tooltipPosition.top = `${containerRect.bottom + MARGIN}px`;
				} else {
					// Show above
					tooltipPosition.top = `${containerRect.top - tooltipRect.height - MARGIN}px`;
				}
			});
		}
	});
</script>

<!-- The formatting is intentional to avoid adding extra spaces around the trigger -->
<div class="relative inline-block" bind:this={containerElement}>{@render trigger()}</div>{#if show}
	<div
		use:portal
		role="tooltip"
		class="fixed bg-[var(--light-background)] border border-[var(--border-color)] rounded-2xl z-[1000] shadow-xl backdrop-blur-md {tooltipClass}"
		bind:this={tooltipElement}
		style:left={tooltipPosition.left}
		style:right={tooltipPosition.right}
		style:top={tooltipPosition.top}
		style="color: var(--text);"
		onmouseenter={onTooltipMouseEnter}
		onmouseleave={onTooltipMouseLeave}
	>
		{@render content()}
	</div>
{/if}
