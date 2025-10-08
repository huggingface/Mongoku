import { MongoManager } from "./MongoManager";
import { HostsManager } from "./HostsManager";

class Factory {
	private get _initializedError() {
		return new Error("Factory.load() must be called first");
	}

	private _mongoManager!: MongoManager;
	private _hostsManager!: HostsManager;

	get mongoManager() {
		if (!this._mongoManager) {
			throw this._initializedError;
		}
		return this._mongoManager;
	}

	get hostsManager() {
		if (!this._hostsManager) {
			throw this._initializedError;
		}
		return this._hostsManager;
	}

	async load() {
		// Start by initializing the host manager (needed for mongo manager)
		this._hostsManager = new HostsManager();
		await this._hostsManager.load();

		// Then we can initialize the mongo manager
		this._mongoManager = new MongoManager();
		await this._mongoManager.load();
	}
}

const factory = new Factory();
export default factory;
