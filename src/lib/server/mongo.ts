import type { CollectionJSON, MappingTarget } from "$lib/types";
import { MongoClient, type Collection } from "mongodb";
import { URL } from "url";
import { HostsManager } from "./HostsManager";
import { MappingsManager } from "./MappingsManager";

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
	/**
	 * Todo: better system where we can have mutiple servers with same hostname, and labels for each server that
	 * would be displayed in the UI instead of the hostname.
	 */
	private clients: Map<string, MongoClient> = new Map();
	private clientIds: Map<string, string> = new Map(); // hostname -> _id
	private hostsManager: HostsManager;
	private mappingsManager: MappingsManager;
	private countTimeout = parseInt(process.env.MONGOKU_COUNT_TIMEOUT!, 10) || 5000;
	private queryTimeout = process.env.MONGOKU_QUERY_TIMEOUT
		? parseInt(process.env.MONGOKU_QUERY_TIMEOUT, 10)
		: undefined;

	constructor() {
		this.hostsManager = new HostsManager();
		this.mappingsManager = new MappingsManager();
	}

	async initialize() {
		await this.hostsManager.load();
		const hosts = await this.hostsManager.getHosts();

		// Create MongoClient instances without connecting (lazy connection)
		for (const host of hosts) {
			const urlStr = host.path.startsWith("mongodb") ? host.path : `mongodb://${host.path}`;
			try {
				const url = new URL(urlStr);
				const hostname = url.host || host.path;

				if (!this.clients.has(hostname)) {
					const client = new MongoClient(urlStr);
					this.clients.set(hostname, client);
					this.clientIds.set(hostname, host._id);
				}
			} catch (err) {
				console.error(`Failed to parse URL for host ${host.path}:`, err);
			}
		}
	}

	getClient(name: string): MongoClient {
		const client = this.clients.get(name) || this.clients.get(`${name}:27017`);
		if (!client) {
			throw new Error(`Client not found: ${name}`);
		}
		return client;
	}

	listClients(): Array<{ name: string; _id: string; client: MongoClient }> {
		return Array.from(this.clients.entries())
			.filter(([, client]) => client instanceof MongoClient)
			.map(([name, client]) => ({
				name,
				_id: this.clientIds.get(name) || "",
				client: client as MongoClient,
			}));
	}

	getCollection(serverName: string, databaseName: string, collectionName: string) {
		const client = this.getClient(serverName);
		const db = client.db(databaseName);
		return db.collection(collectionName);
	}

	getCountTimeout() {
		return this.countTimeout;
	}

	getQueryTimeout() {
		return this.queryTimeout;
	}

	async addServer(hostPath: string) {
		const id = await this.hostsManager.add(hostPath);

		// Add the new server client
		const urlStr = hostPath.startsWith("mongodb") ? hostPath : `mongodb://${hostPath}`;
		try {
			const url = new URL(urlStr);
			const hostname = url.host || hostPath;

			if (!this.clients.has(hostname)) {
				const client = new MongoClient(urlStr);
				this.clients.set(hostname, client);
				this.clientIds.set(hostname, id);
			}
		} catch (err) {
			console.error(`Failed to parse URL for host ${hostPath}:`, err);
			throw err;
		}
	}

	async removeServer(name: string) {
		await this.hostsManager.remove(name);
		this.clients.delete(name);
		this.clientIds.delete(name);
	}

	/**
	 * Get mappings for a specific collection
	 */
	async getMappings(
		serverName: string,
		databaseName: string,
		collectionName: string,
	): Promise<Record<string, MappingTarget | MappingTarget[]> | null> {
		const client = this.getClient(serverName);
		const db = client.db(databaseName);
		return this.mappingsManager.getMappings(serverName, databaseName, collectionName, db);
	}

	/**
	 * Get all mappings for a database
	 */
	async getAllMappings(
		serverName: string,
		databaseName: string,
	): Promise<Map<string, Record<string, MappingTarget | MappingTarget[]>>> {
		const client = this.getClient(serverName);
		const db = client.db(databaseName);
		return this.mappingsManager.getAllMappings(serverName, databaseName, db);
	}

	/**
	 * Refresh mappings from database (reload into cache)
	 */
	async refreshMappings(serverName: string, databaseName: string): Promise<void> {
		const client = this.getClient(serverName);
		const db = client.db(databaseName);
		await this.mappingsManager.refreshMappings(serverName, databaseName, db);
	}
}

// Singleton instance
let mongoConnections: MongoConnections | null = null;
let initPromise: Promise<MongoConnections> | null = null;

export async function getMongo(): Promise<MongoConnections> {
	if (!mongoConnections) {
		if (!initPromise) {
			initPromise = (async () => {
				mongoConnections = new MongoConnections();
				await mongoConnections.initialize();
				return mongoConnections;
			})();
		}
		return initPromise;
	}
	return mongoConnections;
}

export { mongoConnections };
