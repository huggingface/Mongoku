<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";

	interface BreadcrumbItem {
		label: string;
		href?: string;
	}

	const breadcrumbs = $derived.by(() => {
		const list = (page.data.breadcrumbs ?? []) as Array<{ label: string; path: string }>;

		return list.reduce<BreadcrumbItem[]>(
			(prev, curr) => [...prev, { label: curr.label, href: `${prev.at(-1)?.href ?? ""}${curr.path}` }],
			[],
		);
	});
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
