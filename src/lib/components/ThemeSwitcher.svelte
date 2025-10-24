<script lang="ts">
	type Theme = "system" | "light" | "dark";

	let currentTheme = $state<Theme>("dark");

	// Load theme from localStorage on mount
	$effect(() => {
		if (typeof window !== "undefined") {
			const stored = localStorage.getItem("theme") as Theme | null;
			currentTheme = stored || "dark";
		}
	});

	function setTheme(theme: Theme) {
		currentTheme = theme;
		localStorage.setItem("theme", theme);

		const root = document.documentElement;

		if (theme === "system") {
			const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
			root.setAttribute("data-theme", prefersDark ? "dark" : "light");
		} else {
			root.setAttribute("data-theme", theme);
		}
	}

	function cycleTheme() {
		const themes: Theme[] = ["system", "light", "dark"];
		const currentIndex = themes.indexOf(currentTheme);
		const nextTheme = themes[(currentIndex + 1) % themes.length];
		setTheme(nextTheme);
	}

	const icon = $derived.by(() => {
		switch (currentTheme) {
			case "light":
				return "☀️";
			case "dark":
				return "🌙";
			case "system":
				return "💻";
		}
	});

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
	class="btn btn-default btn-sm flex items-center gap-2"
	title="Change theme (current: {label})"
	aria-label="Change theme"
>
	<span class="text-base">{icon}</span>
	<span class="hidden sm:inline">{label}</span>
</button>
