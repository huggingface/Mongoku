/**
 * Format a number with significant digits
 * @param value The number to format
 * @param digits Number of significant digits (default: 3)
 * @returns Formatted string with appropriate suffix (k, M, B)
 */
export function formatSignificantDigits(value: number, digits = 3): string {
	if (value === 0) return "0";

	const absValue = Math.abs(value);
	const sign = value < 0 ? "-" : "";

	// Determine the order of magnitude
	if (absValue >= 1_000_000_000) {
		// Billions
		const billions = absValue / 1_000_000_000;
		return `${sign}${billions.toPrecision(digits)}B`;
	} else if (absValue >= 1_000_000) {
		// Millions
		const millions = absValue / 1_000_000;
		return `${sign}${millions.toPrecision(digits)}M`;
	} else if (absValue >= 1_000) {
		// Thousands
		const thousands = absValue / 1_000;
		return `${sign}${thousands.toPrecision(digits)}k`;
	} else {
		// Less than 1000
		return `${sign}${absValue.toPrecision(Math.min(digits, Math.ceil(Math.log10(absValue + 1))))}`;
	}
}
