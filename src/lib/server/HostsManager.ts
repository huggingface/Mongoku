import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface Host {
	path: string;
	_id?: string;
}

const DEFAULT_HOSTS = process.env.MONGOKU_DEFAULT_HOST
	? process.env.MONGOKU_DEFAULT_HOST.split(";")
	: ["localhost:27017"];
const DATABASE_FILE = process.env.MONGOKU_DATABASE_FILE || path.join(os.homedir(), ".mongoku.db");

export class HostsManager {
	private _hosts: Map<string, string> = new Map(); // path -> _id

	async load() {
		let first = false;
		try {
			await fs.promises.stat(DATABASE_FILE);
		} catch {
			first = true;
		}

		if (!first) {
			await this._loadFromFile();
		}

		if (first || this._hosts.size === 0) {
			// Initialize with default hosts
			for (const hostname of DEFAULT_HOSTS) {
				this._hosts.set(hostname, this._generateId());
			}
			await this._saveToFile();
		}
	}

	private async _loadFromFile(): Promise<void> {
		const content = await fs.promises.readFile(DATABASE_FILE, "utf8");
		const lines = content
			.trim()
			.split("\n")
			.filter((line) => line.trim());

		const newHosts = new Map<string, string>();
		for (const line of lines) {
			const host = JSON.parse(line);
			if (host && typeof host.path === "string") {
				// Use existing _id if available, generate new one if not
				const id = host._id || this._generateId();
				newHosts.set(host.path, id);
			}
		}
		this._hosts = newHosts;
	}

	private async _saveToFile(): Promise<void> {
		const lines = Array.from(this._hosts).map(([hostPath, id]) => JSON.stringify({ path: hostPath, _id: id }));
		await fs.promises.writeFile(DATABASE_FILE, lines.join("\n") + "\n", "utf8");
	}

	private _generateId(): string {
		// Generate a NeDB-compatible ID (16 characters, alphanumeric)
		const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		let result = "";
		for (let i = 0; i < 16; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return result;
	}

	async getHosts(): Promise<Host[]> {
		return Array.from(this._hosts).map(([hostPath, id]) => ({ path: hostPath, _id: id }));
	}

	async add(hostPath: string): Promise<void> {
		// Use existing ID if host already exists, generate new one if not
		if (!this._hosts.has(hostPath)) {
			this._hosts.set(hostPath, this._generateId());
		}
		await this._saveToFile();
	}

	async remove(hostPath: string): Promise<void> {
		// Remove exact matches and regex pattern matches
		const toRemove = Array.from(this._hosts.keys()).filter((existingPath) => {
			try {
				const regex = new RegExp(hostPath);
				return existingPath === hostPath || regex.test(existingPath);
			} catch {
				// If hostPath is not a valid regex, just do exact match
				return existingPath === hostPath;
			}
		});

		for (const host of toRemove) {
			this._hosts.delete(host);
		}
		await this._saveToFile();
	}
}
