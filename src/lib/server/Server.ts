import * as MongoDb from "mongodb";

import { Database, type DatabaseJSON } from "./Database";

export interface ServerJSON {
	name: string;
	size: number;
	databases: DatabaseJSON[];
}

export class Server {
	private _client: MongoDb.MongoClient;
	private _name: string;
	private _size: number = 0;

	get name() {
		return this._name;
	}
	get size() {
		return this._size;
	}

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
		return databases.find((d) => d.name === name);
	}

	async toJson(): Promise<ServerJSON> {
		const databases = await this.databases();
		const dbsJson: DatabaseJSON[] = [];
		for (const database of databases) {
			const json = await database.toJson();
			dbsJson.push(json);
		}
		dbsJson.sort((a, b) => a.name.localeCompare(b.name));

		return {
			name: this.name,
			size: this.size,
			databases: dbsJson,
		};
	}
}
