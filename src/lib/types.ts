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
	mode: "query" | "distinct" | "aggregation";
	field?: string;
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
 * Sharding information for a collection, gathered from the `config` database
 * and `$collStats`. All queries are read-only.
 */
export interface ShardingInfo {
	/** Whether the cluster is a sharded cluster (mongos) at all. */
	shardingEnabled: boolean;
	/** Whether this specific collection is sharded. */
	sharded: boolean;
	/** The shard key, e.g. { userId: 1, _id: "hashed" }. Null if unsharded. */
	shardKey: Record<string, 1 | -1 | string> | null;
	/** Whether the shard key uses hashed sharding. */
	hashed: boolean;
	/** Whether the collection uses unique shard key. */
	unique: boolean;
	/** Total number of chunks across all shards. */
	totalChunks: number;
	/** The list of all shards known to the cluster. */
	shards: Array<{
		shardId: string;
		host: string;
		/** Number of chunks for this collection on this shard. */
		chunks: number;
		/** Number of documents for this collection on this shard (from $collStats). */
		documents: number | null;
		/** Storage size in bytes for this collection on this shard. */
		size: number | null;
	}>;
	/** Whether balancing is currently enabled for the collection (noBalance flag). */
	balancerEnabled: boolean;
	/** Any non-fatal error/warning encountered while gathering info. */
	warning: string | null;
}

export const ALLOWED_AGGREGATION_STAGES = new Set([
	"$addFields",
	"$bucket",
	"$bucketAuto",
	"$collStats",
	"$count",
	"$densify",
	"$documents",
	"$facet",
	"$fill",
	"$geoNear",
	"$graphLookup",
	"$group",
	"$indexStats",
	"$limit",
	"$listClusterCatalog",
	"$listSampledQueries",
	"$listSearchIndexes",
	"$listSessions",
	"$lookup",
	"$match",
	"$project",
	"$querySettings",
	"$queryStats",
	"$rankFusion",
	"$redact",
	"$replaceRoot",
	"$replaceWith",
	"$sample",
	"$search",
	"$searchMeta",
	"$set",
	"$setWindowFields",
	"$skip",
	"$sort",
	"$sortByCount",
	"$unionWith",
	"$unset",
	"$unwind",
	"$vectorSearch",
]);

/**
 * A single mapping target - defines either a collection lookup or URL template
 */
export type MappingTarget =
	| {
			type: "document";
			collection: string;
			on: string;
	  }
	| {
			type: "url";
			template: string;
	  }
	// Legacy format (backwards compatibility) - treated as type: "document"
	| {
			collection: string;
			on: string;
	  };

export type Mappings = Record<string, MappingTarget[] | MappingTarget>;

/**
 * Collection mappings document structure as stored in mongoku.mappings
 */
export interface CollectionMappings {
	_id: string; // collection name
	mappings: Mappings;
}
