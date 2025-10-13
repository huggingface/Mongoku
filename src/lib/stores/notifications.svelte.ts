interface Notification {
	id: number;
	message: string;
	type: "success" | "error" | "info";
}

let notifications = $state<Notification[]>([]);
let nextId = 1;

export const notificationStore = {
	get items() {
		return notifications;
	},

	notify(message: string, type: "success" | "error" | "info" = "info") {
		const id = nextId++;
		notifications = [...notifications, { id, message, type }];

		setTimeout(() => {
			this.remove(id);
		}, 5000);
	},

	async notifyError(message: string) {
		this.notify(message, "error");
	},

	notifySuccess(message: string) {
		this.notify(message, "success");
	},

	remove(id: number) {
		notifications = notifications.filter((n) => n.id !== id);
	},
};
