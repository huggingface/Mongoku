<script lang="ts">
	import { updateDocument } from "$api/servers.remote";
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
			await updateDocument({
				server: data.server,
				database: data.database,
				collection: "mongoku.mappings",
				document: data.collection,
				value: { mappings: mappingsObj, _id: data.collection },
				partial: false,
			});
			notificationStore.notifySuccess("Mappings saved successfully");
		} catch (error) {
			console.error("Error saving mappings:", error);
			notificationStore.notifyError(error, "Failed to save mappings");
		}
	}
</script>

<Panel title="Mappings for {data.collection}">
	{#snippet actions()}
		<button class="btn btn-primary btn-sm ml-2 -my-2" onclick={saveMappings}>Save</button>
	{/snippet}

	<div class="p-4">
		<div class="text-gray-400 mb-4">
			<p class="mb-3">
				Define relationships between collections to enable hover tooltips and navigation on foreign key fields.
			</p>
			<details class="mb-2">
				<summary class="cursor-pointer font-medium mb-2">Example</summary>
				<div class="mt-2">
					<div class="mb-1">
						Document in collection <code class="px-1 bg-[var(--color-2)] rounded">posts</code>:
					</div>
					<code class="block px-2 py-1 bg-[var(--color-2)] rounded text-xs mb-2">
						&#123; _id: "post1", title: "Hello", authorId: "user123", comments: [&#123;authorId: "user456", text:
						"Nice!"&#125;] &#125;
					</code>
					<div class="text space-y-1">
						<div>
							→ Mapping 1: Field path <code class="px-1 bg-[var(--color-2)] rounded">authorId</code>, target collection
							<code class="px-1 bg-[var(--color-2)] rounded">users</code>, target field
							<code class="px-1 bg-[var(--color-2)] rounded">_id</code>
						</div>
						<div>
							→ Mapping 2: Field path <code class="px-1 bg-[var(--color-2)] rounded">comments.authorId</code>, target
							collection <code class="px-1 bg-[var(--color-2)] rounded">users</code>, target field
							<code class="px-1 bg-[var(--color-2)] rounded">_id</code>
						</div>
					</div>
				</div>
			</details>
		</div>

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
												{#each data.availableCollections as col (col)}
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
								{#each data.availableCollections as col (col)}
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
