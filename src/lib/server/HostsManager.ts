import { env } from "$env/dynamic/private";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface Host {
	path: string;
	_id: string;
}

const DEFAULT_HOSTS = env.MONGOKU_DEFAULT_HOST
	? env.MONGOKU_DEFAULT_HOST.split(";")
	: ["localhost:27017"];
const DATABASE_FILE = env.MONGOKU_DATABASE_FILE || path.join(os.homedir(), ".mongoku.db");

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

	getHost(name: string): string | undefined {
		return this._hosts.get(name);
	}

	async add(hostPath: string): Promise<string> {
		// Use existing ID if host already exists, generate new one if not
		let id = this._hosts.get(hostPath);
		if (!id) {
			id = this._generateId();
			this._hosts.set(hostPath, id);
		}
		await this._saveToFile();
		return id;
	}

	async removeById(id: string): Promise<void> {
		for (const [hostPath, hostId] of this._hosts) {
			if (hostId === id) {
				this._hosts.delete(hostPath);
				break;
			}
		}
		await this._saveToFile();
	}
}
