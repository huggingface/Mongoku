<script lang="ts">
	import IconClose from "$lib/icons/IconClose.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
</script>

<div class="notifications">
	{#each notificationStore.items as notification (notification.id)}
		<div class="notification notification-{notification.type}">
			<span>{notification.message}</span>
			<button onclick={() => notificationStore.remove(notification.id)} aria-label="Dismiss notification">
				<IconClose class="w-[18px] h-[18px]" />
			</button>
		</div>
	{/each}
</div>

<style lang="postcss">
	.notifications {
		position: fixed;
		top: 90px;
		right: 20px;
		/* Show above modal overlay */
		z-index: 1001;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.notification {
		padding: 14px 18px;
		border-radius: 1rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		backdrop-filter: blur(10px);
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 320px;
		max-width: 480px;
		animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
		border: 1px solid rgba(255, 255, 255, 0.1);
		font-size: 14px;

		button {
			background: rgba(255, 255, 255, 0.2);
			border: none;
			border-radius: 8px;
			cursor: pointer;
			opacity: 0.8;
			margin-left: auto;
			padding: 4px;
			width: 28px;
			height: 28px;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: all 0.2s;

			&:hover {
				opacity: 1;
				background: rgba(255, 255, 255, 0.3);
			}
		}
	}

	.notification-error {
		background-color: #ff453a;
		color: white;
	}

	.notification-success {
		background-color: var(--button-success);
		color: white;
	}

	.notification-info {
		background-color: #0a84ff;
		color: white;
	}

	@keyframes slideIn {
		from {
			transform: translateX(450px);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}
</style>
