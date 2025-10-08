import { MongoClient, MongoError } from "mongodb";
import { URL } from "url";

import factory from "./Factory";

import { inspect } from "node:util";
import { Collection, type CollectionJSON } from "./Collection";
import { type DatabaseJSON } from "./Database";
import { type Host } from "./HostsManager";
import { Server, type ServerJSON } from "./Server";

export class MongoManager {
	private _servers: {
		[name: string]: Server | MongoError;
	} = {};

	private async connect(host: Host) {
		const urlStr = host.path.startsWith("mongodb") ? host.path : `mongodb://${host.path}`;
		const url = new URL(urlStr);
		const hostname = url.host || host.path;

		if (this._servers[hostname] instanceof Server) {
			// Already connected
			return;
		}

		try {
			const client = new MongoClient(urlStr);
			await client.connect();
			const server = new Server(hostname, client);
			this._servers[hostname] = server;
			console.info(`[${hostname}] Connected to ${hostname}`);
			await this.checkAuth(hostname);
		} catch (err) {
			if (err instanceof MongoError) {
				console.error(`Error while connecting to ${hostname}:`, err.code, err.message);
				this._servers[hostname] = err;
			} else {
				throw err;
			}
		}
	}

	private getServer(name: string) {
		const server = this._servers[name] || this._servers[`${name}:27017`];
		if (!server) {
			throw new Error("Server does not exist");
		}
		return server;
	}

	private async checkAuth(name: string) {
		const server = this.getServer(name);
		if (server instanceof Error) {
			return;
		}

		try {
			await server.toJson();
		} catch (err) {
			console.log(inspect(err, false, 20));
			if (err instanceof MongoError) {
				if (err.code == 13 && err.message.includes("Unauthorized")) {
					this._servers[name] = err;
				}
			} else {
				throw err;
			}
		}
	}

	async load() {
		const hosts = await factory.hostsManager.getHosts();
		await Promise.all(hosts.map((h: Host) => this.connect(h)));
	}

	removeServer(name: string) {
		delete this._servers[name];
	}

	async getServersJson(): Promise<
		(ServerJSON | { name: string; error: { code?: number | string; name: string; message: string } })[]
	> {
		const servers: (ServerJSON | { name: string; error: { code?: number | string; name: string; message: string } })[] =
			[];
		for (const [name, server] of Object.entries(this._servers)) {
			if (server instanceof Error) {
				servers.push({
					name: name,
					error: {
						code: server.code,
						name: server.name,
						message: server.message,
					},
				});
			} else {
				const json = await server.toJson();
				servers.push(json);
			}
		}
		servers.sort((a, b) => a.name.localeCompare(b.name));
		return servers;
	}

	async getDatabasesJson(serverName: string): Promise<DatabaseJSON[]> {
		const server = this.getServer(serverName);
		if (server instanceof Error) {
			return [];
		}

		const json = await server.toJson();
		return json.databases;
	}

	async getCollectionsJson(serverName: string, databaseName: string): Promise<CollectionJSON[]> {
		const server = this.getServer(serverName);
		if (server instanceof Error) {
			return [];
		}
		const database = await server.database(databaseName);
		if (!database) {
			return [];
		}

		const json = await database.toJson();
		return json.collections;
	}

	async getCollection(
		serverName: string,
		databaseName: string,
		collectionName: string,
	): Promise<Collection | undefined> {
		const server = this.getServer(serverName);
		if (server instanceof Error) {
			return;
		}

		const database = await server.database(databaseName);
		if (!database) {
			return;
		}

		const collection = await database.collection(collectionName);
		return collection;
	}
}
