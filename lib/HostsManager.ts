import * as fs from 'fs';
import * as util from 'util';
import * as Nedb from 'nedb';

export interface Host {
  path: string
}

const DEFAULT_HOST = 'localhost:27017';
const DATABASE_FILE = 'hosts.db';

export class HostsManager {
  private _db: Nedb;

  private promise(fn: any) {
    return util.promisify(fn.bind(this._db));
  }

  async load() {
    let first = false;
    try {
      await fs.promises.stat(DATABASE_FILE);
    } catch (err) {
      first = true;
    }

    this._db = new Nedb({
      filename: DATABASE_FILE
    });

    const load = this.promise(this._db.loadDatabase);
    await load();

    if (first) {
      const insert: any = this.promise(this._db.insert);
      await insert({
        path: DEFAULT_HOST
      });
    }
  }

  private validateHost(path: string): Host {
    const r = /^(mongodb:(?:\/{2})?)?((\w+?):(\w+?)@|:?@?)([\w\.]+?):(\d+)(\/(\w+?))?$/;
    if (!r.exec(path)) {
      throw new Error("Malformed URI");
    }

    return {
      path: (path.startsWith('mongodb://'))
        ? path.slice('mongodb://'.length)
        : path
    };
  }

  getHosts(): Promise<Host[]> {
    return new Promise<Host[]>((resolve, reject) => {
      this._db.find({}, (err: Error, hosts: Host[]) => {
        if (err) {
          return reject(err);
        }
        else {
          return resolve(hosts);
        }
      });
    });
  }

  async add(path: string): Promise<void> {
    const host = this.validateHost(path);

    return new Promise<void>((resolve, reject) => {
      this._db.update({
        path: host.path
      }, {
        $set: {
          path: host.path
        }
      }, { upsert : true }, (err: Error) => {
        if (err) {
          return reject(err);
        } else {
          return resolve();
        }
      });
    });
  }

  async remove(path: string): Promise<void> {
    const host = this.validateHost(path);

    return new Promise<void>((resolve, reject) => {
      this._db.remove({
        path: host.path
      }, (err: Error) => {
        if (err) {
          return reject(err);
        } else {
          return resolve();
        }
      });
    });
  }
}
