import type { CollectionMappings, MappingTarget } from "$lib/types";
import type { Collection, Db } from "mongodb";

/**
 * Manages collection mappings cached in memory.
 * Mappings are loaded lazily when a database is accessed.
 */
export class MappingsManager {
	// Cache structure: Map<server:database, Map<collectionName, mappings>>
	private cache: Map<string, Map<string, Record<string, MappingTarget | MappingTarget[]>>> = new Map();

	/**
	 * Get the cache key for a specific server/database combination
	 */
	private getCacheKey(server: string, database: string): string {
		return `${server}:${database}`;
	}

	/**
	 * Load mappings from the mongoku.mappings collection into cache
	 */
	async loadMappings(server: string, database: string, db: Db): Promise<void> {
		const cacheKey = this.getCacheKey(server, database);

		try {
			// Check if mongoku.mappings collection exists
			const collections = await db.listCollections({ name: "mongoku.mappings" }).toArray();

			if (collections.length === 0) {
				// Collection doesn't exist, initialize empty cache
				this.cache.set(cacheKey, new Map());
				return;
			}

			const mappingsCollection: Collection = db.collection("mongoku.mappings");
			const mappingsDocs = await mappingsCollection.find<CollectionMappings>({}).toArray();

			const mappingsMap = new Map<string, Record<string, MappingTarget | MappingTarget[]>>();

			for (const doc of mappingsDocs) {
				if (doc._id && doc.mappings) {
					mappingsMap.set(doc._id, doc.mappings);
				}
			}

			this.cache.set(cacheKey, mappingsMap);
		} catch (error) {
			console.error(`Failed to load mappings for ${cacheKey}:`, error);
			// Initialize empty cache on error
			this.cache.set(cacheKey, new Map());
		}
	}

	/**
	 * Get mappings for a specific collection.
	 * Loads from database if not yet cached.
	 */
	async getMappings(
		server: string,
		database: string,
		collection: string,
		db: Db,
	): Promise<Record<string, MappingTarget | MappingTarget[]> | null> {
		const cacheKey = this.getCacheKey(server, database);

		// Load mappings if not yet cached
		if (!this.cache.has(cacheKey)) {
			await this.loadMappings(server, database, db);
		}

		const databaseMappings = this.cache.get(cacheKey);
		return databaseMappings?.get(collection) || null;
	}

	/**
	 * Get all mappings for a database.
	 * Loads from database if not yet cached.
	 */
	async getAllMappings(
		server: string,
		database: string,
		db: Db,
	): Promise<Map<string, Record<string, MappingTarget | MappingTarget[]>>> {
		const cacheKey = this.getCacheKey(server, database);

		// Load mappings if not yet cached
		if (!this.cache.has(cacheKey)) {
			await this.loadMappings(server, database, db);
		}

		return this.cache.get(cacheKey) || new Map();
	}

	/**
	 * Refresh mappings from database (reload into cache)
	 */
	async refreshMappings(server: string, database: string, db: Db): Promise<void> {
		const cacheKey = this.getCacheKey(server, database);
		// Clear cache for this database
		this.cache.delete(cacheKey);
		// Reload
		await this.loadMappings(server, database, db);
	}

	/**
	 * Clear all cached mappings (useful for testing)
	 */
	clearCache(): void {
		this.cache.clear();
	}
}
