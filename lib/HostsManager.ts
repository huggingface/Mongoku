import * as Nedb from 'nedb';

export interface Host {
	path: string
}

export class HostsManager {
	private _db: Nedb = new Nedb({
		filename: 'hosts.db'
	});
	private _hosts: Host[] = [];
	
	constructor() {
		this._db.loadDatabase((err) => {
			if (err) {
				console.error(`Error while loading hosts.db:`, err);
				process.exit(1);
			}
		});
	}
	
	getHosts(): Promise<Host[]> {
		return new Promise<Host[]>((resolve, reject) => {
			this._db.find({}, (err, hosts) => {
				if (err) {
					return reject(err);
				}
				else {
					return resolve(hosts);
				}
			})
		})
	}
}