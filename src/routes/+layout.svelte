<script lang="ts">
	import { resolve } from "$app/paths";
	import { createPortal } from "$lib/actions/portal";
	import Breadcrumbs from "$lib/components/Breadcrumbs.svelte";
	import Notifications from "$lib/components/Notifications.svelte";
	import OriginWarning from "$lib/components/OriginWarning.svelte";
	import PageSwitcher from "$lib/components/PageSwitcher.svelte";
	import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";
	import { breadcrumbs } from "$lib/stores/breadcrumbs.svelte";
	import "../app.css";

	let { children, data } = $props();

	const pageTitle = $derived.by(() => {
		const items = breadcrumbs.items.slice(-2).reverse();

		if (items.length === 0) {
			return "Mongoku";
		}

		return items.map((b) => b.label).join(" - ");
	});
</script>

<svelte:head>
	<title>{pageTitle}</title>
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
					<PageSwitcher class="" />
					<ThemeSwitcher />
					{#if data.oauthEnabled && data.user}
						<div class="hidden md:block w-px h-5 bg-[var(--border-color)]"></div>
						<div class="flex items-center gap-1.5">
							<span class="text-xs text-[var(--text-muted)] max-w-32 truncate" title={data.user.email}>
								{data.user.name || data.user.email || "User"}
							</span>
							<form method="POST" action={resolve("/auth/logout")}>
								<button
									type="submit"
									class="inline-flex items-center justify-center rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--hover-background)] transition-colors cursor-pointer"
								>
									Log out
								</button>
							</form>
						</div>
					{/if}
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
