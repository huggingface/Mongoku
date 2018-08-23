import * as MongoDb from 'mongodb';

import { Collection, CollectionJSON } from './Collection';

export interface DatabaseJSON {
	name:        string;
	size:        number;
	empty:       boolean;
	collections: CollectionJSON[]
}

export class Database {
	private _db:    MongoDb.Db;
	
	name: string;
	size: number;
	empty: boolean;
	
	constructor(name: string, size: number, empty: boolean, db: MongoDb.Db) {
		this.name  = name;
		this.size  = size;
		this.empty = empty;
		this._db   = db;
	}
	
	async collections() {
		const cs = await this._db.collections();
		const collections: Collection[] = [];
		
		for (const c of cs) {
			const collection = new Collection(c);
			collections.push(collection);
		}
		
		return collections;
	}
	
	collection(name: string) {
		const c = this._db.collection(name);
		return c;
	}
	
	async toJson() {
		const collections = await this.collections();
		const csJson: CollectionJSON[] = [];
		for (const collection of collections) {
			const json = await collection.toJson();
			csJson.push(json);
		}
		
		return {
			name:        this.name,
			size:        this.size,
			empty:       this.empty,
			collections: csJson
		}
	}
}
