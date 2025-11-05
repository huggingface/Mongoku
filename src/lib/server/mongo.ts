import { logger } from "$lib/server/logger";
import type { CollectionJSON, CollectionMappings, Mappings } from "$lib/types";
import { MongoClient, type Collection } from "mongodb";
import { URL } from "url";
import { HostsManager } from "./HostsManager";

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

class MongoClientWithMappings extends MongoClient {
	url: string;
	mappings: Record<string, Record<string, Mappings>> = {};
	_id: string;
	name: string;

	constructor(url: string, _id: string, name: string) {
		super(url);
		this.url = url;
		this._id = _id;
		this.name = name;
	}

	async getMappings(dbName: string, collectionName: string, opts?: { forceRefresh?: boolean }): Promise<Mappings> {
		if (opts?.forceRefresh || !this.mappings[dbName]?.[collectionName]) {
			const mappings = await this.db(dbName)
				.collection<CollectionMappings>("mongoku.mappings")
				.findOne({ _id: collectionName });
			this.mappings[dbName] ??= {};
			this.mappings[dbName][collectionName] = mappings?.mappings ?? {};
		}
		return this.mappings[dbName][collectionName];
	}
	clearMappingsCache(dbName: string, collectionName: string) {
		delete this.mappings[dbName][collectionName];
	}
}

class MongoConnections {
	/**
	 * Todo: better system where we can have mutiple servers with same hostname, and labels for each server that
	 * would be displayed in the UI instead of the hostname.
	 */
	private clients: Map<string, MongoClientWithMappings> = new Map(); // _id -> MongoClientWithMappings
	private clientIds: Map<string, string> = new Map(); // hostname -> _id
	private hostsManager: HostsManager;
	private countTimeout = parseInt(process.env.MONGOKU_COUNT_TIMEOUT!, 10) || 30_000;
	private queryTimeout = process.env.MONGOKU_QUERY_TIMEOUT
		? parseInt(process.env.MONGOKU_QUERY_TIMEOUT, 10)
		: undefined;
	private excludedDatabases: Set<string>;

	constructor() {
		this.hostsManager = new HostsManager();
		// Parse MONGOKU_EXCLUDE_DATABASES env var (comma-separated list)
		const excludeEnv = process.env.MONGOKU_EXCLUDE_DATABASES || "";
		this.excludedDatabases = new Set(
			excludeEnv
				.split(",")
				.map((db) => db.trim())
				.filter((db) => db.length > 0),
		);
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
					const client = new MongoClientWithMappings(urlStr, host._id, hostname);
					this.clients.set(host._id, client);
					this.clientIds.set(hostname, host._id);
				}
			} catch (err) {
				logger.error(`Failed to parse URL for host ${host.path}:`, err);
			}
		}
	}

	getClient(name: string): MongoClientWithMappings {
		const clientId = this.clientIds.get(name) || this.clientIds.get(`${name}:27017`);
		if (!clientId) {
			throw new Error(`Client not found: ${name}`);
		}
		const client = this.clients.get(clientId);
		if (!client) {
			throw new Error(`Client not found: ${name}`);
		}
		return client;
	}

	listClients(): Array<{ name: string; _id: string; client: MongoClient }> {
		return Array.from(this.clients.values()).map((client) => ({
			name: client.name,
			_id: client._id,
			client: client as MongoClient,
		}));
	}

	getCountTimeout() {
		return this.countTimeout;
	}

	getQueryTimeout() {
		return this.queryTimeout;
	}

	filterDatabases<T extends { name: string }>(databases: T[]): T[] {
		if (this.excludedDatabases.size === 0) {
			return databases;
		}
		return databases.filter((db) => !this.excludedDatabases.has(db.name));
	}

	async addServer(hostPath: string) {
		const id = await this.hostsManager.add(hostPath);

		// Add the new server client
		const urlStr = hostPath.startsWith("mongodb") ? hostPath : `mongodb://${hostPath}`;
		try {
			const url = new URL(urlStr);
			const hostname = url.host || hostPath;

			if (!this.clients.has(hostname)) {
				const client = new MongoClientWithMappings(urlStr, id, hostname);
				this.clients.set(id, client);
				this.clientIds.set(hostname, id);
			}
		} catch (err) {
			logger.error(`Failed to parse URL for host ${hostPath}:`, err);
			throw err;
		}
	}

	async removeServer(name: string) {
		await this.hostsManager.remove(name);

		this.clients
			.get(name)
			?.close()
			.catch((err) => logger.error(`Error closing client ${name}:`, err));
		this.clients.delete(name);
		this.clientIds.delete(name);
	}

	async reconnectClient(id: string) {
		// Close the old client
		const oldClient = this.clients.get(id);
		if (!oldClient) {
			throw new Error(`Client not found: ${id}`);
		}

		oldClient.close().catch((err) => logger.error(`Error closing old client ${id}:`, err));

		// Create a new client
		const newClient = new MongoClientWithMappings(oldClient.url, id, oldClient.name);
		this.clients.set(id, newClient);

		// Test the connection
		await newClient.connect();
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
