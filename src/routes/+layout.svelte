<script lang="ts">
	import Breadcrumbs from "$lib/components/Breadcrumbs.svelte";
	import Notifications from "$lib/components/Notifications.svelte";
	import "../app.css";

	let { children } = $props();
</script>

<div style="min-height: 100vh">
	<nav class="navbar px-8 py-4 flex items-center mb-4">
		<a href="/" class="text-2xl font-medium">Mongoku</a>
		<Breadcrumbs />
	</nav>

	<div class="px-8">
		<Notifications />
		{@render children()}
	</div>
</div>

<style lang="postcss">
	.navbar {
		background-color: var(--color-2);
		border-bottom: var(--border);
	}
</style>
