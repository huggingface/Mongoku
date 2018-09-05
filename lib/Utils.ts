export namespace Utils {
	/**
	 * In-place sort of the given array of objects
	 * @param arr An array of objects
	 * @param field the field used to sort
	 * @param descending whether to use descending order
	 */
	export const fieldSort = (arr: Object[], field: string, descending: boolean = false) => {
		return arr.sort((a, b) => {
			return (a[field] == b[field])
				? 0
				: (a[field] > b[field])
					? (descending) ? -1 : 1
					: (descending) ? 1 : -1
		});
	}
}
