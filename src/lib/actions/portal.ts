import { tick } from "svelte";

const portal_map = new Map<string, HTMLElement>();

export function createPortal(node: HTMLElement, id = "default") {
	const key = `$$portal.${id}`;
	if (portal_map.has(key)) throw `duplicate portal key "${id}"`;
	else portal_map.set(key, node);
	return { destroy: portal_map.delete.bind(portal_map, key) };
}

function mount(node: HTMLElement, key: string) {
	if (!portal_map.has(key)) throw `unknown portal ${key}`;
	const host = portal_map.get(key)!;
	host.insertBefore(node, null);
	return () => host.contains(node) && host.removeChild(node);
}

export function portal(node: HTMLElement, id = "default") {
	let destroy: (() => void) | undefined;
	const key = `$$portal.${id}`;
	if (!portal_map.has(key))
		tick().then(() => {
			destroy = mount(node, key);
		});
	else destroy = mount(node, key);
	return { destroy: () => destroy?.() };
}
