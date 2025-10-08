export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	if (bytes < 1000) return bytes + " B";
	if (bytes < 1000000) return (bytes / 1000).toFixed(2) + " kB";
	if (bytes < 1000000000) return (bytes / 1000000).toFixed(2) + " MB";
	if (bytes < 1000000000000) return (bytes / 1000000000).toFixed(2) + " GB";
	return (bytes / 1000000000000).toFixed(2) + " TB";
}

export function formatNumber(num: number): string {
	return num.toLocaleString();
}

export function serverName(name: string): string {
	// Extract hostname from MongoDB connection string
	if (name.startsWith("mongodb://") || name.startsWith("mongodb+srv://")) {
		try {
			const url = new URL(name);
			return url.hostname;
		} catch {
			return name;
		}
	}
	return name;
}
