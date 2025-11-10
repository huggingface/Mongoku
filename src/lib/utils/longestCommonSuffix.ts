/**
 * Find the longest common suffix between two strings
 */
export function longestCommonSuffix(str1: string, str2: string): string {
	if (str1.length < str2.length && str2.endsWith(str1)) {
		return str1;
	}

	if (str2.length < str1.length && str1.endsWith(str2)) {
		return str2;
	}

	let suffix = "";
	let i = str1.length - 1;
	let j = str2.length - 1;

	while (i >= 0 && j >= 0 && str1[i] === str2[j]) {
		suffix = str1.slice(i);
		i--;
		j--;
	}

	return suffix;
}

/**
 * Find which string in an array has the longest common suffix with a target string
 * Returns the matching string or null if no good match is found
 */
export function findBestSuffixMatch(target: string, candidates: string[]): string | null {
	if (!target || candidates.length === 0) return null;

	let bestMatch: string | null = null;
	let longestSuffixLength = 0;

	for (const candidate of candidates) {
		const commonSuffix = longestCommonSuffix(target, candidate);
		if (commonSuffix.length > longestSuffixLength) {
			longestSuffixLength = commonSuffix.length;
			bestMatch = candidate;
		} else if (commonSuffix.length === longestSuffixLength) {
			bestMatch = null;
		}
	}

	return bestMatch;
}
