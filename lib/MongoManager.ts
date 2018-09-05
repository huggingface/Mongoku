import * as URL from 'url';
import * as MongoDb from 'mongodb';

import { Host, HostsManager } from './HostsManager';
import { Server, ServerJSON, ServerErrorJSON } from './Server';
import { Database, DatabaseJSON } from './Database';
import { Collection, CollectionJSON } from './Collection';
import { Utils } from './Utils';

const DEFAULT_HOST = 'localhost:27017';

export type Servers = (ServerJSON | ServerErrorJSON)[]

export class MongoManager {
	private hostsManager = new HostsManager();
	private _servers: {
		[name: string]: Server | MongoDb.MongoError;
	} = {};
	
	private async connect(host: Host) {
		const urlStr = `mongodb://${host.path}`
		const url = URL.parse(urlStr);
		const hostname = url.hostname || host.path;
		
		try {
			const client = await MongoDb.MongoClient.connect(urlStr, {
				useNewUrlParser: true
			});
			const server = new Server(hostname, client);
			this._servers[hostname] = server;
			console.info(`[${hostname}] Connected to ${urlStr}`);
		} catch (err) {
			console.error(`Error while connecting to ${urlStr}:`, err.code, err.message);
			this._servers[hostname] = err;
		}
	}
	
	private async discoverDatabases() {
		let servers = []
	}
	
	async load() {
		let hosts = await this.hostsManager.getHosts();
		hosts.unshift({ path: DEFAULT_HOST });
		await Promise.all(hosts.map((h) => this.connect(h)));
	}
	
	async getServersJson(): Promise<Servers> {
		const servers: Servers = [];
		for (const [name, server] of Object.entries(this._servers)) {
			if (server instanceof Error) {
				servers.push({
					name:  name,
					error: {
						code:    server.code,
						name:    server.name,
						message: server.message
					}
				});
			} else {
				const json = await server.toJson();
				servers.push(json);
			}
		}
		Utils.fieldSort(servers, "name");
		return servers;
	}
	
	async getDatabasesJson(serverName: string): Promise<DatabaseJSON[]> {
		const server = this._servers[serverName];
		if (server instanceof Error) {
			return [];
		}
		
		const json = await server.toJson();
		return json.databases;
	}
	
	async getCollectionsJson(serverName: string, databaseName: string): Promise<CollectionJSON[]> {
		const server = this._servers[serverName];
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
	
	async getCollection(serverName: string, databaseName: string, collectionName: string): Promise<Collection | undefined> {
		const server = this._servers[serverName];
		if (server instanceof Error) { return ; }
		
		const database = await server.database(databaseName);
		if (!database) { return ; }
		
		const collection = await database.collection(collectionName);
		return collection;
	}
}
