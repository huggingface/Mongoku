import * as async from 'async';

import { MongoManager } from './MongoManager';

class Factory {
	private _initialized = false;

	private get _initializedError() {
		return new Error("Factory.load() must be called first");
	}

	private _mongoManager: MongoManager;
	
	get mongoManager() {
		if (!this._initialized) {
			throw this._initializedError;
		}
		return this._mongoManager;
	}

	load(__callback: (err) => void) {
		async.parallel([
			// MongoManager
			(__callback) => {
				this._mongoManager = new MongoManager();
				this._mongoManager.load()
					.then(() => __callback())
					.catch((err) => __callback(err));
			}
		], (err) => {
			this._initialized = true;
			return __callback(err);
		});
	}
}

const factory = new Factory();
export default factory;
