import * as MongoDb from 'mongodb';

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
