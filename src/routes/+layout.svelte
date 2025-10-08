<script lang="ts">
	import Breadcrumbs from "$lib/components/Breadcrumbs.svelte";
	import Notifications from "$lib/components/Notifications.svelte";
	import "../app.css";

	let { children } = $props();
</script>

<div class="app">
	<nav class="navbar">
		<div class="container">
			<div class="navbar-content">
				<a href="/" class="navbar-brand">Mongoku</a>
				<Breadcrumbs />
			</div>
		</div>
	</nav>

	<div class="container">
		<Notifications />
		{@render children()}
	</div>
</div>
