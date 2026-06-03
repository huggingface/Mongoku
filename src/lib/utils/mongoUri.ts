/**
 * Isomorphic helpers for parsing MongoDB connection strings (safe on both
 * client and server — pure string operations, no node-only imports).
 *
 * The WHATWG `URL` class cannot parse multi-host MongoDB URIs like
 *   mongodb://user:pass@hostA:27017,hostB:27017,hostC:27017/db?replicaSet=rs0
 * because the commas in the authority make it throw `TypeError: Invalid URL`.
 * These helpers understand the comma-separated host list that MongoDB allows.
 *
 * Reference grammar:
 *   mongodb://[username:password@]host1[:port1][,host2[:port2],...][/[db][?opts]]
 *   mongodb+srv://[username:password@]host[/[db][?opts]]   (single host, no port)
 */

export interface ParsedMongoUri {
	/** "mongodb:" or "mongodb+srv:" */
	protocol: string;
	username: string;
	password: string;
	/** The raw comma-joined host list, e.g. "a:27017,b:27017". */
	hostsRaw: string;
	/** Individual hosts, each possibly "host:port". */
	hosts: string[];
	/** Path after the hosts, including leading "/" if present (db name etc.). */
	pathname: string;
	/** Query string without the leading "?", or "". */
	search: string;
}

/**
 * Parse a MongoDB connection string into its parts, tolerating multi-host URIs.
 * Throws a TypeError for strings that don't start with a mongodb scheme.
 */
export function parseMongoUri(connectionString: string): ParsedMongoUri {
	const schemeMatch = connectionString.match(/^(mongodb(?:\+srv)?):\/\//);
	if (!schemeMatch) {
		throw new TypeError(`Unsupported MongoDB connection string: ${connectionString}`);
	}
	const protocol = `${schemeMatch[1]}:`;
	const rest = connectionString.slice(schemeMatch[0].length);

	// Authority ends at the first "/" (path), or end of string.
	const afterAuthDelimiter = rest.indexOf("/");
	const authorityEnd = afterAuthDelimiter === -1 ? rest.length : afterAuthDelimiter;
	const authority = rest.slice(0, authorityEnd);
	const tail = rest.slice(authorityEnd); // starts with "/" or ""

	let credentials = "";
	let hostsRaw = authority;
	const atIndex = authority.lastIndexOf("@");
	if (atIndex !== -1) {
		credentials = authority.slice(0, atIndex);
		hostsRaw = authority.slice(atIndex + 1);
	}

	let username = "";
	let password = "";
	if (credentials) {
		const colon = credentials.indexOf(":");
		if (colon === -1) {
			username = credentials;
		} else {
			username = credentials.slice(0, colon);
			password = credentials.slice(colon + 1);
		}
	}

	// Split pathname and query from the tail.
	const queryIndex = tail.indexOf("?");
	const pathname = queryIndex === -1 ? tail : tail.slice(0, queryIndex);
	const search = queryIndex === -1 ? "" : tail.slice(queryIndex + 1);

	const hosts = hostsRaw
		.split(",")
		.map((h) => h.trim())
		.filter((h) => h.length > 0);

	return { protocol, username, password, hostsRaw, hosts, pathname, search };
}

/**
 * A stable key identifying a server connection, derived from its host list.
 * Equivalent to the old `new URL(uri).host` but multi-host safe.
 */
export function mongoHostKey(connectionString: string): string {
	return parseMongoUri(connectionString).hostsRaw;
}

/**
 * Produce a short, human-friendly display name for a connection string.
 *
 * Strips credentials, ports, query options and the db path, and for multi-host
 * URIs collapses the comma list to the shared hostname (when the hosts only
 * differ by a leading "<something>-N." prefix) so we don't render giant names.
 * Returns the input unchanged if it isn't a mongodb URI.
 */
export function mongoDisplayName(connectionString: string): string {
	let parsed: ParsedMongoUri;
	try {
		parsed = parseMongoUri(connectionString);
	} catch {
		return connectionString;
	}

	// Hostnames without ports.
	const hostnames = parsed.hosts.map((h) => stripPort(h)).filter((h) => h.length > 0);
	if (hostnames.length === 0) {
		return connectionString;
	}
	if (hostnames.length === 1) {
		return hostnames[0];
	}

	// Multiple hosts (e.g. a mongos/replica-set list). If they share a common
	// domain suffix, show that with a count; otherwise just the first + count.
	const suffix = commonDomainSuffix(hostnames);
	if (suffix) {
		return `${suffix} (${hostnames.length} hosts)`;
	}
	return `${hostnames[0]} (+${hostnames.length - 1})`;
}

function stripPort(host: string): string {
	// Don't strip ports off IPv6 ("[::1]:27017") — keep it simple: only strip a
	// trailing ":<digits>" when there's a single colon (hostname:port).
	const lastColon = host.lastIndexOf(":");
	if (lastColon === -1) {
		return host;
	}
	const maybePort = host.slice(lastColon + 1);
	if (/^\d+$/.test(maybePort) && !host.slice(0, lastColon).includes(":")) {
		return host.slice(0, lastColon);
	}
	return host;
}

/**
 * Given hosts like
 *   mongodb-mongos-0.moonlanding-bucket-prod.mongodb.internal
 *   mongodb-mongos-1.moonlanding-bucket-prod.mongodb.internal
 * return the shared part after the first differing label, e.g.
 *   moonlanding-bucket-prod.mongodb.internal
 * Returns "" if there's no meaningful shared suffix.
 */
function commonDomainSuffix(hostnames: string[]): string {
	const split = hostnames.map((h) => h.split("."));
	const minLen = Math.min(...split.map((s) => s.length));
	let shared = 0;
	for (let i = 1; i <= minLen; i++) {
		const labels = split.map((s) => s[s.length - i]);
		if (labels.every((l) => l === labels[0])) {
			shared = i;
		} else {
			break;
		}
	}
	// Require at least 2 shared labels — a lone TLD ("com") isn't a useful name.
	if (shared < 2 || shared === minLen) {
		// No meaningful shared suffix, or the hosts are identical.
		return shared === minLen ? hostnames[0] : "";
	}
	const labels = split[0];
	return labels.slice(labels.length - shared).join(".");
}
