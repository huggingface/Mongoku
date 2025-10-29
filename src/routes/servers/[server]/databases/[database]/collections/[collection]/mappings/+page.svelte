<script lang="ts">
	import { updateDocument } from "$api/servers.remote";
	import { resolve } from "$app/paths";
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
	let showAiPrompt = $state(false);

	// Generate AI prompt for IDE
	const aiPrompt = $derived(`I need help generating MongoDB collection mappings for my database.

**Context:**
- Database: ${data.database}
- Collection: ${data.collection}
- Available collections: ${data.availableCollections.join(", ")}

**Task:**
Please analyze my codebase to identify relationships between the "${data.collection}" collection and other collections. Look for:
1. Fields that reference documents in other collections (foreign keys)
2. Nested fields within arrays or objects that reference other documents
3. Common patterns like userId, authorId, etc.

If you have access to the MongoDB MCP server, use it to:
1. Query sample documents from the "${data.collection}" collection
2. Analyze the schema and field types
3. Identify potential foreign key relationships

**Output Format:**
Create a file named \`${data.collection}.mappings.json\` with the following structure:

\`\`\`json
{
  "_id": "${data.collection}",
  "mappings": {
    "fieldPath": { "collection": "targetCollection", "on": "targetField" },
    "nested.fieldPath": { "collection": "targetCollection", "on": "targetField" }
  }
}
\`\`\`

**Example:**
If the collection has documents like:
\`\`\`json
{
  "_id": "post1",
  "authorId": "user123",
  "comments": [
    { "authorId": "user456", "text": "Great post!" }
  ]
}
\`\`\`

The mappings would be:
\`\`\`json
{
  "_id": "${data.collection}",
  "mappings": {
    "authorId": { "collection": "users", "on": "_id" },
    "comments.authorId": { "collection": "users", "on": "_id" }
  }
}
\`\`\`

**Notes:**
- Use dot notation for nested fields (e.g., "comments.authorId")
- Multiple mappings for the same field can be expressed as an array
- Target field is usually "_id" but can be any unique field

Please analyze the codebase and database, then generate the appropriate mappings file.`);

	async function copyAiPrompt() {
		try {
			await navigator.clipboard.writeText(aiPrompt);
			notificationStore.notifySuccess("AI prompt copied to clipboard");
		} catch (err) {
			notificationStore.notifyError(err, "Failed to copy to clipboard");
		}
	}
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
				upsert: true,
			});
			notificationStore.notifySuccess("Mappings saved successfully");
		} catch (error) {
			console.error("Error saving mappings:", error);
			notificationStore.notifyError(error, "Failed to save mappings");
		}
	}
</script>

<Panel title="Mappings for {data.collection}" titleClass="py-2">
	{#snippet actions()}
		<button class="btn btn-outline-light btn-sm -my-2 hover:bg-[var(--color-3)]" onclick={() => (showAiPrompt = true)}>
			🤖 AI Helper
		</button>
		{#if !data.readOnly}
			<button class="btn btn-success btn-sm -my-2 hover:bg-[var(--button-success-l)]" onclick={saveMappings}
				>Save</button
			>
		{/if}
	{/snippet}

	<div class="p-4">
		<div class="mb-4">
			<p class="mb-3">
				Define relationships between collections to enable hover tooltips and navigation on foreign key fields. This
				will be stored in the <code class="px-1 bg-[var(--light-background)] rounded">mongoku.mappings</code> collection
				as a document with
				<a
					href={resolve(
						`/servers/${data.server}/databases/${data.database}/collections/mongoku.mappings/documents/${data.collection}`,
					)}
					class="text-blue-500">_id: "{data.collection}"</a
				>.
			</p>
			<details class="mb-2" style="color: var(--text-secondary);">
				<summary class="cursor-pointer font-medium mb-2">Example</summary>
				<div class="mt-2">
					<div class="mb-1">
						Document in collection <code class="px-1 bg-[var(--light-background)] rounded">posts</code>:
					</div>
					<code class="block px-2 py-1 bg-[var(--light-background)] rounded text-xs mb-2">
						&#123; _id: "post1", title: "Hello", authorId: "user123", comments: [&#123;authorId: "user456", text:
						"Nice!"&#125;] &#125;
					</code>
					<div class="text space-y-1">
						<div>
							→ Mapping 1: Field path <code class="px-1 bg-[var(--light-background)] rounded">authorId</code>, target
							collection
							<code class="px-1 bg-[var(--light-background)] rounded">users</code>, target field
							<code class="px-1 bg-[var(--light-background)] rounded">_id</code>
						</div>
						<div>
							→ Mapping 2: Field path <code class="px-1 bg-[var(--light-background)] rounded">comments.authorId</code>,
							target collection <code class="px-1 bg-[var(--light-background)] rounded">users</code>, target field
							<code class="px-1 bg-[var(--light-background)] rounded">_id</code>
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
										disabled={data.readOnly}
									/>
								</label>
							</div>
							{#if !data.readOnly}
								<button
									class="btn btn-outline-danger btn-sm mt-6 hover:bg-[rgba(255,59,48,0.1)]"
									onclick={() => removeMapping(entryIndex)}
								>
									Remove Mapping
								</button>
							{/if}
						</div>

						<div class="space-y-2">
							{#each entry.targets as target, targetIndex (targetIndex)}
								<div class="flex items-start gap-2 pl-4 border-l-2 border-[var(--color-3)]">
									<div class="flex-1">
										<label class="block text-xs mb-1">
											Target Collection
											<select
												bind:value={target.collection}
												class="w-full px-3 py-2 bg-[var(--color-1)] border border-[var(--border-color)] rounded text-sm mt-1"
												disabled={data.readOnly}
											>
												<option value="">Select collection...</option>
												{#each data.availableCollections as col (col)}
													<option value={col}>{col}</option>
												{/each}
											</select>
										</label>
									</div>
									<div class="flex-1">
										<label class="block text-xs mb-1">
											Target Field
											<input
												type="text"
												bind:value={target.on}
												placeholder="_id"
												class="w-full px-3 py-2 bg-[var(--color-1)] border border-[var(--border-color)] rounded text-sm mt-1"
												disabled={data.readOnly}
											/>
										</label>
									</div>
									{#if !data.readOnly}
										<button
											class="btn btn-outline-danger btn-sm mt-5 hover:bg-[rgba(255,59,48,0.1)]"
											onclick={() => removeTarget(entry, targetIndex)}
											disabled={entry.targets.length === 1}
										>
											×
										</button>
									{/if}
								</div>
							{/each}
						</div>

						{#if !data.readOnly}
							<button
								class="btn btn-outline-light btn-sm mt-2 ml-4 hover:bg-[var(--color-3)]"
								onclick={() => addTarget(entry)}
							>
								+ Add Alternative Target
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<div class="text-center py-8" style="color: var(--text-secondary);">No mappings defined yet.</div>
		{/if}

		{#if !data.readOnly}
			<div class="mt-4">
				{#if !isAdding}
					<button class="btn btn-success hover:bg-[var(--button-success-l)]" onclick={() => (isAdding = true)}
						>+ Add New Mapping</button
					>
				{:else}
					<div class="border border-[var(--border-color)] rounded p-4 bg-[var(--light-background)]">
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
								<button class="btn btn-success hover:bg-[var(--button-success-l)]" onclick={addNewMapping}>Add</button>
								<button class="btn btn-default hover:bg-[var(--color-3)]" onclick={cancelAdd}>Cancel</button>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</Panel>

<!-- AI Prompt Modal -->
{#if showAiPrompt}
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
		onclick={() => (showAiPrompt = false)}
		onkeydown={(e) => {
			if (e.key === "Escape") showAiPrompt = false;
		}}
		role="button"
		tabindex="0"
	>
		<div
			class="bg-[var(--color-1)] border border-[var(--border-color)] rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			tabindex="-1"
		>
			<div class="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
				<h2 class="text-xl font-semibold">AI Mapping Generator Prompt</h2>
				<button class="btn btn-outline-light btn-sm hover:bg-[var(--color-3)]" onclick={() => (showAiPrompt = false)}
					>Close</button
				>
			</div>

			<div class="p-4 overflow-auto flex-1">
				<p class="mb-3 text-sm" style="color: var(--text-secondary);">
					Copy this prompt and paste it into your IDE's AI assistant (Cursor, GitHub Copilot, etc.) to automatically
					generate mappings for this collection.
				</p>
				<pre
					class="bg-[var(--color-2)] border border-[var(--border-color)] rounded p-4 text-sm whitespace-pre-wrap overflow-auto">{aiPrompt}</pre>
			</div>

			<div class="p-4 border-t border-[var(--border-color)] flex justify-end gap-2">
				<button class="btn btn-default hover:bg-[var(--color-3)]" onclick={() => (showAiPrompt = false)}>Close</button>
				<button class="btn btn-primary hover:brightness-110" onclick={copyAiPrompt}>Copy to Clipboard</button>
			</div>
		</div>
	</div>
{/if}
