import { page } from "$app/state";

export interface BreadcrumbItem {
	label: string;
	href?: string;
}

export const breadcrumbs = {
	get items(): BreadcrumbItem[] {
		const list = (page.data.breadcrumbs ?? []) as Array<{ label: string; path: string }>;

		return list.reduce<BreadcrumbItem[]>(
			(prev, curr) => [...prev, { label: curr.label, href: `${prev.at(-1)?.href ?? ""}${curr.path}` }],
			[],
		);
	},
};
