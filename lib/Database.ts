import * as MongoDb from 'mongodb';

import { Collection, CollectionJSON } from './Collection';
import { hideDatabase } from './HideDatabaseCollection';
import { Utils } from './Utils';

export interface DatabaseJSON {
  name:           string;
  size:           number;
  dataSize:       number;
  avgObjSize:     number;
  storageSize:    number;
  totalIndexSize: number;
  empty:          boolean;
  collections:    CollectionJSON[]
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

    if (hideDatabase(this._db.databaseName)) {
      return collections;
    }

    for (const c of cs) {
      const collection = new Collection(c);
      collections.push(collection);
    }

    return collections;
  }

  collection(name: string) {
    const c = this._db.collection(name);
    return new Collection(c);
  }

  async toJson() {
    let totalObjSize = 0;
    let totalObjNr = 0;
    let storageSize = 0;
    let indexSize = 0;
    let dataSize = 0;

    const collections = await this.collections();
    const csJson: CollectionJSON[] = [];
    for (const collection of collections) {
      const json = await collection.toJson();
      totalObjSize += json.avgObjSize * json.count;
      totalObjNr   += json.count;
      storageSize  += json.storageSize;
      indexSize    += json.totalIndexSize;
      dataSize     += json.dataSize;
      csJson.push(json);
    }
    Utils.fieldSort(csJson, 'name');

    return {
      name:           this.name,
      size:           this.size,
      dataSize:       dataSize,
      avgObjSize:     totalObjSize / totalObjNr,
      storageSize:    storageSize,
      totalIndexSize: indexSize,
      empty:          this.empty,
      collections:    csJson
    }
  }
}
