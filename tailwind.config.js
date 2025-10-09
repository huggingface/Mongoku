/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/**/*.{html,js,svelte,ts}"],
	theme: {
		extend: {
			colors: {
				// Preserve existing design system colors
				"color-1": "hsl(216, 26%, 15%)",
				"color-2": "hsl(220, 23%, 21%)",
				"color-3": "hsl(217, 20%, 25%)",
				"color-4": "hsl(220, 20%, 30%)",
				background: "var(--background-color)",
				panel: {
					bg: "var(--panel-bg)",
					title: "var(--panel-title)",
					body: "var(--panel-body)",
				},
				border: "var(--border-color)",
				text: {
					DEFAULT: "var(--text)",
					inverse: "var(--text-inverse)",
					darker: "var(--text-darker)",
					lighter: "var(--text-lighter)",
				},
				link: "var(--link)",
				error: "var(--error)",
				button: {
					danger: "var(--button-danger)",
					"danger-l": "var(--button-danger-l)",
					success: "var(--button-success)",
					"success-l": "var(--button-success-l)",
					light: "var(--button-light)",
				},
				code: {
					namespace: "var(--code-namespace)",
					boolean: "var(--code-boolean)",
					null: "var(--code-null)",
					numbers: "var(--code-numbers)",
					string: "var(--code-string)",
					links: "var(--code-links)",
					summary: "var(--code-summary)",
					regexp: "var(--code-regexp)",
					function: "var(--code-function)",
				},
			},
			fontFamily: {
				brand: ["Cuprum", "sans-serif"],
				body: ["Rajdhani", "sans-serif"],
				mono: ["Source Code Pro", "Consolas", "Monaco", "Courier New", "monospace"],
			},
			fontSize: {
				// Standard font size scale
				xs: ["0.75rem", { lineHeight: "1rem" }], // 12px
				sm: ["0.875rem", { lineHeight: "1.25rem" }], // 14px
				base: ["1rem", { lineHeight: "1.5rem" }], // 16px
				lg: ["1.125rem", { lineHeight: "1.75rem" }], // 18px
				xl: ["1.25rem", { lineHeight: "1.75rem" }], // 20px
				"2xl": ["1.5rem", { lineHeight: "2rem" }], // 24px
				"3xl": ["1.875rem", { lineHeight: "2.25rem" }], // 30px
				"4xl": ["2.25rem", { lineHeight: "2.5rem" }], // 36px
				"5xl": ["3rem", { lineHeight: "1" }], // 48px
				"6xl": ["3.75rem", { lineHeight: "1" }], // 60px
			},
		},
	},
	plugins: [],
};
