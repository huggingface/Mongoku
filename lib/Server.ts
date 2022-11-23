import * as MongoDb from 'mongodb';

import { Database, DatabaseJSON } from './Database';
import { Utils } from './Utils';

export interface ServerJSON {
  name:      string;
  size:      number;
  databases: DatabaseJSON[]
}
export interface ServerErrorJSON {
  name:      string;
  error: {
    code:    string | number | undefined;
    name:    string;
    message: string;
  };
}

export class Server {
  private _client: MongoDb.MongoClient;
  private _name: string;
  private _size: number;

  get name() { return this._name; }
  get size() { return this._size; }

  constructor(name: string, client: MongoDb.MongoClient) {
    this._name = name;
    this._client = client;
  }

  async databases() {
    const db = this._client.db("test");
    const results = await db.admin().listDatabases();

    this._size = results.totalSize ?? 0;
    const databases: Database[] = [];
    if (Array.isArray(results.databases)) {
      for (const d of results.databases) {
        const db = this._client.db(d.name);
        const database = new Database(d.name, d.sizeOnDisk ?? 0, d.empty ?? true, db);
        databases.push(database);
      }
    }
    return databases;
  }

  async database(name: string): Promise<Database | undefined> {
    const databases = await this.databases();
    return databases.find(d => d.name === name)
  }

  async toJson(): Promise<ServerJSON> {
    const databases = await this.databases();
    const dbsJson: DatabaseJSON[] = [];
    for (const database of databases) {
      const json = await database.toJson();
      dbsJson.push(json);
    }
    Utils.fieldSort(dbsJson, 'name');

    return {
      name:      this.name,
      size:      this.size,
      databases: dbsJson
    }
  }
}
