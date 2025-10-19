<script lang="ts">
	import { resolve } from "$app/paths";
	import Breadcrumbs from "$lib/components/Breadcrumbs.svelte";
	import Notifications from "$lib/components/Notifications.svelte";
	import OriginWarning from "$lib/components/OriginWarning.svelte";
	import PageSwitcher from "$lib/components/PageSwitcher.svelte";
	import "../app.css";

	let { children, data } = $props();
</script>

<div style="min-height: 100vh">
	<nav class="navbar px-6 py-4 flex items-center">
		<a href={resolve("/")} class="text-2xl font-medium">Mongoku</a>
		<Breadcrumbs />
		<PageSwitcher class="ml-auto" />
	</nav>

	<OriginWarning serverOrigin={data.serverOrigin} readOnly={data.readOnly} />

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
