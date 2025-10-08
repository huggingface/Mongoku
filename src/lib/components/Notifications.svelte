<script lang="ts">
	import { notificationStore } from '$lib/stores/notifications.svelte';
</script>

<div class="notifications">
	{#each notificationStore.items as notification (notification.id)}
		<div class="notification notification-{notification.type}">
			<span>{notification.message}</span>
			<button onclick={() => notificationStore.remove(notification.id)}>&times;</button>
		</div>
	{/each}
</div>

<style lang="scss">
	.notifications {
		position: fixed;
		top: 80px;
		right: 20px;
		z-index: 1000;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.notification {
		padding: 15px 20px;
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		display: flex;
		align-items: center;
		gap: 15px;
		min-width: 300px;
		max-width: 500px;
		animation: slideIn 0.3s ease-out;

		button {
			background: none;
			border: none;
			font-size: 24px;
			cursor: pointer;
			opacity: 0.7;
			margin-left: auto;
			padding: 0;
			width: 24px;
			height: 24px;
			display: flex;
			align-items: center;
			justify-content: center;

			&:hover {
				opacity: 1;
			}
		}
	}

	.notification-error {
		background-color: #dc3545;
		color: white;
	}

	.notification-success {
		background-color: #28a745;
		color: white;
	}

	.notification-info {
		background-color: #17a2b8;
		color: white;
	}

	@keyframes slideIn {
		from {
			transform: translateX(400px);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}
</style>
