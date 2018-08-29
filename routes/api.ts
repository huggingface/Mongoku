import * as express from 'express';

import factory from '../lib/Factory';

export const api = express.Router();

// Get servers
api.get('/servers', async (req, res, next) => {
	const servers = await factory.mongoManager.getServersJson();
	return res.json(servers);
});

api.get('/servers/:server/databases', async (req, res, next) => {
	const server = req.params.server;
	
	const databases = await factory.mongoManager.getDatabasesJson(server);
	return res.json(databases);
});

api.get('/servers/:server/databases/:database/collections', async (req, res, next) => {
	const server   = req.params.server;
	const database = req.params.database;
	
	const collections = await factory.mongoManager.getCollectionsJson(server, database);
	return res.json(collections);
});

api.get('/servers/:server/databases/:database/collections/:collection/query', async (req, res, next) => {
	const server     = req.params.server;
	const database   = req.params.database;
	const collection = req.params.collection;
	
	let query = req.query.q;
	if (typeof query !== "object") {
		try {
			query = JSON.parse(query);
		} catch (err) {
			return next(new Error(`Invalid query: ${query}`));
		}
	}
	let sort = req.query.sort || "{}";
	if (sort && typeof sort !== "object") {
		try {
			sort = JSON.parse(sort);
		} catch (err) {
			return next(new Error(`Invalid order: ${sort}`));
		}
	}
	let limit = parseInt(req.query.limit, 10);
	if (isNaN(limit)) { limit = 20; }
	let skip  = parseInt(req.query.skip, 10);
	if (isNaN(skip)) { skip = 0; }
	
	const c = await factory.mongoManager.getCollection(server, database, collection);
	if (!c) {
		return next(new Error(`Collection not found: ${server}.${database}.${collection}`));
	}
	
	const results = await c.find(query).limit(limit).skip(skip).sort(sort).toArray();
	
	return res.json({
		ok:      true,
		results: results
	});
});

api.get('/servers/:server/databases/:database/collections/:collection/count', async (req, res, next) => {
	const server     = req.params.server;
	const database   = req.params.database;
	const collection = req.params.collection;
	
	let query = req.query.q;
	if (typeof query !== "object") {
		try {
			query = JSON.parse(query);
		} catch (err) {
			return next(new Error(`Invalid query: ${query}`));
		}
	}
	
	const c = await factory.mongoManager.getCollection(server, database, collection);
	if (!c) {
		return next(new Error(`Collection not found: ${server}.${database}.${collection}`));
	}
	
	const count = await c.count(query);
	
	return res.json({
		ok:    true,
		count: count
	});
});