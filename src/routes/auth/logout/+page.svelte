<script lang="ts">
	import { resolve } from "$app/paths";
</script>

<div class="flex flex-col items-center justify-center py-24 gap-4">
	<h1 class="text-xl font-semibold">You've been logged out</h1>
	<p class="text-sm text-[var(--text-muted)]">Your session has been ended.</p>
	<a href={resolve("/auth/login")} class="btn btn-default btn-sm mt-2">Log back in</a>
</div>
