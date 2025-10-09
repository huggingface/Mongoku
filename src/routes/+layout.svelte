<script lang="ts">
	import { resolve } from "$app/paths";
	import Breadcrumbs from "$lib/components/Breadcrumbs.svelte";
	import Notifications from "$lib/components/Notifications.svelte";
	import "../app.css";

	let { children } = $props();
</script>

<div style="min-height: 100vh">
	<nav class="navbar px-6 py-4 flex items-center">
		<a href={resolve("/")} class="text-2xl font-medium">Mongoku</a>
		<Breadcrumbs />
	</nav>

	<div class="px-6 py-6 flex flex-col gap-6">
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
