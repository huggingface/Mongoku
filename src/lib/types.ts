export interface MongoDocument {
	_id?: {
		$type: string;
		$value: string;
	};
	[key: string]: unknown;
}

export interface SearchParams {
	query: string;
	sort: string;
	project: string;
	limit: number;
	skip: number;
}

/**
 * Database stats as returned by the db.stats() method
 *
 * Type not exposed by MongoDB
 */
export interface DatabaseStats {
	db: string;
	collections: number;
	views: number;
	objects: number;
	avgObjSize: number;
	dataSize: number;
	storageSize: number;
	indexes: number;
	indexSize: number;
	totalSize: number;
	fsUsedSize: number;
	fsTotalSize: number;
	ok: number;
}

export interface CollectionJSON {
	name: string;
	size: number;
	dataSize: number;
	count: number;
	avgObjSize: number;
	storageSize: number;
	capped: boolean;
	nIndexes: number;
	totalIndexSize: number;
	indexSizes: {
		[name: string]: number;
	};
	indexes: Array<{
		name: string;
		key?: Record<string, number>;
		size: number;
	}>;
}

/**
 * A single mapping target - defines which collection and field to lookup
 */
export interface MappingTarget {
	collection: string;
	on: string;
}

/**
 * Collection mappings document structure as stored in mongoku.mappings
 */
export interface CollectionMappings {
	_id: string; // collection name
	mappings: Record<string, MappingTarget | MappingTarget[]>;
}
