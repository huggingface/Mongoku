export const apps = [
	{
		name: "mongoku",
		script: "./build/index.js",
		env: {
			MONGOKU_SERVER_BODY_SIZE_LIMIT: "Infinity",
		},
	},
];
