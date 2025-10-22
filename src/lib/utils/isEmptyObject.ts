export function isEmptyObject(obj: object): boolean {
	for (const key in obj) {
		return false;
	}
	return true;
}
