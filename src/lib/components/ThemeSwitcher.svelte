<script lang="ts">
	type Theme = "system" | "light" | "dark";

	let currentTheme = $state<Theme>("system");

	// Load theme from localStorage on mount
	$effect(() => {
		if (typeof window !== "undefined") {
			const stored = localStorage.getItem("theme") as Theme | null;
			currentTheme = stored || "system";
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

	function cycleTheme() {
		const themes: Theme[] = ["system", "light", "dark"];
		const currentIndex = themes.indexOf(currentTheme);
		const nextTheme = themes[(currentIndex + 1) % themes.length];
		setTheme(nextTheme);
	}

	const label = $derived.by(() => {
		switch (currentTheme) {
			case "light":
				return "Light";
			case "dark":
				return "Dark";
			case "system":
				return "System";
		}
	});
</script>

<button
	onclick={cycleTheme}
	class="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--light-background)] hover:bg-[var(--color-3)] transition text-sm font-medium"
	title="Change theme (current: {label})"
	aria-label="Change theme"
	style="color: var(--text);"
>
	{#if currentTheme === "light"}
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
	{:else if currentTheme === "dark"}
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
	{:else}
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
	{/if}
	<span class="hidden sm:inline" style="color: var(--text-secondary);">{label}</span>
</button>
