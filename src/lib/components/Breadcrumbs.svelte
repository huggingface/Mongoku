<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { serverName } from "$lib/utils/filters";

	interface BreadcrumbItem {
		label: string;
		href?: string;
	}

	function getBreadcrumbs(pathname: string, params: Record<string, string>): BreadcrumbItem[] {
		const breadcrumbs: BreadcrumbItem[] = [];

		// Parse the path segments
		const segments = pathname.split("/").filter(Boolean);

		if (segments.length === 0) {
			// We're at home, no breadcrumbs needed
			return [];
		}

		if (segments[0] === "servers" && segments.length >= 3) {
			const server = decodeURIComponent(params.server || "");
			const serverDisplayName = serverName(server);

			if (segments[2] === "databases") {
				// /servers/{server}/databases
				breadcrumbs.push({
					label: serverDisplayName,
					href: `/servers/${encodeURIComponent(server)}/databases`,
				});

				if (segments.length >= 5 && segments[3] && segments[4] === "collections") {
					const database = decodeURIComponent(params.database || "");
					// /servers/{server}/databases/{database}/collections
					breadcrumbs.push({
						label: database,
						href: `/servers/${encodeURIComponent(server)}/databases/${encodeURIComponent(database)}/collections`,
					});

					if (segments.length >= 6 && segments[5]) {
						const collection = decodeURIComponent(params.collection || "");

						if (segments.length === 6) {
							// /servers/{server}/databases/{database}/collections/{collection}
							breadcrumbs.push({
								label: collection,
							});
						} else if (segments.length >= 7) {
							if (segments[6] === "documents" && segments[7]) {
								// /servers/{server}/databases/{database}/collections/{collection}/documents/{document}
								breadcrumbs.push({
									label: collection,
									href: `/servers/${encodeURIComponent(server)}/databases/${encodeURIComponent(database)}/collections/${encodeURIComponent(collection)}`,
								});

								breadcrumbs.push({
									label: decodeURIComponent(params.document || "[Document]"),
								});
							} else if (segments[6] === "mappings") {
								// /servers/{server}/databases/{database}/collections/{collection}/mappings
								breadcrumbs.push({
									label: collection,
									href: `/servers/${encodeURIComponent(server)}/databases/${encodeURIComponent(database)}/collections/${encodeURIComponent(collection)}?query=${encodeURIComponent("{}")}&sort=&project=&skip=0&limit=20`,
								});

								breadcrumbs.push({
									label: "Mappings",
								});
							}
						}
					}
				}
			}
		}

		return breadcrumbs;
	}

	const breadcrumbs = $derived(getBreadcrumbs(page.url.pathname, page.params));
</script>

{#if breadcrumbs.length > 0}
	<nav class="breadcrumbs" aria-label="Breadcrumb">
		<ol class="breadcrumb-list">
			{#each breadcrumbs as crumb, index (index)}
				<li class="breadcrumb-item">
					{#if crumb.href && index < breadcrumbs.length - 1}
						<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
						<a href={resolve(crumb.href as any)} class="breadcrumb-link">{crumb.label}</a>
					{:else}
						<span class="breadcrumb-current">{crumb.label}</span>
					{/if}
					{#if index < breadcrumbs.length - 1}
						<span class="breadcrumb-separator">/</span>
					{/if}
				</li>
			{/each}
		</ol>
	</nav>
{/if}

<style lang="postcss">
	.breadcrumbs {
		margin-left: 20px;
		font-size: 16px;
	}

	.breadcrumb-list {
		display: flex;
		align-items: center;
		list-style: none;
		margin: 0;
		padding: 0;
		gap: 8px;
	}

	.breadcrumb-item {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.breadcrumb-link {
		color: var(--text);
		text-decoration: none;
		transition: color 0.2s;

		&:hover {
			color: var(--text);
			text-decoration: underline;
		}
	}

	.breadcrumb-current {
		color: var(--text-darker);
		font-weight: 500;
	}

	.breadcrumb-separator {
		color: var(--text-darker);
		font-weight: 300;
		user-select: none;
	}
</style>
