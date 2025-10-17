<script lang="ts">
	import { refreshMappings as refreshMappingsCommand } from "$api/servers.remote";
	import Panel from "$lib/components/Panel.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import type { MappingTarget } from "$lib/types";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	// Convert mappings to an editable array format
	type MappingEntry = {
		fieldPath: string;
		targets: MappingTarget[];
	};

	let mappingsArray = $state<MappingEntry[]>(
		Object.entries(data.mappings).map(([fieldPath, targets]) => ({
			fieldPath,
			targets: Array.isArray(targets) ? targets : [targets],
		})),
	);

	// New mapping form state
	let newFieldPath = $state("");
	let newTargetCollection = $state("");
	let newTargetField = $state("_id");
	let isAdding = $state(false);

	function addTarget(entry: MappingEntry) {
		entry.targets.push({ collection: "", on: "_id" });
	}

	function removeTarget(entry: MappingEntry, index: number) {
		entry.targets.splice(index, 1);
	}

	function removeMapping(index: number) {
		mappingsArray.splice(index, 1);
	}

	function addNewMapping() {
		if (!newFieldPath.trim()) {
			notificationStore.notifyError("Field path is required");
			return;
		}

		if (!newTargetCollection.trim()) {
			notificationStore.notifyError("Target collection is required");
			return;
		}

		mappingsArray.push({
			fieldPath: newFieldPath.trim(),
			targets: [{ collection: newTargetCollection.trim(), on: newTargetField.trim() || "_id" }],
		});

		// Reset form
		newFieldPath = "";
		newTargetCollection = "";
		newTargetField = "_id";
		isAdding = false;
	}

	function cancelAdd() {
		newFieldPath = "";
		newTargetCollection = "";
		newTargetField = "_id";
		isAdding = false;
	}

	async function saveMappings() {
		try {
			// Convert array back to object format
			const mappingsObj: Record<string, MappingTarget | MappingTarget[]> = {};

			for (const entry of mappingsArray) {
				if (entry.fieldPath.trim()) {
					// Filter out empty targets
					const validTargets = entry.targets.filter((t) => t.collection.trim() && t.on.trim());

					if (validTargets.length > 0) {
						mappingsObj[entry.fieldPath] = validTargets.length === 1 ? validTargets[0] : validTargets;
					}
				}
			}

			// Save to mongoku.mappings collection via API
			const response = await fetch("/api/save-mappings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					server: data.server,
					database: data.database,
					collection: data.collection,
					mappings: mappingsObj,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ message: response.statusText }));
				throw new Error(errorData.message || "Failed to save mappings");
			}

			notificationStore.notifySuccess("Mappings saved successfully");
		} catch (error) {
			console.error("Error saving mappings:", error);
			notificationStore.notifyError(error, "Failed to save mappings");
		}
	}

	async function refreshMappings() {
		try {
			await refreshMappingsCommand({
				server: data.server,
				database: data.database,
			});

			notificationStore.notifySuccess("Mappings refreshed successfully");

			// Reload the page to get fresh data
			window.location.reload();
		} catch (error) {
			console.error("Error refreshing mappings:", error);
			notificationStore.notifyError(error, "Failed to refresh mappings");
		}
	}
</script>

<Panel title="Mappings for {data.collection}">
	{#snippet actions()}
		<button class="btn btn-outline-light btn-sm -my-2" onclick={refreshMappings}>Refresh</button>
		<button class="btn btn-primary btn-sm ml-2 -my-2" onclick={saveMappings}>Save</button>
	{/snippet}

	<div class="p-4">
		<p class="text-sm text-gray-400 mb-4">
			Define relationships between collections to enable hover tooltips and navigation on ObjectId fields.
		</p>

		{#if mappingsArray.length > 0}
			<div class="space-y-4">
				{#each mappingsArray as entry, entryIndex (entryIndex)}
					<div class="border border-[var(--border-color)] rounded p-4">
						<div class="flex items-start gap-4 mb-3">
							<div class="flex-1">
								<label class="block text-sm font-medium mb-1">
									Field Path
									<input
										type="text"
										bind:value={entry.fieldPath}
										placeholder="e.g., authorId or comments.authorId"
										class="w-full px-3 py-2 bg-[var(--color-1)] border border-[var(--border-color)] rounded text-sm mt-1"
									/>
								</label>
							</div>
							<button class="btn btn-outline-danger btn-sm mt-6" onclick={() => removeMapping(entryIndex)}>
								Remove Mapping
							</button>
						</div>

						<div class="space-y-2">
							{#each entry.targets as target, targetIndex (targetIndex)}
								<div class="flex items-start gap-2 pl-4 border-l-2 border-[var(--color-3)]">
									<div class="flex-1">
										<label class="block text-xs text-gray-400 mb-1">
											Target Collection
											<select
												bind:value={target.collection}
												class="w-full px-3 py-2 bg-[var(--color-1)] border border-[var(--border-color)] rounded text-sm mt-1"
											>
												<option value="">Select collection...</option>
												{#each data.availableCollections as col}
													<option value={col}>{col}</option>
												{/each}
											</select>
										</label>
									</div>
									<div class="flex-1">
										<label class="block text-xs text-gray-400 mb-1">
											Target Field
											<input
												type="text"
												bind:value={target.on}
												placeholder="_id"
												class="w-full px-3 py-2 bg-[var(--color-1)] border border-[var(--border-color)] rounded text-sm mt-1"
											/>
										</label>
									</div>
									<button
										class="btn btn-outline-danger btn-sm mt-5"
										onclick={() => removeTarget(entry, targetIndex)}
										disabled={entry.targets.length === 1}
									>
										×
									</button>
								</div>
							{/each}
						</div>

						<button class="btn btn-outline-light btn-sm mt-2 ml-4" onclick={() => addTarget(entry)}>
							+ Add Alternative Target
						</button>
					</div>
				{/each}
			</div>
		{:else}
			<div class="text-center text-gray-400 py-8">No mappings defined yet.</div>
		{/if}

		<div class="mt-4">
			{#if !isAdding}
				<button class="btn btn-primary" onclick={() => (isAdding = true)}>+ Add New Mapping</button>
			{:else}
				<div class="border border-[var(--border-color)] rounded p-4 bg-[var(--color-2)]">
					<h3 class="text-lg font-medium mb-3">New Mapping</h3>
					<div class="space-y-3">
						<label class="block text-sm font-medium mb-1">
							Field Path
							<input
								type="text"
								bind:value={newFieldPath}
								placeholder="e.g., authorId or comments.authorId"
								class="w-full px-3 py-2 bg-[var(--color-1)] border border-[var(--border-color)] rounded mt-1"
							/>
						</label>
						<label class="block text-sm font-medium mb-1">
							Target Collection
							<select
								bind:value={newTargetCollection}
								class="w-full px-3 py-2 bg-[var(--color-1)] border border-[var(--border-color)] rounded mt-1"
							>
								<option value="">Select collection...</option>
								{#each data.availableCollections as col}
									<option value={col}>{col}</option>
								{/each}
							</select>
						</label>
						<label class="block text-sm font-medium mb-1">
							Target Field
							<input
								type="text"
								bind:value={newTargetField}
								placeholder="_id"
								class="w-full px-3 py-2 bg-[var(--color-1)] border border-[var(--border-color)] rounded mt-1"
							/>
						</label>
						<div class="flex gap-2">
							<button class="btn btn-success" onclick={addNewMapping}>Add</button>
							<button class="btn btn-default" onclick={cancelAdd}>Cancel</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</Panel>
