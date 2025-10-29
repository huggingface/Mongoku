#!/usr/bin/env node

/**
 * Post-build script to patch build/index.js
 * Adds environment variable check to suppress startup log
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const buildIndexPath = join(__dirname, "..", "build", "index.js");

try {
	let content = readFileSync(buildIndexPath, "utf-8");

	// Pattern: Regular listener (http/socket path)
	const regularPattern =
		/server\.listen\(\{ path, host, port \}, \(\) => \{\n\t\tconsole\.log\(`Listening on \$\{path \|\| `http:\/\/\$\{host\}:\$\{port\}`\}`\);/;
	const regularReplacement = `server.listen({ path, host, port }, () => {
		if (!process.env.MONGOKU_SUPPRESS_STARTUP_LOG) {
			console.log(\`Listening on \${path || \`http://\${host}:\${port}\`}\`);
		}`;

	if (regularPattern.test(content)) {
		content = content.replace(regularPattern, regularReplacement);
		writeFileSync(buildIndexPath, content, "utf-8");
		console.log("✓ Successfully patched build/index.js");
	} else {
		console.log("⚠ No patches needed (already applied or pattern not found)");
	}
} catch (error) {
	console.error("✗ Failed to patch build/index.js:", (error as Error).message);
	process.exit(1);
}
