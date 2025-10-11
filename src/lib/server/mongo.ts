import { MongoClient, MongoError, ObjectId, type Collection, type Db } from "mongodb";
import { URL } from "url";
import { HostsManager, type Host } from "./HostsManager";
import JsonEncoder from "./JsonEncoder";

export type ServerError = {
	name: string;
	error: { message: string; code?: number | string; name: string };
};

export interface CollectionJSON {
	name: string;
	size: number;
	dataSize: number;
	count: number;
	avgObjSize: number;
	storageSize: number;
	capped: boolean;
	nIndexes: number;
	totalIndexSize: number;
	indexSizes: {
		[name: string]: number;
	};
	indexes: Array<{
		name: string;
		key?: Record<string, number>;
		size: number;
	}>;
}

export interface DatabaseJSON {
	name: string;
	size: number;
	dataSize: number;
	avgObjSize: number;
	storageSize: number;
	totalIndexSize: number;
	empty: boolean;
	collections: CollectionJSON[];
}

export interface ServerJSON {
	name: string;
	size: number;
	databases: DatabaseJSON[];
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

	private getClient(name: string): MongoClient | MongoError {
		const client = this.clients.get(name) || this.clients.get(`${name}:27017`);
		if (!client) {
			throw new Error("Server does not exist");
		}
		return client;
	}

	async addServer(hostPath: string) {
		await this.hostsManager.add(hostPath);
		await this.initialize();
	}

	async removeServer(name: string) {
		await this.hostsManager.remove(name);
		this.clients.delete(name);
	}

	// Get all servers with their databases
	async getServersJson(): Promise<(ServerJSON | ServerError)[]> {
		const servers: (ServerJSON | ServerError)[] = [];

		for (const [name, client] of this.clients.entries()) {
			if (client instanceof Error) {
				servers.push({
					name: name,
					error: {
						code: client.code,
						name: client.name,
						message: client.message,
					},
				});
			} else {
				const serverJson = await this.getServerJson(name);
				if (serverJson) {
					servers.push(serverJson);
				}
			}
		}

		servers.sort((a, b) => a.name.localeCompare(b.name));
		return servers;
	}

	private async getServerJson(name: string): Promise<ServerJSON | undefined> {
		const client = this.getClient(name);
		if (client instanceof Error) {
			return undefined;
		}

		const adminDb = client.db("test").admin();
		const results = await adminDb.listDatabases();
		const size = results.totalSize ?? 0;

		const databases: DatabaseJSON[] = [];
		if (Array.isArray(results.databases)) {
			for (const d of results.databases) {
				const db = client.db(d.name);
				const dbJson = await this.getDatabaseJson(db, d.sizeOnDisk ?? 0, d.empty ?? true);
				databases.push(dbJson);
			}
		}

		databases.sort((a, b) => a.name.localeCompare(b.name));

		return {
			name,
			size,
			databases,
		};
	}

	// Get databases for a server
	async getDatabasesJson(serverName: string): Promise<DatabaseJSON[]> {
		const client = this.getClient(serverName);
		if (client instanceof Error) {
			return [];
		}

		const adminDb = client.db("test").admin();
		const results = await adminDb.listDatabases();

		const databases: DatabaseJSON[] = [];
		if (Array.isArray(results.databases)) {
			for (const d of results.databases) {
				const db = client.db(d.name);
				const dbJson = await this.getDatabaseJson(db, d.sizeOnDisk ?? 0, d.empty ?? true);
				databases.push(dbJson);
			}
		}

		return databases;
	}

	private async getDatabaseJson(db: Db, size: number, empty: boolean): Promise<DatabaseJSON> {
		let totalObjNr = 0;
		let storageSize = 0;
		let indexSize = 0;
		let dataSize = 0;

		const collections = await db.listCollections().toArray();
		const collectionsJson: CollectionJSON[] = [];

		for (const c of collections) {
			const collection = db.collection(c.name);
			const collectionJson = await this.getCollectionJson(collection, c.type);
			collectionsJson.push(collectionJson);

			totalObjNr += collectionJson.count;
			storageSize += collectionJson.storageSize;
			indexSize += collectionJson.totalIndexSize;
			dataSize += collectionJson.dataSize;
		}

		collectionsJson.sort((a, b) => a.name.localeCompare(b.name));

		return {
			name: db.databaseName,
			size,
			dataSize,
			avgObjSize: Math.round(storageSize / totalObjNr) || 0,
			storageSize,
			totalIndexSize: indexSize,
			empty,
			collections: collectionsJson,
		};
	}

	// Get collections for a database
	async getCollectionsJson(serverName: string, databaseName: string): Promise<CollectionJSON[]> {
		const client = this.getClient(serverName);
		if (client instanceof Error) {
			return [];
		}

		const db = client.db(databaseName);
		const collections = await db.listCollections().toArray();
		const collectionsJson: CollectionJSON[] = [];

		for (const c of collections) {
			const collection = db.collection(c.name);
			const collectionJson = await this.getCollectionJson(collection, c.type);
			collectionsJson.push(collectionJson);
		}

		return collectionsJson;
	}

	private async getCollectionJson(
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

	// Get a specific collection
	getCollection(serverName: string, databaseName: string, collectionName: string): Collection | undefined {
		const client = this.getClient(serverName);
		if (client instanceof Error) {
			return undefined;
		}

		const db = client.db(databaseName);
		return db.collection(collectionName);
	}

	// Collection operations
	async findOne(serverName: string, databaseName: string, collectionName: string, documentId: string) {
		const collection = this.getCollection(serverName, databaseName, collectionName);
		if (!collection) {
			return undefined;
		}

		const obj = await collection.findOne({
			_id: new ObjectId(documentId),
		});
		return JsonEncoder.encode(obj);
	}

	async find(
		serverName: string,
		databaseName: string,
		collectionName: string,
		query: unknown,
		project: Record<string, unknown>,
		sort: unknown,
		limit: number,
		skip: number,
	) {
		const collection = this.getCollection(serverName, databaseName, collectionName);
		if (!collection) {
			return [];
		}

		return collection
			.find(JsonEncoder.decode(query))
			.project(project)
			.sort(JsonEncoder.decode(sort))
			.limit(limit)
			.skip(skip)
			.map((obj) => JsonEncoder.encode(obj))
			.toArray();
	}

	async count(serverName: string, databaseName: string, collectionName: string, query: unknown) {
		const collection = this.getCollection(serverName, databaseName, collectionName);
		if (!collection) {
			return null;
		}

		if (query && Object.keys(query).length > 0) {
			try {
				return await collection.countDocuments(JsonEncoder.decode(query), {
					maxTimeMS: this.countTimeout,
				});
			} catch {
				return null;
			}
		}
		// fast count
		return collection.estimatedDocumentCount();
	}

	async updateOne(
		serverName: string,
		databaseName: string,
		collectionName: string,
		documentId: string,
		newObj: unknown,
		partial: boolean,
	) {
		const collection = this.getCollection(serverName, databaseName, collectionName);
		if (!collection) {
			return undefined;
		}

		const newValue = JsonEncoder.decode(newObj);

		// TODO: For now it makes it impossible to remove fields from object with a projection
		const update = partial ? { $set: newValue } : JsonEncoder.decode(newValue);
		await collection.replaceOne(
			{
				_id: new ObjectId(documentId),
			},
			update,
		);

		return JsonEncoder.encode(newValue);
	}

	async removeOne(serverName: string, databaseName: string, collectionName: string, documentId: string) {
		const collection = this.getCollection(serverName, databaseName, collectionName);
		if (!collection) {
			return;
		}

		await collection.deleteOne({
			_id: new ObjectId(documentId),
		});
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
