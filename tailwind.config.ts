import type { Config } from "tailwindcss";

export default {
	content: ["./src/**/*.{html,js,svelte,ts}"],
	darkMode: "class",
	theme: {
		extend: {
			colors: {
				apple: {
					bg: "#f5f5f7",
					bgSecondary: "#ffffff",
					bgElevated: "rgba(255,255,255,0.7)",
					border: "#e5e5e7",
					text: "#1d1d1f",
					textSecondary: "#6e6e73",
					label: "#86868b",
					blue: "#007aff",
					gray: "#8e8e93",
				},
			},
			boxShadow: {
				apple: "0 1px 2px rgba(0,0,0,0.05), 0 3px 8px rgba(0,0,0,0.06)",
			},
			backdropBlur: {
				xs: "2px",
			},
			fontFamily: {
				display: [
					"-apple-system",
					"BlinkMacSystemFont",
					"SF Pro Display",
					"Segoe UI",
					"Inter",
					"system-ui",
					"sans-serif",
				],
				text: ["-apple-system", "BlinkMacSystemFont", "SF Pro Text", "Segoe UI", "Inter", "system-ui", "sans-serif"],
				mono: [
					"ui-monospace",
					"SFMono-Regular",
					"Menlo",
					"Monaco",
					"Consolas",
					"Liberation Mono",
					"Courier New",
					"monospace",
				],
			},
			borderRadius: {
				"2xl": "1rem",
				"3xl": "1.25rem",
			},
		},
	},
	plugins: [],
} satisfies Config;
