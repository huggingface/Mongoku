import type { CollectionJSON } from "$lib/types";
import { MongoClient, MongoError, type Collection } from "mongodb";
import { URL } from "url";
import { HostsManager, type Host } from "./HostsManager";

export async function getCollectionJson(
	collection: Collection,
	type?: "view" | "timeseries" | "collection" | string,
): Promise<CollectionJSON> {
	const stats = {
		size: 0,
		count: 0,
		avgObjSize: 0,
		storageSize: 0,
		capped: false,
		nindexes: 0,
		totalIndexSize: 0,
		indexSizes: {},
	};

	if (type !== "view") {
		const agg = (await collection
			.aggregate([
				{
					$collStats: {
						storageStats: {},
						count: {},
					},
				},
			])
			.next()
			.catch(() => null)) as {
			storageStats: {
				size: number;
				count: number;
				storageSize: number;
				capped: boolean;
				nindexes: number;
				totalIndexSize: number;
				indexSizes: Record<string, number>;
			};
		} | null;

		if (agg) {
			stats.size = agg.storageStats.size;
			stats.count = agg.storageStats.count;
			stats.avgObjSize = Math.round(agg.storageStats.size / agg.storageStats.count);
			stats.storageSize = agg.storageStats.storageSize;
			stats.capped = agg.storageStats.capped;
			stats.nindexes = agg.storageStats.nindexes;
			stats.totalIndexSize = agg.storageStats.totalIndexSize;
			stats.indexSizes = agg.storageStats.indexSizes;
		}
	}

	// Get index definitions
	let indexes: Array<{ name: string; key?: Record<string, number>; size: number }> = [];
	if (type !== "view") {
		try {
			const indexList = await collection.listIndexes().toArray();
			indexes = indexList.map((index: { name: string; key: Record<string, number> }) => ({
				name: index.name,
				key: index.key,
				size: (stats.indexSizes as Record<string, number>)[index.name] || 0,
			}));
		} catch {
			// If we can't get index details, fall back to indexSizes
			indexes = Object.entries(stats.indexSizes).map(([name, size]) => ({
				name,
				size: size as number,
			}));
		}
	}

	return {
		name: collection.collectionName,
		size: (stats.storageSize ?? 0) + (stats.totalIndexSize ?? 0),
		dataSize: stats.size,
		count: stats.count,
		avgObjSize: stats.avgObjSize ?? 0,
		storageSize: stats.storageSize ?? 0,
		capped: stats.capped,
		nIndexes: stats.nindexes,
		totalIndexSize: stats.totalIndexSize ?? 0,
		indexSizes: stats.indexSizes,
		indexes,
	};
}

class MongoConnections {
	private clients: Map<string, MongoClient | MongoError> = new Map();
	private hostsManager: HostsManager;
	private countTimeout = parseInt(process.env.MONGOKU_COUNT_TIMEOUT!, 10) || 5000;

	constructor() {
		this.hostsManager = new HostsManager();
	}

	async initialize() {
		await this.hostsManager.load();
		const hosts = await this.hostsManager.getHosts();
		await Promise.all(hosts.map((h: Host) => this.connect(h)));
	}

	private async connect(host: Host) {
		const urlStr = host.path.startsWith("mongodb") ? host.path : `mongodb://${host.path}`;
		const url = new URL(urlStr);
		const hostname = url.host || host.path;

		if (this.clients.get(hostname) instanceof MongoClient) {
			// Already connected
			return;
		}

		try {
			const client = new MongoClient(urlStr);
			await client.connect();
			this.clients.set(hostname, client);
			console.info(`[${hostname}] Connected to ${hostname}`);
			await this.checkAuth(hostname);
		} catch (err) {
			if (err instanceof MongoError) {
				console.error(`Error while connecting to ${hostname}:`, err.code, err.message);
				this.clients.set(hostname, err);
			} else {
				throw err;
			}
		}
	}

	private async checkAuth(name: string) {
		const client = this.getClient(name);
		if (client instanceof Error) {
			return;
		}

		try {
			await client.db("test").admin().listDatabases();
		} catch (err) {
			if (err instanceof MongoError) {
				if (err.code == 13 && err.message.includes("Unauthorized")) {
					this.clients.set(name, err);
				}
			} else {
				throw err;
			}
		}
	}

	getClient(name: string): MongoClient | MongoError {
		const client = this.clients.get(name) || this.clients.get(`${name}:27017`);
		if (!client) {
			throw new Error("Server does not exist");
		}
		return client;
	}

	listClients(): Array<{ name: string; client: MongoClient | MongoError }> {
		return Array.from(this.clients.entries()).map(([name, client]) => ({ name, client }));
	}

	getCollection(serverName: string, databaseName: string, collectionName: string) {
		const client = this.getClient(serverName);
		if (client instanceof Error) {
			return undefined;
		}

		const db = client.db(databaseName);
		return db.collection(collectionName);
	}

	getCountTimeout() {
		return this.countTimeout;
	}

	async addServer(hostPath: string) {
		await this.hostsManager.add(hostPath);
		await this.initialize();
	}

	async removeServer(name: string) {
		await this.hostsManager.remove(name);
		this.clients.delete(name);
	}
}

// Singleton instance
let mongoConnections: MongoConnections | null = null;

export async function getMongo(): Promise<MongoConnections> {
	if (!mongoConnections) {
		mongoConnections = new MongoConnections();
		await mongoConnections.initialize();
	}
	return mongoConnections;
}

export { mongoConnections };
