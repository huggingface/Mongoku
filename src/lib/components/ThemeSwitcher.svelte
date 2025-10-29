<script lang="ts">
	type Theme = "system" | "light" | "dark";

	let currentTheme = $state<Theme>("system");
	let systemTheme = $state<"light" | "dark">("light");

	// Load theme from localStorage on mount and listen for system theme changes
	$effect(() => {
		if (typeof window !== "undefined") {
			const stored = localStorage.getItem("theme") as Theme | null;
			currentTheme = stored || "system";

			// Detect system theme
			const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
			systemTheme = mediaQuery.matches ? "dark" : "light";

			// Listen for system theme changes
			const handler = (e: MediaQueryListEvent) => {
				systemTheme = e.matches ? "dark" : "light";
				if (currentTheme === "system") {
					setTheme("system");
				}
			};
			mediaQuery.addEventListener("change", handler);

			return () => mediaQuery.removeEventListener("change", handler);
		}
	});

	function setTheme(theme: Theme) {
		currentTheme = theme;
		localStorage.setItem("theme", theme);

		const root = document.documentElement;

		if (theme === "system") {
			const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
			root.setAttribute("data-theme", prefersDark ? "dark" : "light");
			// Also add/remove dark class for Tailwind
			if (prefersDark) {
				root.classList.add("dark");
			} else {
				root.classList.remove("dark");
			}
		} else {
			root.setAttribute("data-theme", theme);
			// Also add/remove dark class for Tailwind
			if (theme === "dark") {
				root.classList.add("dark");
			} else {
				root.classList.remove("dark");
			}
		}
	}

	const oppositeTheme = $derived(systemTheme === "dark" ? "light" : "dark");
</script>

{#snippet sunIcon()}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="h-5 w-5"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.6"
	>
		<circle cx="12" cy="12" r="4"></circle>
		<path
			d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.364-7.364-1.414 1.414M8.05 16.95l-1.414 1.414m0-12.728L8.05 6.364m10.607 10.607 1.414 1.414"
		></path>
	</svg>
{/snippet}

{#snippet moonIcon()}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="h-5 w-5"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.6"
	>
		<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
	</svg>
{/snippet}

{#snippet systemIcon()}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="h-5 w-5"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.6"
	>
		<rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
		<line x1="8" y1="21" x2="16" y2="21"></line>
		<line x1="12" y1="17" x2="12" y2="21"></line>
	</svg>
{/snippet}

<div
	class="inline-flex rounded-xl border border-[var(--border-color)] bg-[var(--light-background)] overflow-hidden text-sm font-medium"
	style="color: var(--text);"
>
	<!-- Left side -->
	<button
		onclick={() => {
			if (currentTheme === "system") {
				setTheme(oppositeTheme);
			} else {
				// Toggle between light and dark
				setTheme(currentTheme === "light" ? "dark" : "light");
			}
		}}
		class="inline-flex items-center gap-2 px-3 py-2 hover:bg-[var(--color-3)] transition cursor-pointer"
		class:opacity-100={currentTheme !== "system"}
		class:opacity-60={currentTheme === "system"}
		title={currentTheme === "system" ? `Switch to ${oppositeTheme} mode` : `Toggle theme (current: ${currentTheme})`}
		aria-label={currentTheme === "system"
			? `Switch to ${oppositeTheme} mode`
			: `Toggle theme (current: ${currentTheme})`}
	>
		{#if currentTheme === "light"}
			{@render sunIcon()}
			<span class="hidden sm:inline" style="color: var(--text-secondary);">Light</span>
		{:else if currentTheme === "dark"}
			{@render moonIcon()}
			<span class="hidden sm:inline" style="color: var(--text-secondary);">Dark</span>
		{:else if oppositeTheme === "light"}
			{@render sunIcon()}
		{:else}
			{@render moonIcon()}
		{/if}
	</button>

	<!-- Divider -->
	<div class="w-px bg-[var(--border-color)]"></div>

	<!-- Right side -->
	<button
		onclick={() => setTheme("system")}
		class="inline-flex items-center gap-2 px-3 py-2 hover:bg-[var(--color-3)] transition cursor-pointer"
		class:opacity-100={currentTheme === "system"}
		class:opacity-60={currentTheme !== "system"}
		title={currentTheme === "system" ? "Current theme: System" : "Switch to system theme"}
		aria-label={currentTheme === "system" ? "Current theme: System" : "Switch to system theme"}
	>
		{@render systemIcon()}
		{#if currentTheme === "system"}
			<span class="hidden sm:inline" style="color: var(--text-secondary);">System</span>
		{/if}
	</button>
</div>
