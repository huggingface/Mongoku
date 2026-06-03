/**
 * Server-side helpers built on the isomorphic MongoDB connection-string parser
 * in `$lib/utils/mongoUri`. Re-exports the shared parser for convenience so
 * server modules can keep importing from `$lib/server/connectionString`.
 */
import { parseMongoUri } from "$lib/utils/mongoUri";

export { mongoHostKey, parseMongoUri, type ParsedMongoUri } from "$lib/utils/mongoUri";

/**
 * Mask credentials in a MongoDB connection string for display/logging.
 * Returns the original string unchanged if it has no credentials, or "***"
 * if it can't be parsed at all. Multi-host safe.
 */
export function sanitizeMongoUri(connectionString: string): string {
	try {
		const parsed = parseMongoUri(connectionString);
		if (!parsed.username && !parsed.password) {
			return connectionString;
		}
		const tail = `${parsed.pathname}${parsed.search ? `?${parsed.search}` : ""}`;
		return `${parsed.protocol}//***:***@${parsed.hostsRaw}${tail}`;
	} catch {
		return "***";
	}
}

/**
 * Build a single-host direct-connection URI from a (possibly multi-host) URI,
 * preserving credentials and query options. Used to talk to one specific node.
 */
export function buildDirectConnectionUri(connectionString: string, host: string): string {
	const parsed = parseMongoUri(connectionString);

	const params = new URLSearchParams(parsed.search);
	params.set("directConnection", "true");
	// Preserve TLS if the original used it (srv implies TLS by default).
	if (parsed.protocol === "mongodb+srv:" || params.has("tls") || params.has("ssl")) {
		params.set("tls", "true");
	}

	const auth =
		parsed.username || parsed.password
			? `${encodeURIComponent(parsed.username)}${parsed.password ? `:${encodeURIComponent(parsed.password)}` : ""}@`
			: "";
	const pathname = parsed.pathname || "/";

	// Always emit a plain mongodb:// direct connection to a single host.
	return `mongodb://${auth}${host}${pathname}?${params.toString()}`;
}
