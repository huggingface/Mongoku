import * as MongoDb from 'mongodb';
import JsonEncoder from '../lib/JsonEncoder';

export interface CollectionJSON {
	name: string;
	size: number;
	count: number;
	avgObjSize: number;
	storageSize: number;
	capped: boolean;
	nIndexes: number;
	totalIndexSize: number;
	indexSizes: {
		[name: string]: number;
	}
}

export class Collection {
	private _collection: MongoDb.Collection;
	
	get name() {
		return this._collection.collectionName;
	}
	
	constructor(collection: MongoDb.Collection) {
		this._collection = collection;
	}
	
	findOne(document: string) {
		return this._collection.findOne({
			_id: new MongoDb.ObjectId(document)
		}).then((obj) => {
			return JsonEncoder.encode(obj);
		})
	}
	
	find(query: any, sort: any, limit: number, skip: number) {
		return this._collection.find(JsonEncoder.decode(query))
			.sort(JsonEncoder.decode(sort))
			.limit(limit)
			.skip(skip)
			.map((obj) => {
				return JsonEncoder.encode(obj);
			})
			.toArray();
	}
	
	updateOne(document: string, newObj: any) {
		const update = JsonEncoder.decode(newObj);
		return this._collection.replaceOne({
			_id: new MongoDb.ObjectId(document)
		}, update).then((_) => {
			return JsonEncoder.encode(update);
		});
	}
	
	count(query) {
		return this._collection.estimatedDocumentCount(JsonEncoder.decode(query));
		// return this._collection.countDocuments(JsonEncoder.decode(query));
	}
	
	async toJson(): Promise<CollectionJSON> {
		const stats = await this._collection.stats();
		
		return {
			// ns:             stats.ns,
			name:           this.name,
			size:           stats.size,
			count:          stats.count,
			avgObjSize:     stats.avgObjSize,
			storageSize:    stats.storageSize,
			capped:         stats.capped,
			nIndexes:       stats.nindexes,
			totalIndexSize: stats.totalIndexSize,
			indexSizes:     stats.indexSizes
		};
	}
}
