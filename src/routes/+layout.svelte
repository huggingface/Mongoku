<script lang="ts">
	import { resolve } from "$app/paths";
	import { createPortal } from "$lib/actions/portal";
	import Breadcrumbs from "$lib/components/Breadcrumbs.svelte";
	import Notifications from "$lib/components/Notifications.svelte";
	import OriginWarning from "$lib/components/OriginWarning.svelte";
	import PageSwitcher from "$lib/components/PageSwitcher.svelte";
	import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";
	import "../app.css";

	let { children, data } = $props();
</script>

<svelte:head>
	<title>Mongoku</title>
</svelte:head>

<div style="min-height: 100vh">
	<!-- App bar -->
	<header class="sticky top-0 z-50 border-b border-[var(--border-color)] bg-[var(--background-color)]/80">
		<div class="max-w-[96rem] mx-auto px-4 sm:px-6 lg:px-8">
			<div class="h-14 flex items-center gap-3">
				<!-- Logo -->
				<a href={resolve("/")} class="inline-flex items-center gap-2 group no-underline hover:no-underline">
					<span
						class="inline-flex items-center justify-center w-7 h-7 rounded-md bg-black dark:bg-white text-white dark:text-black text-sm font-semibold select-none"
					>
						M
					</span>
					<span class="text-lg font-semibold tracking-tight" style="color: var(--text);">Mongoku</span>
				</a>

				<div class="hidden md:block w-px h-5 bg-[var(--border-color)]"></div>

				<!-- Breadcrumbs -->
				<Breadcrumbs />

				<div class="ml-auto flex items-center gap-2">
					<!-- View tabs -->
					<PageSwitcher class="" />
					<ThemeSwitcher />
				</div>
			</div>
		</div>
	</header>

	<OriginWarning serverOrigin={data.serverOrigin} readOnly={data.readOnly} />

	<!-- Main -->
	<main class="max-w-[96rem] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
		<Notifications />
		<div class="flex flex-col gap-6">
			{@render children()}
		</div>
	</main>

	<!-- Portal container for tooltips and other overlay content -->
	<div use:createPortal></div>
</div>
