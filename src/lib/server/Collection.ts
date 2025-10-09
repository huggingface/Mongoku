import * as MongoDb from "mongodb";
import JsonEncoder from "./JsonEncoder";

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

export class Collection {
	private _collection: MongoDb.Collection;
	private countTimeout = parseInt(process.env.MONGOKU_COUNT_TIMEOUT!, 10) || 5000;
	private _type?: "view" | "timeseries" | "collection" | string;

	get name() {
		return this._collection.collectionName;
	}

	constructor(collection: MongoDb.Collection, type?: "view" | "timeseries" | "collection" | string) {
		this._collection = collection;
		this._type = type;
	}

	async findOne(document: string) {
		const obj = await this._collection.findOne({
			_id: new MongoDb.ObjectId(document),
		});
		return JsonEncoder.encode(obj);
	}

	find(query: unknown, project: MongoDb.Document, sort: MongoDb.Sort, limit: number, skip: number) {
		return this._collection
			.find(JsonEncoder.decode(query))
			.project(project)
			.sort(JsonEncoder.decode(sort))
			.limit(limit)
			.skip(skip)
			.map((obj) => {
				return JsonEncoder.encode(obj);
			})
			.toArray();
	}

	async updateOne(document: string, newObj: unknown, partial: boolean) {
		const newValue = JsonEncoder.decode(newObj);

		// TODO: For now it makes it impossible to remove fields from object with a projection
		const update = partial ? { $set: newValue } : JsonEncoder.decode(newValue);
		await this._collection.replaceOne(
			{
				_id: new MongoDb.ObjectId(document),
			},
			update,
		);

		return JsonEncoder.encode(newValue);
	}

	async removeOne(document: string) {
		await this._collection.deleteOne({
			_id: new MongoDb.ObjectId(document),
		});
	}

	async count(query: unknown) {
		if (query && Object.keys(query).length > 0) {
			try {
				return await this._collection.countDocuments(JsonEncoder.decode(query), {
					maxTimeMS: this.countTimeout,
				});
			} catch {
				return null;
			}
		}
		// fast count
		return this._collection.estimatedDocumentCount();
	}

	async toJson(): Promise<CollectionJSON> {
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

		if (this._type !== "view") {
			const agg = (await this._collection
				.aggregate([
					{
						$collStats: {
							// latencyStats: { histograms: <boolean> },
							storageStats: {},
							count: {},
							// queryExecStats: {}
						},
					},
				])
				.next()
				.catch(() => null)) as {
				ns: string;
				host: string;
				localTime: Date;
				storageStats: {
					size: number;
					count: number;
					numOrphanDocs: number;
					storageSize: number;
					freeStorageSize: number;
					capped: boolean;
					wiredTiger: unknown;
					nindexes: number;
					indexDetails: Record<string, unknown>;
					indexBuilds: Array<unknown>;
					totalIndexSize: number;
					indexSizes: Record<string, number>;
					totalSize: number;
					scaleFactor: number;
				};
				count: number;
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
		if (this._type !== "view") {
			try {
				const indexList = await this._collection.listIndexes().toArray();
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
			name: this.name,
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
}
