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