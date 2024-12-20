import { URL } from 'url';
import { MongoClient, MongoError } from 'mongodb';
import { ReadPreference } from 'mongodb';

import factory from '../lib/Factory';

import { Host } from './HostsManager';
import { Server, ServerJSON, ServerErrorJSON } from './Server';
import { DatabaseJSON } from './Database';
import { Collection, CollectionJSON } from './Collection';
import { Utils } from './Utils';

export type Servers = (ServerJSON | ServerErrorJSON)[]

export class MongoManager {
  private _servers: {
    [name: string]: Server | MongoError;
  } = {};

  private async connect(host: Host) {
    const urlStr = host.path.startsWith('mongodb')
      ? host.path
      : `mongodb://${host.path}`;
    const url = new URL(urlStr);
    let hostname = url.host && url.host.split(',').shift() || host.path;

    if (this._servers[hostname] instanceof Server) {
      // Already connected
      return;
    }

    try {
      const client = await MongoClient.connect(urlStr, {
        readPreference: ReadPreference.SECONDARY_PREFERRED,
      });
      const server = new Server(hostname, client);
      this._servers[hostname] = server;
      console.info(`[${hostname}] Connected to ${hostname}`);
      await this.checkAuth(hostname);
    } catch (err) {
      console.error(`Error while connecting to ${hostname}:`, err.code, err.message);
      this._servers[hostname] = err;
    }
  }

  private getServer(name: string) {
    const server = this._servers[name] || this._servers[`${name}:27017`];
    if (!server) {
      throw new Error('Server does not exist');
    }
    return server;
  }

  private async checkAuth(name: string) {
    const server = this.getServer(name);
    if (server instanceof Error) {
      return;
    }

    try {
      await server.toJson();
    } catch (err) {
      console.log(require('util').inspect(err, false, 20));
      if (err.code == 13 && err.codeName == "Unauthorized") {
        this._servers[name] = err;
      }
    }
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
    for (const [name, server] of Object.entries(this._servers)) {
      if (server instanceof Error) {
        servers.push({
          name: name,
          error: {
            code:    server.code,
            name:    server.name,
            message: server.message
          }
        });
      } else {
        const json = await server.toJson();
        servers.push(json);
      }
    }
    Utils.fieldSort(servers, "name");
    return servers;
  }

  async getDatabasesJson(serverName: string): Promise<DatabaseJSON[]> {
    const server = this.getServer(serverName);
    if (server instanceof Error) {
      return [];
    }

    const json = await server.toJson();
    return json.databases;
  }

  async getCollectionsJson(serverName: string, databaseName: string): Promise<CollectionJSON[]> {
    const server = this.getServer(serverName);
    if (server instanceof Error) {
      return [];
    }
    const database = await server.database(databaseName);
    if (!database) {
      return [];
    }

    const json = await database.toJson();
    return json.collections;
  }

  async getCollection(serverName: string, databaseName: string, collectionName: string): Promise<Collection | undefined> {
    const server = this.getServer(serverName);
    if (server instanceof Error) { return; }

    const database = await server.database(databaseName);
    if (!database) { return; }

    const collection = await database.collection(collectionName);
    return collection;
  }
}
