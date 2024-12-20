import * as express from 'express';
import * as bodyParser from 'body-parser';

import factory from '../lib/Factory';
import { writeEnabled } from '../lib/ReadOnlyMiddleware';

export const api = express.Router();

// get readOnly
api.get('/readonly', async (req, res, next) => {
  return res.json({
    ok: true,
    readOnly: (process.env.MONGOKU_READ_ONLY_MODE === 'true'),
  });
});

// Get servers
api.get('/servers', async (req, res, next) => {
  const servers = await factory.mongoManager.getServersJson();
  return res.json(servers);
});

api.put('/servers', bodyParser.json(), async (req, res, next) => {
  try {
    await factory.hostsManager.add(req.body.url);
    await factory.mongoManager.load();
  } catch (err) {
    return next(err);
  }

  return res.json({
    ok: true
  });
});

api.delete('/servers/:server', async (req, res, next) => {
  try {
    await factory.hostsManager.remove(req.params.server);
    factory.mongoManager.removeServer(req.params.server);
  } catch (err) {
    return next(err);
  }

  return res.json({
    ok: true
  });
});

api.get('/servers/:server/databases', async (req, res, next) => {
  const server = req.params.server;

  try {
    const databases = await factory.mongoManager.getDatabasesJson(server);
    return res.json(databases);
  } catch (err) {
    return next(err);
  }
});

api.get('/servers/:server/databases/:database/collections', async (req, res, next) => {
  const server   = req.params.server;
  const database = req.params.database;

  try {
    const collections = await factory.mongoManager.getCollectionsJson(server, database);
    return res.json(collections);
  } catch (err) {
    return next(err);
  }
});

api.get('/servers/:server/databases/:database/collections/:collection/documents/:document(*)',
  async (req, res, next) => {
  const server     = req.params.server;
  const database   = req.params.database;
  const collection = req.params.collection;
  const document   = req.params.document;

  try {
    const c = await factory.mongoManager.getCollection(server, database, collection);
    if (!c) {
      return next(new Error(`Collection not found: ${server}.${database}.${collection}`));
    }

    const doc = await c.findOne(document);
    if (!doc) {
      return next(new Error("This document does not exist"));
    }

    return res.json({
      ok:       true,
      document: doc
    });
  } catch (err) {
    return next(err);
  }
});

api.post('/servers/:server/databases/:database/collections/:collection/documents/:document',
  writeEnabled, bodyParser.json({limit: '20mb'}), async (req, res, next) => {
  const server     = req.params.server;
  const database   = req.params.database;
  const collection = req.params.collection;
  const document   = req.params.document;
  const partial    = req.query.partial === 'true';

  try {
    const c = await factory.mongoManager.getCollection(server, database, collection);
    if (!c) {
      return next(new Error(`Collection not found: ${server}.${database}.${collection}`));
    }
    const update = await c.updateOne(document, req.body, partial);

    return res.json({
      ok:     true,
      update: update
    });
  } catch (err) {
    return next(err);
  }
})

api.delete('/servers/:server/databases/:database/collections/:collection/documents/:document',
  writeEnabled, async (req, res, next) => {
  const server     = req.params.server;
  const database   = req.params.database;
  const collection = req.params.collection;
  const document   = req.params.document;

  try {
    const c = await factory.mongoManager.getCollection(server, database, collection);
    if (!c) {
      return next(new Error(`Collection not found: ${server}.${database}.${collection}`));
    }

    await c.removeOne(document);

    return res.json({
      ok: true
    });
  } catch (err) {
    return next(err);
  }
});

api.put('/servers/:server/databases/:database/collections/:collection/new',
  bodyParser.json({limit: '20mb'}), async (req, res, next) => {
  const server     = req.params.server;
  const database   = req.params.database;
  const collection = req.params.collection;

  const c = await factory.mongoManager.getCollection(server, database, collection);
  if (!c) {
    return next(new Error(`Collection not found: ${server}.${database}.${collection}`)); }

  try {
    if (!req.body) {
      throw new Error('No data to insert'); }

    const insert = await c.insert(req.body);

    return res.json({
      ok:  true,
      insert,
    });
  } catch (err) {
    return next(err);
  }
});

api.get('/servers/:server/databases/:database/collections/:collection/query', async (req, res, next) => {
  const server     = req.params.server;
  const database   = req.params.database;
  const collection = req.params.collection;

  let query = req.query.q;
  if (typeof query !== "object") {
    try {
      query = JSON.parse(query||'');
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

  let project = req.query.project || "";
  if (project && typeof project !== "object") {
    try {
      project = JSON.parse(project);
    } catch (err) {
      return next(new Error(`Invalid project: ${project}`));
    }
  }

  const limit = parseInt(String(req.query.limit), 10) || 20;
  const skip  = parseInt(String(req.query.skip), 10) || 0;

  let c;
  try {
    c = await factory.mongoManager.getCollection(server, database, collection);
  } catch(err) {}
  if (!c) {
    return next(new Error(`Collection not found: ${server}.${database}.${collection}`));
  }

  try {
    const results = await c.find(query, project, sort, limit, skip);

    return res.json({
      ok:      true,
      results: results
    });
  } catch(err) {
    return next(err);
  }
});

api.get('/servers/:server/databases/:database/collections/:collection/count', async (req, res, next) => {
  const server     = req.params.server;
  const database   = req.params.database;
  const collection = req.params.collection;

  let query = req.query.q;
  if (typeof query !== "object") {
    try {
      query = JSON.parse(query||'');
    } catch (err) {
      return next(new Error(`Invalid query: ${query}`));
    }
  }

  let c;
  try {
    c = await factory.mongoManager.getCollection(server, database, collection);
  } catch(err) {}
  if (!c) {
    return next(new Error(`Collection not found: ${server}.${database}.${collection}`));
  }

  try {
    const count = await c.count(query);

    return res.json({
      ok:    true,
      count: count
    });
  } catch (err) {
    return next(err);
  }
});
