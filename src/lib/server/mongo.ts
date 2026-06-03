import { env } from "$env/dynamic/private";
import { logger } from "$lib/server/logger";
import type { CollectionJSON, CollectionMappings, Mappings, ShardingInfo } from "$lib/types";
import type { ShardKey } from "$lib/utils/shardKey";
import { resolveSrv } from "dns/promises";
import { MongoClient, ReadPreference, type Collection } from "mongodb";
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

/**
 * Extract node hosts from a MongoDB connection string
 * Handles both mongodb:// and mongodb+srv:// formats
 */
export async function extractNodesFromConnectionString(connectionString: string): Promise<string[]> {
	const url = new URL(connectionString);

	if (url.protocol === "mongodb+srv:") {
		// For SRV, resolve DNS records
		const hostname = url.hostname;
		const srvRecords = await resolveSrv(`_mongodb._tcp.${hostname}`);
		return srvRecords
			.sort((a, b) => a.priority - b.priority || b.weight - a.weight)
			.map((record) => `${record.name}:${record.port}`)
			.sort();
	}
	if (url.protocol === "mongodb:") {
		// For standard mongodb://, extract hosts from the connection string
		// Format: mongodb://[username:password@]host1[:port1][,host2[:port2],...]/[database][?options]
		const hostsString = url.host;
		if (!hostsString) {
			throw new Error("No hosts found in connection string");
		}

		// Split by comma to get all hosts and sort lexically
		return hostsString
			.split(",")
			.map((host) => host.trim())
			.filter((host) => host.length > 0)
			.sort();
	}
	throw new TypeError(`Unsupported protocol: ${url.protocol}`);
}

export type IndexKey = Record<string, 1 | -1 | string>;

export interface CachedIndex {
	name: string;
	key: IndexKey;
}

export class MongoClientWithMappings extends MongoClient {
	url: string;
	mappings: Record<string, Record<string, Mappings>> = {};
	indexes: Record<string, Record<string, CachedIndex[]>> = {};
	_id: string;
	name: string;

	constructor(url: string, _id: string, name: string, readPreference?: ReadPreference) {
		super(url, readPreference ? { readPreference } : {});
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

	async getIndexes(dbName: string, collectionName: string, opts?: { forceRefresh?: boolean }): Promise<CachedIndex[]> {
		if (opts?.forceRefresh || !this.indexes[dbName]?.[collectionName]) {
			const indexList = await this.db(dbName).collection(collectionName).listIndexes().toArray();
			this.indexes[dbName] ??= {};
			this.indexes[dbName][collectionName] = indexList.map((index) => ({
				name: index.name,
				key: index.key as IndexKey,
			}));
		}
		return this.indexes[dbName][collectionName];
	}

	setIndexes(dbName: string, collectionName: string, indexes: CachedIndex[]) {
		this.indexes[dbName] ??= {};
		this.indexes[dbName][collectionName] = indexes;
	}

	clearIndexesCache(dbName: string, collectionName: string) {
		delete this.indexes[dbName]?.[collectionName];
	}

	/**
	 * Check if a field has an index (as the first key in the index)
	 */
	async hasIndexOnField(dbName: string, collectionName: string, field: string): Promise<boolean> {
		const indexes = await this.getIndexes(dbName, collectionName);
		return indexes.some((index) => {
			const keys = Object.keys(index.key);
			return keys[0] === field;
		});
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
	private countTimeout = parseInt(env.MONGOKU_COUNT_TIMEOUT!, 10) || 30_000;
	private queryTimeout = env.MONGOKU_QUERY_TIMEOUT ? parseInt(env.MONGOKU_QUERY_TIMEOUT, 10) : undefined;
	private excludedDatabases: Set<string>;
	private readPreference: ReadPreference | undefined;

	constructor() {
		this.hostsManager = new HostsManager();
		// Parse MONGOKU_EXCLUDE_DATABASES env var (comma-separated list)
		const excludeEnv = env.MONGOKU_EXCLUDE_DATABASES || "";
		this.excludedDatabases = new Set(
			excludeEnv
				.split(",")
				.map((db) => db.trim())
				.filter((db) => db.length > 0),
		);

		// Parse read preference from env vars
		// MONGOKU_READ_PREFERENCE: primary, primaryPreferred, secondary, secondaryPreferred, nearest
		// MONGOKU_READ_PREFERENCE_TAGS: JSON array of tag sets, e.g. [{"nodeType":"ANALYTICS"},{}]
		const readPrefMode = env.MONGOKU_READ_PREFERENCE as
			| "primary"
			| "primaryPreferred"
			| "secondary"
			| "secondaryPreferred"
			| "nearest"
			| undefined;

		if (readPrefMode) {
			let tags: Array<Record<string, string>> | undefined;
			if (env.MONGOKU_READ_PREFERENCE_TAGS) {
				try {
					tags = JSON.parse(env.MONGOKU_READ_PREFERENCE_TAGS);
				} catch (err) {
					logger.error("Failed to parse MONGOKU_READ_PREFERENCE_TAGS:", err);
				}
			}
			this.readPreference = tags ? new ReadPreference(readPrefMode, tags) : new ReadPreference(readPrefMode);
			logger.log(`Read preference configured: ${readPrefMode}${tags ? ` with tags ${JSON.stringify(tags)}` : ""}`);
		}
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
					const client = new MongoClientWithMappings(urlStr, host._id, hostname, this.readPreference);
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
				const client = new MongoClientWithMappings(urlStr, id, hostname, this.readPreference);
				this.clients.set(id, client);
				this.clientIds.set(hostname, id);
			}
		} catch (err) {
			logger.error(`Failed to parse URL for host ${hostPath}:`, err);
			throw err;
		}
	}

	async removeServer(name: string) {
		const clientKey = this.clientIds.has(name) ? name : `${name}:27017`;
		const clientId = this.clientIds.get(clientKey);
		if (!clientId) {
			throw new Error(`Server not found: ${name}`);
		}

		await this.hostsManager.removeById(clientId);

		this.clients
			.get(clientId)
			?.close()
			.catch((err) => logger.error(`Error closing client ${name}:`, err));
		this.clients.delete(clientId);
		this.clientIds.delete(clientKey);
	}

	async reconnectClient(id: string) {
		// Close the old client
		const oldClient = this.clients.get(id);
		if (!oldClient) {
			throw new Error(`Client not found: ${id}`);
		}

		oldClient.close().catch((err) => logger.error(`Error closing old client ${id}:`, err));

		// Create a new client
		const newClient = new MongoClientWithMappings(oldClient.url, id, oldClient.name, this.readPreference);
		this.clients.set(id, newClient);

		// Test the connection
		await newClient.connect();
	}

	/**
	 * Get the list of nodes from a server's connection string
	 */
	async getServerNodes(serverId: string): Promise<string[]> {
		const client = this.getClient(serverId);
		return extractNodesFromConnectionString(client.url);
	}

	/**
	 * Fetch index stats from a specific node using directConnection
	 */
	async getIndexStatsFromNode(
		serverId: string,
		node: string,
		database: string,
		collection: string,
	): Promise<Record<string, { ops: number; since: Date; host: string }>> {
		const client = this.getClient(serverId);
		const url = new URL(client.url);

		// Build direct connection URL
		// Keep credentials and other params, but set the host to the specific node
		const directUrl = new URL(url.toString());
		directUrl.protocol = "mongodb:";
		directUrl.host = node;
		directUrl.searchParams.set("directConnection", "true");

		// Keep TLS if it was in the original URL
		if (url.searchParams.has("tls") || url.searchParams.has("ssl") || url.protocol === "mongodb+srv:") {
			directUrl.searchParams.set("tls", "true");
		}

		// Create a temporary client for this specific node
		let nodeClient: MongoClient | null = null;
		// todo: use await using when possible
		try {
			nodeClient = new MongoClient(directUrl.toString());
			await nodeClient.connect();

			const coll = nodeClient.db(database).collection(collection);
			const statsResult = await coll.aggregate([{ $indexStats: {} }]).toArray();

			const indexStats = Object.fromEntries(
				statsResult.map((stat) => [
					stat.name,
					{
						ops: stat.accesses?.ops || 0,
						since: stat.accesses?.since || new Date(),
						host: stat.host || node,
					},
				]),
			);

			return indexStats;
		} finally {
			if (nodeClient) {
				await nodeClient.close();
			}
		}
	}

	/**
	 * Return the shard key for every sharded collection in a database, in a single
	 * query against `config.collections`. Read-only.
	 *
	 * Returns a map of collectionName -> shard key. Collections that are not
	 * sharded (or on non-sharded clusters) are simply absent from the map.
	 * Designed to be cheap enough to call once for a whole collection list.
	 */
	async getDatabaseShardKeys(serverId: string, database: string): Promise<Record<string, ShardKey>> {
		const client = this.getClient(serverId);
		const configDb = client.db("config");
		const result: Record<string, ShardKey> = {};

		try {
			// _id of config.collections is the namespace "db.coll".
			// Match all namespaces in this database via a prefix regex.
			const prefix = `${database}.`;
			const docs = (await configDb
				.collection("collections")
				.find({
					_id: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` },
				} as unknown as Record<string, unknown>)
				.project({ _id: 1, key: 1, dropped: 1 })
				.toArray()) as unknown as Array<{
				_id: string;
				key?: ShardKey;
				dropped?: boolean;
			}>;

			for (const doc of docs) {
				if (doc.dropped || !doc.key) {
					continue;
				}
				const name = doc._id.slice(prefix.length);
				result[name] = doc.key;
			}
		} catch (err) {
			logger.error("Error reading config.collections for shard keys:", err);
		}

		return result;
	}

	/**
	 * Gather sharding information for a collection.
	 *
	 * Everything here is read-only: it reads the `config` database
	 * (config.collections / config.chunks / config.shards) and runs `$collStats`.
	 * On a non-sharded (standalone / replica set) deployment, the `config`
	 * collections won't exist and we return `shardingEnabled: false`.
	 */
	async getShardingInfo(serverId: string, database: string, collection: string): Promise<ShardingInfo> {
		const client = this.getClient(serverId);
		const ns = `${database}.${collection}`;

		const info: ShardingInfo = {
			shardingEnabled: false,
			sharded: false,
			shardKey: null,
			hashed: false,
			unique: false,
			totalChunks: 0,
			shards: [],
			balancerEnabled: true,
			warning: null,
		};

		const configDb = client.db("config");

		// Detect whether this is a sharded cluster at all by looking for the
		// config.shards collection. On a plain replica set this throws / is empty.
		let shardDocs: Array<{ _id: string; host: string }> = [];
		try {
			shardDocs = (await configDb.collection("shards").find({}).toArray()) as unknown as Array<{
				_id: string;
				host: string;
			}>;
		} catch (err) {
			logger.error("Error reading config.shards (not a sharded cluster?):", err);
			return info; // shardingEnabled stays false
		}

		if (shardDocs.length === 0) {
			// No shards => not connected through mongos / not a sharded cluster.
			return info;
		}

		info.shardingEnabled = true;

		// Look up this collection's sharding metadata.
		// In MongoDB the _id of config.collections is the namespace "db.coll".
		type CollConfig = {
			_id: string;
			key?: Record<string, 1 | -1 | string>;
			unique?: boolean;
			dropped?: boolean;
			noBalance?: boolean;
			uuid?: unknown;
		};
		let collConfig: CollConfig | null = null;
		try {
			collConfig = (await configDb
				.collection("collections")
				.findOne({ _id: ns } as unknown as Record<string, unknown>)) as CollConfig | null;
		} catch (err) {
			logger.error("Error reading config.collections:", err);
			info.warning = "Could not read config.collections";
		}

		// Per-shard storage/document stats from $collStats (works whether sharded or not).
		const perShard = new Map<string, { documents: number | null; size: number | null }>();
		try {
			const statsResults = await client
				.db(database)
				.collection(collection)
				.aggregate([{ $collStats: { storageStats: {} } }])
				.toArray();
			for (const stat of statsResults) {
				const shardId = (stat.shard as string) || shardDocs[0]?._id || "unknown";
				perShard.set(shardId, {
					documents: (stat.storageStats?.count as number) ?? null,
					size: (stat.storageStats?.size as number) ?? null,
				});
			}
		} catch (err) {
			logger.error("Error reading $collStats for sharding info:", err);
		}

		if (collConfig && !collConfig.dropped && collConfig.key) {
			info.sharded = true;
			info.shardKey = collConfig.key;
			info.hashed = Object.values(collConfig.key).some((v) => v === "hashed");
			info.unique = !!collConfig.unique;
			info.balancerEnabled = !collConfig.noBalance;

			// Count chunks per shard for this namespace.
			// Newer MongoDB keys config.chunks by `uuid`, older ones by `ns`.
			try {
				let chunkFilter: Record<string, unknown> = { ns };
				if (collConfig.uuid !== undefined) {
					chunkFilter = { uuid: collConfig.uuid };
				}
				const chunkCounts = await configDb
					.collection("chunks")
					.aggregate([{ $match: chunkFilter }, { $group: { _id: "$shard", count: { $sum: 1 } } }])
					.toArray();
				const chunkMap = new Map<string, number>(chunkCounts.map((c) => [c._id as string, c.count as number]));
				info.totalChunks = chunkCounts.reduce((acc, c) => acc + (c.count as number), 0);

				info.shards = shardDocs.map((shard) => ({
					shardId: shard._id,
					host: shard.host,
					chunks: chunkMap.get(shard._id) ?? 0,
					documents: perShard.get(shard._id)?.documents ?? null,
					size: perShard.get(shard._id)?.size ?? null,
				}));
			} catch (err) {
				logger.error("Error reading config.chunks:", err);
				info.warning = "Could not read chunk distribution";
				info.shards = shardDocs.map((shard) => ({
					shardId: shard._id,
					host: shard.host,
					chunks: 0,
					documents: perShard.get(shard._id)?.documents ?? null,
					size: perShard.get(shard._id)?.size ?? null,
				}));
			}
		} else {
			// Unsharded collection on a sharded cluster: it lives on its primary shard.
			info.sharded = false;
			info.shards = [...perShard.entries()].map(([shardId, stats]) => {
				const shard = shardDocs.find((s) => s._id === shardId);
				return {
					shardId,
					host: shard?.host ?? shardId,
					chunks: 0,
					documents: stats.documents,
					size: stats.size,
				};
			});
		}

		return info;
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
