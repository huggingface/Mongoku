import z from "zod";

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

	async notifyError(message: string | unknown, fallbackMessage?: string) {
		const finalMessage =
			typeof message === "string"
				? message
				: (z.object({ message: z.string() }).safeParse(message).data?.message ??
					z.object({ body: z.object({ message: z.string() }), status: z.number() }).safeParse(message).data?.body
						?.message ??
					fallbackMessage ??
					"An unexpected error occurred");
		this.notify(finalMessage, "error");
	},

	notifySuccess(message: string) {
		this.notify(message, "success");
	},

	remove(id: number) {
		notifications = notifications.filter((n) => n.id !== id);
	},
};
