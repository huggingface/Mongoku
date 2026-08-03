<script lang="ts">
	import { listCollections } from "$api/servers.remote";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { clickOutside } from "$lib/actions/clickOutside";
	import IconChevronDown from "$lib/icons/IconChevronDown.svelte";

	// The collection breadcrumb itself is the trigger (flat until hovered, with
	// a trailing chevron). It lets the user jump to the same view (Documents /
	// Schema / …) on another collection of the same database. The collection
	// list is loaded lazily on first open and kept for the session — collection
	// lists change rarely, and the dropdown always links to full page loads
	// anyway (mirroring PageSwitcher).

	const server = $derived(page.params.server ?? "");
	const database = $derived(page.params.database ?? "");
	const collection = $derived(page.params.collection ?? "");

	// Last route segment ("documents", "schema", …). We switch collection while
	// keeping the current view, so a user auditing schemas can audit another
	// collection in one click. Only meaningful on collection view pages — on a
	// document detail page (…/documents/<id>) we fall back to "documents".
	const view = $derived.by(() => {
		const keys = ["documents", "indexes", "sharding", "mappings", "schema"];
		const last = page.url.pathname.split("/").at(-1) ?? "documents";
		return keys.includes(last) ? last : "documents";
	});

	let open = $state(false);
	let names = $state<string[] | null>(null);
	let failed = $state(false);
	let filter = $state("");

	// Incremented on every load attempt and on every server/database change; a
	// response only lands if its token is still current, so a slow request for a
	// previous server/database can't overwrite freshly-reset state (and wrongly
	// skip the next refetch).
	let loadToken = 0;

	// Reset the cached list when moving to another database or server, and
	// invalidate any in-flight load so its late response is dropped.
	$effect(() => {
		void server;
		void database;
		loadToken++;
		open = false;
		names = null;
		failed = false;
		filter = "";
	});

	const filtered = $derived((names ?? []).filter((name) => name.toLowerCase().includes(filter.trim().toLowerCase())));

	function toggle() {
		open = !open;
		if (open && names === null && !failed) {
			load();
		}
	}

	async function load() {
		const token = ++loadToken;
		const s = server;
		const db = database;
		try {
			// `.run()` because we're in an event handler, not a reactive context —
			// awaiting a `query` directly there throws.
			const { data } = await listCollections({ server: s, database: db }).run();
			// Bail out if the user navigated to another server/database (which
			// bumps loadToken via the reset effect) while the request was in flight.
			if (token !== loadToken || s !== server || db !== database) {
				return;
			}
			names = data;
		} catch {
			if (token === loadToken && s === server && db === database) {
				failed = true;
			}
		}
	}

	function retry() {
		failed = false;
		load();
	}

	function href(name: string) {
		return (
			`/servers/${encodeURIComponent(server)}` +
			`/databases/${encodeURIComponent(database)}` +
			`/collections/${encodeURIComponent(name)}/${view}`
		);
	}
</script>

{#if server && database && collection}
	<div class="relative flex" use:clickOutside={() => (open = false)}>
		<button
			type="button"
			onclick={toggle}
			class="flex items-center gap-1 px-2 py-1 rounded-md font-medium hover:bg-[var(--color-3)] transition cursor-pointer"
			style="color: var(--text); background: {open ? 'var(--color-3)' : 'transparent'};"
			aria-haspopup="menu"
			aria-expanded={open}
			aria-current="page"
			title="Switch collection"
		>
			{collection}
			<IconChevronDown class="w-4 h-4 transition-transform {open ? 'rotate-180' : ''}" />
		</button>

		{#if open}
			<div
				class="absolute left-0 top-full mt-1 min-w-56 max-w-80 rounded-lg border border-[var(--border-color)] bg-[var(--light-background)] shadow-lg overflow-hidden z-50"
				role="menu"
			>
				{#if names === null && !failed}
					<div class="px-3 py-2 text-[13px]" style="color: var(--text-secondary);">Loading…</div>
				{:else if failed}
					<div class="flex items-center gap-2 px-3 py-2 text-[13px]" style="color: var(--text-secondary);">
						Failed to load
						<button type="button" class="underline cursor-pointer" style="color: var(--link);" onclick={retry}>
							Retry
						</button>
					</div>
				{:else}
					{#if names && names.length > 8}
						<div class="border-b border-[var(--border-color)]">
							<!-- rounded-none/border-0/bg-transparent override the global
							     input[type=text] style (app.css) which forces rounded-2xl,
							     padding and a filled background on every text input -->
							<input
								type="text"
								bind:value={filter}
								placeholder="Filter collections…"
								class="w-full rounded-none border-0 bg-transparent px-3 py-1.5 text-[13px] focus:outline-none"
								style="color: var(--text);"
							/>
						</div>
					{/if}
					<div class="max-h-72 overflow-y-auto">
						{#each filtered as name (name)}
							{@const isCurrent = name === collection}
							<!-- data-sveltekit-reload mirrors PageSwitcher tabs (avoids glitches when
							     switching from the documents view to other views) -->
							<!-- eslint-disable @typescript-eslint/no-explicit-any -->
							<a
								data-sveltekit-reload
								href={resolve(href(name) as any)}
								role="menuitem"
								onclick={() => (open = false)}
								class="flex items-center justify-between gap-3 px-3 py-1.5 text-[13px] no-underline hover:bg-[var(--color-3)] transition"
								style="color: {isCurrent ? 'var(--text)' : 'var(--text-secondary)'};"
								class:font-medium={isCurrent}
							>
								<span class="truncate">{name}</span>
								{#if isCurrent}
									<span class="text-[var(--link)]" aria-hidden="true">✓</span>
								{/if}
							</a>
						{:else}
							<div class="px-3 py-2 text-[13px]" style="color: var(--text-secondary);">
								{names && names.length > 0 ? "No matching collections" : "No collections"}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
