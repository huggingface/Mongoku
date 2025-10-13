import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async () => {
	return {
		readOnly: process.env.MONGOKU_READ_ONLY_MODE === "true",
	};
};
