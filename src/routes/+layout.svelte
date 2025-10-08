<script lang="ts">
	import '../app.css';
	import Notifications from '$lib/components/Notifications.svelte';

	let { children } = $props();
</script>

<div class="app">
	<nav class="navbar">
		<div class="container">
			<a href="/" class="navbar-brand">Mongoku</a>
		</div>
	</nav>

	<div class="container">
		<Notifications />
		{@render children()}
	</div>
</div>
