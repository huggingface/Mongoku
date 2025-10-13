<script lang="ts">
	import { getServerDetails, getServers } from "$api/servers.remote";
	import { resolve } from "$app/paths";
	import Panel from "$lib/components/Panel.svelte";
	import TooltipTable from "$lib/components/TooltipTable.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import { formatBytes, serverName } from "$lib/utils/filters";

	const serversQuery = getServers();
	const data = $derived(await serversQuery);

	type Server = (typeof data.servers)[number];

	let adding = $state(false);
	let newServer = $state("");
	let loading = $state(false);
	let showRemoveModal = $state(false);
	let serverToRemove = $state<Server | null>(null);

	async function addServer() {
		if (!newServer) return;

		loading = true;
		try {
			const response = await fetch("/api/servers", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: newServer }),
			});

			if (response.ok) {
				newServer = "";
				adding = false;
				notificationStore.notifySuccess("Server added successfully");
				// Refresh the servers list
				await serversQuery.refresh();
			} else {
				const error = await response.text();
				notificationStore.notifyError(error || "Failed to add server");
			}
		} catch (error) {
			notificationStore.notifyError(error instanceof Error ? error.message : "Failed to add server");
		} finally {
			loading = false;
		}
	}

	function openRemoveModal(server: Server) {
		serverToRemove = server;
		showRemoveModal = true;
	}

	function closeRemoveModal() {
		showRemoveModal = false;
		serverToRemove = null;
	}

	async function confirmRemove() {
		if (!serverToRemove) return;

		try {
			const response = await fetch(`/api/servers/${encodeURIComponent(serverToRemove.name)}`, {
				method: "DELETE",
			});

			if (response.ok) {
				notificationStore.notifySuccess("Server removed successfully");
				closeRemoveModal();
				// Refresh the servers list
				await serversQuery.refresh();
			} else {
				const error = await response.text();
				notificationStore.notifyError(error || "Failed to remove server");
			}
		} catch (error) {
			notificationStore.notifyError(error instanceof Error ? error.message : "Failed to remove server");
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			closeRemoveModal();
		}
	}
</script>

<svelte:window on:keydown={handleKeyDown} />

<Panel title="Servers">
	{#snippet actions()}
		<button class="btn btn-default btn-sm" onclick={() => (adding = !adding)}>
			{adding ? "Cancel" : "Add Server"}
		</button>
		{#if adding}
			<input
				type="text"
				placeholder="mongodb://user:password@hostname:port?directConnection=true"
				bind:value={newServer}
				disabled={loading}
				class="form-input"
			/>
			<button class="btn btn-outline-success btn-sm" onclick={addServer} disabled={!newServer.length || loading}>
				Add
			</button>
		{/if}
	{/snippet}

	<table class="table">
		<thead>
			<tr>
				<th>Name</th>
				<th>Databases</th>
				<th>Size</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#if data.servers && data.servers.length > 0}
				{#each data.servers as server (server._id)}
					<tr class="group">
						<td>
							{#await getServerDetails(server._id)}
								<span>
									{serverName(server.name)}
								</span>
							{:then}
								<a href={resolve(`/servers/${encodeURIComponent(serverName(server.name))}/databases`)}>
									{serverName(server.name)}
								</a>
							{:catch error}
								<span class="error">
									<span class="badge badge-danger" title={error.message}>Error</span>
									{serverName(server.name)}
								</span>
							{/await}
						</td>
						<td>
							{#await getServerDetails(server._id)}
								<span class="text-gray-400">...</span>
							{:then details}
								<TooltipTable
									columns={[
										{ header: "Database", key: "name" },
										{ header: "Collections", key: "collections" },
										{ header: "Size", key: "size" },
									]}
									rows={details.databases.map((db: { name: string; collections: number; size: number }) => ({
										name: db.name,
										collections: db.collections,
										size: formatBytes(db.size),
									}))}
								>
									{details.databases.length}
								</TooltipTable>
							{:catch}
								<span class="text-gray-400">-</span>
							{/await}
						</td>
						<td>
							{#await getServerDetails(server._id)}
								<span class="text-gray-400">...</span>
							{:then details}
								{formatBytes(details.size)}
							{:catch}
								<span class="text-gray-400">-</span>
							{/await}
						</td>
						<td style="width: 140px">
							<button
								class="btn btn-outline-danger btn-sm -my-2 hidden group-hover:inline"
								onclick={() => openRemoveModal(server)}
							>
								Remove from list
							</button>
						</td>
					</tr>
				{/each}
			{:else}
				<tr>
					<td colspan="4">
						<div class="text-center">No servers...</div>
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
</Panel>

{#if showRemoveModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={closeRemoveModal}>
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal-body">
				<p>
					Are you sure you want to remove this server? This will only remove it from this list. You can add it back.
				</p>
			</div>
			<div class="modal-footer">
				<button class="btn btn-default btn-sm" onclick={closeRemoveModal}>No</button>
				<button class="btn btn-outline-danger btn-sm" onclick={confirmRemove}>Yes</button>
			</div>
		</div>
	</div>
{/if}

<style lang="postcss">
	input[type="text"] {
		min-width: 400px;
	}
</style>
