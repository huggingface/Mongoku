<script lang="ts">
	import { auditSchema } from "$api/servers.remote";
	import Panel from "$lib/components/Panel.svelte";
	import PrettyJson from "$lib/components/PrettyJson.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let auditResult = $state<Awaited<ReturnType<typeof auditSchema>>["data"]>(null);
	let isAuditing = $state(false);
	let auditError = $state<string | null>(null);

	let readPreferenceMode = $state<"secondaryPreferred" | "secondary" | "nearest" | "">("");
	let readPreferenceTags = $state("");

	let schemaInfo = $derived(data.schemaInfo);

	// Format a document _id for display + navigation. Composite _ids like
	// `{ game: "...", version: 1 }` aren't reachable from the document detail
	// route (which only accepts a scalar string / ObjectId), so we return
	// `navigable: null` for those and the caller renders plain text instead
	// of a broken link.
	function formatDocId(docId: unknown): { display: string; navigable: string | null } {
		if (docId === null || docId === undefined) {
			return { display: "", navigable: null };
		}
		if (typeof docId === "string" || typeof docId === "number") {
			return { display: String(docId), navigable: String(docId) };
		}
		if (typeof docId === "object") {
			const obj = docId as Record<string, unknown>;
			// EJSON wrapper from JsonEncoder, e.g. { $type: "ObjectId", $value: "..." }
			if ("$value" in obj && (typeof obj.$value === "string" || typeof obj.$value === "number")) {
				const v = String(obj.$value);
				return { display: v, navigable: v };
			}
			// Composite key — render as `k1: v1 · k2: v2`, not navigable
			const entries = Object.entries(obj).filter(([k]) => k !== "$type");
			if (entries.length > 0) {
				const display = entries.map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ");
				return { display, navigable: null };
			}
		}
		return { display: String(docId), navigable: null };
	}

	// Render the compliance percentage compactly. We *floor* to two decimals
	// (rather than rounding to nearest) so that e.g. 99.9999% never renders as
	// "100%" — only an exact 100 should show as 100. Decimals are hidden when
	// they're both zero.
	function formatPct(pct: number): string {
		if (!Number.isFinite(pct)) {
			return String(pct);
		}
		if (pct >= 100) {
			return "100";
		}
		if (pct <= 0) {
			return "0";
		}
		const truncated = Math.floor(pct * 100) / 100;
		return Number.isInteger(truncated) ? truncated.toFixed(0) : truncated.toString();
	}

	let complianceColor = $derived.by(() => {
		if (!auditResult) {
			return "var(--text)";
		}
		if (auditResult.compliancePct === 100) {
			return "var(--button-success)";
		}
		if (auditResult.compliancePct >= 90) {
			return "hsl(38, 92%, 50%)";
		}
		return "var(--error)";
	});

	async function runAudit() {
		isAuditing = true;
		auditError = null;
		auditResult = null;

		try {
			const result = await auditSchema({
				server: data.server,
				database: data.database,
				collection: data.collection,
				readPreferenceMode: readPreferenceMode || undefined,
				readPreferenceTags: readPreferenceTags || undefined,
			});

			if (result.error) {
				auditError = result.error;
				notificationStore.notifyError(result.error);
			} else {
				auditResult = result.data;
				if (result.data?.hasSchema) {
					const summary = `Audit complete: ${formatPct(result.data.compliancePct)}% of ${result.data.nrecords.toLocaleString()} documents match the schema`;
					// Match the on-page progress-bar bands: 100% green, ≥90% amber, otherwise red.
					if (result.data.compliancePct === 100) {
						notificationStore.notifySuccess(summary);
					} else if (result.data.compliancePct >= 90) {
						notificationStore.notify(summary, "info");
					} else {
						notificationStore.notifyError(summary);
					}
				}
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			auditError = msg;
			notificationStore.notifyError(msg);
		} finally {
			isAuditing = false;
		}
	}
</script>

<Panel title="Schema Validation" titleClass="py-2">
	{#snippet actions()}
		{#if schemaInfo.hasSchema}
			<button class="btn btn-primary btn-sm -my-2" onclick={runAudit} disabled={isAuditing}>
				{#if isAuditing}
					<svg
						class="animate-spin w-4 h-4 inline mr-1"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
				{/if}
				{isAuditing ? "Auditing..." : "Run Audit"}
			</button>
		{/if}
	{/snippet}

	<div class="p-4 space-y-6">
		<!-- Configuration -->
		<div>
			<h3 class="text-sm font-semibold mb-3 uppercase tracking-wide" style="color: var(--text-secondary);">
				Configuration
			</h3>
			{#if schemaInfo.hasSchema}
				<div class="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--color-1)]">
					<table class="table mb-0">
						<tbody>
							<tr>
								<td class="font-medium whitespace-nowrap px-4 py-3 text-sm w-40">Status</td>
								<td class="px-4 py-3">
									<span class="badge badge-success">Active</span>
								</td>
							</tr>
							<tr>
								<td class="font-medium whitespace-nowrap px-4 py-3 text-sm w-40">Validation Level</td>
								<td class="px-4 py-3">
									<span class="font-mono text-sm" style="color: var(--text);"
										>{schemaInfo.validationLevel ?? "strict"}</span
									>
									<span class="text-xs ml-2" style="color: var(--text-darker);">
										{#if schemaInfo.validationLevel === "strict"}— all inserts &amp; updates validated
										{:else if schemaInfo.validationLevel === "moderate"}— only existing valid docs re-checked
										{:else}— no validation{/if}
									</span>
								</td>
							</tr>
							<tr>
								<td class="font-medium whitespace-nowrap px-4 py-3 text-sm w-40">Validation Action</td>
								<td class="px-4 py-3">
									<span class="font-mono text-sm" style="color: var(--text);"
										>{schemaInfo.validationAction ?? "error"}</span
									>
									<span class="text-xs ml-2" style="color: var(--text-darker);">
										{#if schemaInfo.validationAction === "warn"}— invalid docs accepted with warning
										{:else}— invalid docs rejected{/if}
									</span>
								</td>
							</tr>
						</tbody>
					</table>
				</div>

				<div class="mt-4">
					<h4 class="text-xs font-semibold mb-2 uppercase tracking-wide" style="color: var(--text-secondary);">
						JSON Schema
					</h4>
					<div class="rounded-lg border border-[var(--border-color)] overflow-hidden">
						<PrettyJson
							json={schemaInfo.validator as unknown as Record<string, unknown>}
							autoCollapse={false}
							server={data.server}
							database={data.database}
							collection={data.collection}
						/>
					</div>
				</div>
			{:else}
				<div class="rounded-lg border border-[var(--border-color)] bg-[var(--color-1)] p-8 text-center">
					<div class="text-4xl mb-3 opacity-30">&#x1F4CB;</div>
					<p class="text-sm font-medium" style="color: var(--text-secondary);">No JSON Schema validator configured.</p>
					<p class="text-xs mt-1" style="color: var(--text-darker);">
						Use MongoDB's
						<a
							href="https://www.mongodb.com/docs/manual/core/schema-validation/"
							target="_blank"
							rel="noopener"
							class="underline"
							style="color: var(--link);">schema validation</a
						>
						to enforce document structure.
					</p>
				</div>
			{/if}
		</div>

		<!-- Compliance Audit -->
		{#if schemaInfo.hasSchema}
			<div>
				<h3 class="text-sm font-semibold mb-3 uppercase tracking-wide" style="color: var(--text-secondary);">
					Compliance Audit
				</h3>

				<details class="mb-4">
					<summary class="cursor-pointer text-sm font-medium" style="color: var(--text-secondary);"
						>Read Preference (optional)</summary
					>
					<div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-[var(--color-3)]/50">
						<label class="block">
							<span class="text-xs font-medium" style="color: var(--text-secondary);">Mode</span>
							<select
								bind:value={readPreferenceMode}
								class="mt-1 w-full px-3 py-2 bg-[var(--color-1)] border border-[var(--border-color)] rounded text-sm"
								style="color: var(--text);"
							>
								<option value="">Default</option>
								<option value="secondaryPreferred">secondaryPreferred</option>
								<option value="secondary">secondary</option>
								<option value="nearest">nearest</option>
							</select>
						</label>
						<label class="block">
							<span class="text-xs font-medium" style="color: var(--text-secondary);">Tags (JSON)</span>
							<input
								type="text"
								bind:value={readPreferenceTags}
								placeholder={'[{"nodeType":"ANALYTICS"}]'}
								class="mt-1 w-full px-3 py-2 bg-[var(--color-1)] border border-[var(--border-color)] rounded text-sm font-mono"
								style="color: var(--text);"
							/>
						</label>
					</div>
				</details>

				{#if isAuditing}
					<div class="rounded-lg border border-[var(--border-color)] bg-[var(--color-1)] p-8 text-center">
						<svg
							class="animate-spin w-6 h-6 mx-auto mb-3"
							style="color: var(--link);"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						<p class="text-sm" style="color: var(--text-secondary);">Running validation...</p>
					</div>
				{:else if auditError}
					<div class="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
						<p class="text-sm text-red-600 font-medium">Audit failed</p>
						<p class="text-xs mt-1 text-red-500">{auditError}</p>
					</div>
				{:else if auditResult}
					<!-- Progress bar -->
					<div class="mb-4">
						<div class="flex justify-between items-center mb-2">
							<span class="text-sm font-medium" style="color: var(--text);">Compliance</span>
							<span class="text-sm font-bold" style="color: {complianceColor};">
								{formatPct(auditResult.compliancePct)}%
							</span>
						</div>
						<div class="w-full h-3 rounded-full bg-[var(--color-3)] overflow-hidden">
							<div
								class="h-full rounded-full transition-all duration-500"
								style="width: {auditResult.compliancePct}%; background: {complianceColor};"
							></div>
						</div>
					</div>

					<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
						<div class="rounded-lg border border-[var(--border-color)] bg-[var(--color-1)] p-3 text-center">
							<div class="text-lg font-bold" style="color: var(--text);">{auditResult.nrecords.toLocaleString()}</div>
							<div class="text-xs" style="color: var(--text-darker);">Scanned</div>
						</div>
						<div class="rounded-lg border border-[var(--border-color)] bg-[var(--color-1)] p-3 text-center">
							<div class="text-lg font-bold" style="color: var(--button-success);">
								{auditResult.nValidDocuments.toLocaleString()}
							</div>
							<div class="text-xs" style="color: var(--text-darker);">Valid</div>
						</div>
						<div class="rounded-lg border border-[var(--border-color)] bg-[var(--color-1)] p-3 text-center">
							<div
								class="text-lg font-bold"
								style="color: {auditResult.nInvalidDocuments > 0 ? 'var(--error)' : 'var(--text)'};"
							>
								{auditResult.nInvalidDocuments.toLocaleString()}
							</div>
							<div class="text-xs" style="color: var(--text-darker);">Invalid</div>
						</div>
						<div class="rounded-lg border border-[var(--border-color)] bg-[var(--color-1)] p-3 text-center">
							<div class="text-lg font-bold" style="color: var(--text);">{auditResult.tookMs}ms</div>
							<div class="text-xs" style="color: var(--text-darker);">Duration</div>
						</div>
					</div>

					<!-- Validation errors -->
					{#if auditResult.errors.length > 0}
						<div class="mt-4">
							<h4 class="text-sm font-semibold mb-3" style="color: var(--error);">
								Validation Errors ({auditResult.errors.length} sampled)
							</h4>
							<div class="space-y-3 max-h-96 overflow-auto pr-2">
								{#each auditResult.errors as err, i (`err-${i}`)}
									<div class="rounded-lg border border-red-500/20 bg-red-500/5 overflow-hidden">
										<!-- Error header with doc link -->
										<div class="px-4 py-3 border-b border-red-500/10">
											{#if err.docId}
												{@const idInfo = formatDocId(err.docId)}
												<div class="flex items-center gap-2">
													<span class="text-xs font-medium" style="color: var(--text-secondary);">Document:</span>
													{#if idInfo.navigable !== null}
														<!-- eslint-disable svelte/no-navigation-without-resolve -->
														<a
															href="/servers/{encodeURIComponent(data.server)}/databases/{encodeURIComponent(
																data.database,
															)}/collections/{encodeURIComponent(data.collection)}/documents/{encodeURIComponent(
																idInfo.navigable,
															)}"
															class="text-xs font-mono underline hover:no-underline"
															style="color: var(--link);"
														>
															{idInfo.display}
														</a>
														<!-- eslint-enable svelte/no-navigation-without-resolve -->
													{:else}
														<span class="text-xs font-mono" style="color: var(--text);">{idInfo.display}</span>
													{/if}
												</div>
											{/if}
										</div>

										<!-- Error details -->
										<div class="p-4">
											<div class="space-y-2">
												{#each err.message.split("; ") as errorMsg, j (`${i}-${j}`)}
													<div class="flex items-start gap-2">
														<span class="text-red-400 mt-0.5">•</span>
														<pre
															class="text-xs whitespace-pre-wrap font-mono flex-1"
															style="color: var(--error);">{errorMsg}</pre>
													</div>
												{/each}
											</div>
										</div>

										<!-- Document viewer -->
										{#if err.document}
											<div class="px-4 pb-4">
												<details class="rounded border border-[var(--border-color)] overflow-hidden">
													<summary
														class="cursor-pointer px-3 py-2 text-xs font-medium bg-[var(--color-1)] hover:bg-[var(--color-2)] transition-colors"
														style="color: var(--text-secondary);"
													>
														View full document
													</summary>
													<div class="p-3 border-t border-[var(--border-color)] bg-[var(--color-1)]">
														<PrettyJson
															json={err.document as unknown as Record<string, unknown>}
															autoCollapse={true}
															server={data.server}
															database={data.database}
															collection={data.collection}
														/>
													</div>
												</details>
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}

					{#if auditResult.warnings.length > 0}
						<div class="mt-4">
							<h4 class="text-sm font-semibold mb-2" style="color: hsl(38, 92%, 50%);">Warnings</h4>
							<div
								class="rounded-lg border border-yellow-500/20 bg-yellow-500/5 divide-y divide-yellow-500/10 max-h-48 overflow-auto"
							>
								{#each auditResult.warnings as warning (warning)}
									<pre class="p-3 text-xs whitespace-pre-wrap font-mono" style="color: var(--text);">{warning}</pre>
								{/each}
							</div>
						</div>
					{/if}
				{:else}
					<div class="rounded-lg border border-[var(--border-color)] bg-[var(--color-1)] p-6 text-center">
						<p class="text-sm" style="color: var(--text-secondary);">Click "Run Audit" to check document compliance.</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</Panel>
