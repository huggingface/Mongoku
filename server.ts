import * as path from 'path';
import * as fs from 'fs';
import http from 'http';

import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import MemoryStore from 'memorystore';
import {json as jsonBodyParser} from 'body-parser';

import factory from './lib/Factory';
import { api } from './routes/api';

declare module 'express-session' {
  interface SessionData {
    signedUser: string;
  }
}

const app = express();
const DISABLE_AUTH = process.env.MONGOKU_DISABLE_AUTH == 'true';

const setupServer = () => {
  const SERVER_PORT = process.env.MONGOKU_SERVER_PORT || 3100;
  const AUTH_ENDPOINT = process.env.MONGOKU_AUTH_ENDPOINT || 'http://localhost/auth';
  const EXT_SESSION_COOKIE = process.env.MONGOKU_EXT_SESSION_COOKIE;
  const EXT_SESSION_ENDPOINT = process.env.MONGOKU_EXT_SESSION_ENDPOINT;

  app.use(cookieParser());
  app.use(session({
    name: 'mongoku.sid',
    cookie: { maxAge: 2*60*60*1000 },
    store: new (MemoryStore(session as any))({
      checkPeriod: 2*60*60*1000 // prune expired entries every 2h
    }),
    resave: false,
    secret: process.env.MONGOKU_SESSION_SECRET || 'keyboard cat',
    saveUninitialized: false
  }));

  app.get('/', (req, res, next) => {
    res.sendFile("app/index.html", { root: __dirname }, (err) => {
      if (err) {
        return next(err);
      }
    });
  });

  app.post('/signin', jsonBodyParser(), (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return void res.status(400).send('username and password expected');
    }

    const data = JSON.stringify({ login: username, passwd: password });
    const headers = {
      accept: 'application/json',
      'accept-language': 'en-US,en;q=0.9,ru;q=0.8',
      'content-type': 'application/json',
      'content-length': data.length,
    };

    const httpReq = http.request(AUTH_ENDPOINT, { headers, method: 'POST' }, (httpRes) => {
      if (httpRes.statusCode === 200) {
        res.set('set-cookie', httpRes.headers['set-cookie']);
        req.session.signedUser = username;
        res.json({ ok: true, message: 'signed in as ' + username });
      } else {
        let message = '';
        httpRes.on('data', (chunk) => message += chunk);
        httpRes.on('end', () => res.status(httpRes.statusCode || 401)
          .json({ ok: false, message }));
      }
    });
    httpReq.on('error', (error) => res.status(500).send(error));
    httpReq.write(data);
    httpReq.end();
  });

  app.post('/signout', (req, res) => {
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Origin', req.headers.origin);
    res.set('Access-Control-Allow-Credentials', 'true');
    const { signedUser } = req.session;
    if (signedUser)
      req.session.signedUser = undefined;
    res.json({
      ok: true,
      message: signedUser ? 'successfully signed out' : 'was not signed in',
    });
  });

  if (EXT_SESSION_COOKIE && EXT_SESSION_ENDPOINT) {
    app.use('/api', (req, res, next) => {
      if (req.session.signedUser || DISABLE_AUTH)
        return void next();
      const externalSession = req.cookies[EXT_SESSION_COOKIE];
      if (!externalSession)
        return void next();
      const withCookie = {
        accept: 'application/json',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
        cookie: `${EXT_SESSION_COOKIE}=${externalSession}`,
      };
      const httpReq = http.request(EXT_SESSION_ENDPOINT, {headers: withCookie}, (httpRes) => {
        if (httpRes.statusCode != 200)
          return void next();
        let bodyString = '';
        httpRes.on('data', (chunk) => bodyString += chunk);
        httpRes.on('end', () => {
          try {
            const body = JSON.parse(bodyString);
            if (body.login)
              req.session.signedUser = body.login;
          } catch(e){}
          next();
        });
      });
      httpReq.on('error', error => { next() });
      httpReq.end();
    });
  }

  app.use('/api', (req, res, next) => {
    if (req.session.signedUser || DISABLE_AUTH)
      return next();
    res.status(401).send('401 Unauthorized');
  }, api);

  app.get('/*', (req, res, next) => {
    const ext = path.extname(req.url);

    fs.stat(path.join(__dirname, "app", req.url), (err, stats) => {
      let file = "index.html";
      if (stats && stats.isFile()) {
        file = req.url;
      }

      res.sendFile(file, { root: path.join(__dirname, "app") }, (err) => {
        if (err) {
          return next(err);
        }
      });
    });
  });

  app.use((err: Error, req: express.Request, res: express.Response, next) => {
    res.status(500);

    return res.json({
      ok: false,
      message: err.message
    });
  });

  app.listen(SERVER_PORT, () => console.log(`[Mongoku] listening on port ${SERVER_PORT}`));
}

export const start = async () => {
  console.log(`[Mongoku] Starting...`);
  try {
    await factory.load();
    setupServer();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

if (require.main === module) {
  (async () => {
    await start();
  })();
}
