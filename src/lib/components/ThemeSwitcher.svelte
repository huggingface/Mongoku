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

		// Set theme mode for CSS-based rendering
		root.setAttribute("data-theme-mode", theme);
	}

	const oppositeTheme = $derived(systemTheme === "dark" ? "light" : "dark");

	function toggleTheme() {
		if (currentTheme === "system") {
			setTheme(oppositeTheme);
		} else {
			// Toggle between light and dark
			setTheme(currentTheme === "light" ? "dark" : "light");
		}
	}
</script>

{#snippet sunIcon()}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="h-4 w-4"
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
		class="h-4 w-4"
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
		class="h-4 w-4"
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
	class="theme-switcher inline-flex rounded-lg border border-[var(--border-color)] bg-[var(--light-background)] overflow-hidden text-sm font-medium"
	style="color: var(--text);"
>
	<!-- Left side -->
	<button
		onclick={toggleTheme}
		class="inline-flex items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--color-3)] transition cursor-pointer"
		aria-label="Toggle theme"
	>
		<!-- Light mode selected -->
		<span class="theme-content theme-light inline-flex items-center gap-2">
			{@render sunIcon()}
			<span class="hidden sm:inline text-[13px]" style="color: var(--text-secondary);">Light</span>
		</span>

		<!-- Dark mode selected -->
		<span class="theme-content theme-dark inline-flex items-center gap-2">
			{@render moonIcon()}
			<span class="hidden sm:inline text-[13px]" style="color: var(--text-secondary);">Dark</span>
		</span>

		<!-- System mode + light actual theme -->
		<span class="theme-content theme-system-light inline-flex items-center gap-2">
			{@render sunIcon()}
		</span>

		<!-- System mode + dark actual theme -->
		<span class="theme-content theme-system-dark inline-flex items-center gap-2">
			{@render moonIcon()}
		</span>
	</button>

	<!-- Divider -->
	<div class="w-px bg-[var(--border-color)]"></div>

	<!-- Right side -->
	<button
		onclick={() => setTheme("system")}
		class="inline-flex items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--color-3)] transition cursor-pointer"
		aria-label="Switch to system theme"
	>
		{@render systemIcon()}
		<span class="theme-text-system hidden sm:inline text-[13px]" style="color: var(--text-secondary);"> System </span>
	</button>
</div>

<style>
	/* Hide all theme content by default */
	.theme-content {
		display: none;
	}

	/* Show light mode when selected */
	:global(html[data-theme-mode="light"]) .theme-light {
		display: inline-flex;
		opacity: 1;
	}

	/* Show dark mode when selected */
	:global(html[data-theme-mode="dark"]) .theme-dark {
		display: inline-flex;
		opacity: 1;
	}

	/* Show system mode icons based on actual theme */
	:global(html[data-theme-mode="system"][data-theme="light"]) .theme-system-light {
		display: inline-flex;
		opacity: 0.6;
	}

	:global(html[data-theme-mode="system"][data-theme="dark"]) .theme-system-dark {
		display: inline-flex;
		opacity: 0.6;
	}

	/* Show System text only when system mode is selected */
	.theme-text-system {
		display: none;
	}

	:global(html[data-theme-mode="system"]) .theme-text-system {
		display: inline;
	}

	/* Opacity for left button when not system mode */
	:global(html[data-theme-mode="light"]) .theme-switcher button:first-child,
	:global(html[data-theme-mode="dark"]) .theme-switcher button:first-child {
		opacity: 1;
	}

	/* Opacity for left button when system mode */
	:global(html[data-theme-mode="system"]) .theme-switcher button:first-child {
		opacity: 0.6;
	}

	/* Opacity for right button when system mode */
	:global(html[data-theme-mode="system"]) .theme-switcher button:last-child {
		opacity: 1;
	}

	/* Opacity for right button when not system mode */
	:global(html[data-theme-mode="light"]) .theme-switcher button:last-child,
	:global(html[data-theme-mode="dark"]) .theme-switcher button:last-child {
		opacity: 0.6;
	}
</style>
