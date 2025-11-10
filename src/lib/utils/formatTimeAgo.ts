/**
 * Format a timestamp as relative time ago (e.g., "5m 30s ago", "2h 15m ago")
 */
export function formatTimeAgo(timestamp: Date | null): string {
	if (!timestamp) return "";

	const now = new Date();
	const elapsed = now.getTime() - timestamp.getTime();
	const seconds = Math.floor(elapsed / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (hours > 0) {
		return `${hours}h ${minutes % 60}m ago`;
	} else if (minutes > 0) {
		return `${minutes}m ${seconds % 60}s ago`;
	} else {
		return `${seconds}s ago`;
	}
}
