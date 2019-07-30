import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as util from 'util';
import * as Nedb from 'nedb';

export interface Host {
  path: string
}

const DEFAULT_HOSTS = process.env.MONGOKU_DEFAULT_HOST ? process.env.MONGOKU_DEFAULT_HOST.split(';') : ['localhost:27017'];
const DATABASE_FILE = process.env.MONGOKU_DATABASE_FILE || path.join(os.homedir(), '.mongoku.db');


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
      await Promise.all(DEFAULT_HOSTS.map(async hostname => {
        const insert: any = this.promise(this._db.insert);
        return await insert({
          path: hostname
        });
      }));
    }
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
    return new Promise<void>((resolve, reject) => {
      this._db.update({
        path: path
      }, {
        $set: {
          path: path
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
    return new Promise<void>((resolve, reject) => {
      this._db.remove({
        path: new RegExp(`${path}`)
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
