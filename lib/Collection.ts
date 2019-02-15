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
	
	async findOne(document: string) {
		const obj = await this._collection.findOne({
			_id: new MongoDb.ObjectId(document)
		})
		return JsonEncoder.encode(obj);
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
	
	async updateOne(document: string, newObj: any) {
		const update = JsonEncoder.decode(newObj);
		await this._collection.replaceOne({
			_id: new MongoDb.ObjectId(document)
		}, update);
		return JsonEncoder.encode(update);
	}
	
	async removeOne(document: string) {
		await this._collection.deleteOne({
			_id: new MongoDb.ObjectId(document)
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
