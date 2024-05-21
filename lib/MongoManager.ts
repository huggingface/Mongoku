import { URL } from 'url';
import { MongoClient, MongoError } from 'mongodb';
import fetch from 'node-fetch';

import factory from '../lib/Factory';

import { Host } from './HostsManager';
import { Server, ServerJSON, ServerErrorJSON } from './Server';
import { DatabaseJSON, type CollectionRefs, type DbRefs } from './Database';
import { Collection, CollectionJSON } from './Collection';
import { Utils } from './Utils';

export type Servers = (ServerJSON | ServerErrorJSON)[]

export class MongoManager {
  private _pollItv?: NodeJS.Timeout;

  private _servers: {
    [name: string]: Server | MongoError;
  } = {};

  private _serverToTypes: {
    [hostname: string]: {
      [dbName: string]: DbRefs;
    }
  } = {};

  private async connect(host: Host) {
    let { hostname, url } = this.parseHost(host);
    if (this._servers[hostname] instanceof Server) {
      // Already connected
      return;
    }

    try {
      const client = new MongoClient(url);
      await client.connect();
      const server = new Server(hostname, client);
      this._servers[hostname] = server;
      console.info(`[${hostname}] Connected to ${hostname}`);
      await this.checkAuth(hostname);
    } catch (err) {
      console.error(`Error while connecting to ${hostname}:`, err.code, err.message);
      this._servers[hostname] = err;
    }

    await this.getServerTypes(host);
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

  private parseHost(host: Host): { hostname: string; url: string; } {
    const urlStr = host.path.startsWith('mongodb')
      ? host.path
      : `mongodb://${host.path}`;
    const url = new URL(urlStr);

    return { hostname: url.host || host.path, url: urlStr };
  }

  private async getServerTypes(host: Host, hostname = this.parseHost(host).hostname) {
    if (host.typesUrl) {
      try {
        const res = await (await fetch(host.typesUrl)).json();
        if (isDatabaseTypes(res)) {
          this._serverToTypes[hostname] = res;
        } else {
          console.error("Invalid data: the received object doesn't match the expected schema");
        }

        if (!this._pollItv) {
          this.startPolling();
        }
      } catch (error) {
        console.error(error);
      }
    }
  }

  private startPolling() {
    this.stopPolling();
    this._pollItv = setInterval(
      async () => {
        try {
          const hosts = await factory.hostsManager.getHosts();
          for (const host of hosts) {
            await this.getServerTypes(host);
          }
        } catch (err) {
          console.error(err);
        }
      },
      5 * 60 * 1_000
    );
    /// every 5 minutes.
  }

  private stopPolling(): void {
    if (this._pollItv) {
      clearInterval(this._pollItv);
    }
  }

  async load() {
    const hosts = await factory.hostsManager.getHosts();
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

    const collection = database.collection(collectionName);
    return collection;
  }

  getCollectionRefs(serverName: string, databaseName: string, collectionName: string): CollectionRefs {
    return this._serverToTypes[serverName]?.[databaseName]?.[collectionName] ?? {};
  }
}

function isDatabaseTypes(obj: unknown): obj is { [dbName: string]: DbRefs; } {
  return isDict(obj) &&
    Object.values(obj).every(dbColls => isDict(dbColls) &&
      Object.values(dbColls).every(collRefs => isDict(collRefs) &&
        Object.values(collRefs).every(propValue => Array.isArray(propValue) &&
          propValue.every(ref => isDict(ref) &&
            'collection' in ref && typeof ref.collection === 'string' &&
            'key' in ref && typeof ref.key === 'string'))));
}

function isDict(arg: unknown): arg is Record<string, unknown> {
  if (arg === undefined || arg === null) {
    return false;
  }

  return Object.getPrototypeOf(arg) === Object.prototype;
}
