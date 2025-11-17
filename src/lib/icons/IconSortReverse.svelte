<script lang="ts">
	interface Props {
		class?: string;
	}

	let { class: className = "w-4 h-4" }: Props = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={className}
>
	<path d="M3 6h18" />
	<path d="M7 12h10" />
	<path d="M10 18h4" />
	<path d="m7 16 3 3 3-3" />
</svg>
