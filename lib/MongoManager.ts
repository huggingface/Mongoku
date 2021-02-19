import * as URL from 'url';
import * as MongoDb from 'mongodb';

import factory from '../lib/Factory';

import { Host } from './HostsManager';
import { Server, ServerJSON } from './Server';
import { DatabaseJSON } from './Database';
import { Collection, CollectionJSON } from './Collection';
import { Utils } from './Utils';

export type Servers = ServerJSON[]

export class MongoManager {
  private _servers: {
    [name: string]: Server;
  } = {};

  private async connect(host: Host) {
    const urlStr = host.path.startsWith('mongodb')
      ? host.path
      : `mongodb://${host.path}`;
    const url = URL.parse(urlStr);
    let hostname = url.host || host.path;

    if (this._servers[hostname] instanceof Server) {
      // Already connected
      return ;
    }

    const client = await MongoDb.MongoClient.connect(urlStr, {
      useUnifiedTopology: true,
      useNewUrlParser: true
    });
    const server = new Server(hostname, client);
    this._servers[hostname] = server;
    console.info(`[${hostname}] Host ${hostname} is added to host list`);
  }

  private getServer(name: string) {
    const server = this._servers[name] || this._servers[`${name}:27017`];
    if (!server) {
      throw new Error('Server does not exist');
    }
    return server;
  }

  async load() {
    let hosts = await factory.hostsManager.getHosts();
    await Promise.all(hosts.map((h) => this.connect(h)));
  }

  removeServer(name: string) {
    delete this._servers[name];
  }

  async getServersJson(): Promise<Servers> {
    const servers: Servers = [];
    for (const server of Object.values(this._servers)) {
      const json = await server.toJson();
      servers.push(json);
    }
    Utils.fieldSort(servers, "name");
    return servers;
  }

  async getDatabasesJson(serverName: string): Promise<DatabaseJSON[]> {
    const server = this.getServer(serverName);
    const json = await server.toJson();
    return json.databases;
  }

  async getCollectionsJson(serverName: string, databaseName: string): Promise<CollectionJSON[]> {
    const server = this.getServer(serverName);
    const database = await server.database(databaseName);
    if (!database) {
      return [];
    }

    const json = await database.toJson();
    return json.collections;
  }

  async getCollection(serverName: string, databaseName: string, collectionName: string): Promise<Collection | undefined> {
    const server = this.getServer(serverName);
    const database = await server.database(databaseName);
    if (!database) { return ; }

    const collection = await database.collection(collectionName);
    return collection;
  }
}
