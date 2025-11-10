/**
 * Sum an array of numbers
 */
export function sum(numbers: number[]): number {
	let total = 0;
	for (const num of numbers) {
		total += num;
	}
	return total;
}
