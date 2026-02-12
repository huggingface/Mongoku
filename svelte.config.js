import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			out: "build",
			envPrefix: "MONGOKU_SERVER_",
		}),
		paths: {
			base: process.env.BASE_PATH || "",
		},
		experimental: {
			remoteFunctions: true,
		},
		alias: {
			$api: "src/api",
		},
	},

	compilerOptions: {
		experimental: {
			async: true,
		},
	},
};

export default config;
