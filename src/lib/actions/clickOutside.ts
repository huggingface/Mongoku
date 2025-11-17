/**
 * Action that calls a callback when a click occurs outside the element
 * @param node - The element to watch for outside clicks
 * @param callback - Function to call when clicking outside
 */
export function clickOutside(node: HTMLElement, callback: () => void): { destroy: () => void } {
	const handleClick = (event: MouseEvent) => {
		if (node && !node.contains(event.target as Node)) {
			callback();
		}
	};

	// Use setTimeout to avoid the same click that triggered the action from immediately firing
	const timeoutId = setTimeout(() => {
		document.addEventListener("click", handleClick, true);
	}, 0);

	return {
		destroy() {
			clearTimeout(timeoutId);
			document.removeEventListener("click", handleClick, true);
		},
	};
}
