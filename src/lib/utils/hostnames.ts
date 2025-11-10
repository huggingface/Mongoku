/**
 * Find the common prefix of an array of strings
 */
export function findCommonPrefix(strings: string[]): string {
	if (strings.length === 0) return "";
	if (strings.length === 1) return "";

	let prefix = strings[0];
	for (let i = 1; i < strings.length; i++) {
		while (strings[i].indexOf(prefix) !== 0) {
			prefix = prefix.substring(0, prefix.length - 1);
			if (prefix === "") return "";
		}
	}
	return prefix;
}

/**
 * Find the common suffix of an array of strings
 */
export function findCommonSuffix(strings: string[]): string {
	if (strings.length === 0) return "";
	if (strings.length === 1) return "";

	// Reverse all strings, find common prefix, then reverse back
	const reversed = strings.map((s) => s.split("").reverse().join(""));
	const reversedPrefix = findCommonPrefix(reversed);
	return reversedPrefix.split("").reverse().join("");
}

/**
 * Extract the unique part of a hostname by removing common prefix and suffix
 * Returns the shortened form with "..." markers
 */
export function shortenHostname(hostname: string, commonPrefix: string, commonSuffix: string): string {
	if (!commonPrefix && !commonSuffix) {
		return hostname;
	}

	let result = hostname;

	// Remove prefix
	if (commonPrefix && result.startsWith(commonPrefix)) {
		result = result.slice(commonPrefix.length);
	}

	// Remove suffix
	if (commonSuffix && result.endsWith(commonSuffix)) {
		result = result.slice(0, -commonSuffix.length);
	}

	// If nothing left, return the original
	if (result.length === 0) {
		return hostname;
	}

	// Add ellipsis markers
	const hasPrefix = commonPrefix.length > 0;
	const hasSuffix = commonSuffix.length > 0;

	if (hasPrefix && hasSuffix) {
		return `…${result}…`;
	} else if (hasPrefix) {
		return `…${result}`;
	} else if (hasSuffix) {
		return `${result}…`;
	}

	return result;
}

/**
 * Get shortened hostnames for a list of hosts
 * Returns an object mapping full hostname to shortened version
 */
export function getShortenedHostnames(hosts: string[]): Record<string, string> {
	if (hosts.length <= 1) {
		// No need to shorten if only one host
		return Object.fromEntries(hosts.map((h) => [h, h]));
	}

	const commonPrefix = findCommonPrefix(hosts);
	const commonSuffix = findCommonSuffix(hosts);

	return Object.fromEntries(hosts.map((host) => [host, shortenHostname(host, commonPrefix, commonSuffix)]));
}
