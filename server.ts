import * as path from 'path';
import * as fs from 'fs';

import * as express from 'express';
const app = express()

import factory from './lib/Factory';
import { api } from './routes/api';

const setupServer = () => {
	app.get('/', (req, res, next) => {
		res.sendFile("app/index.html", { root: __dirname }, (err) => {
			if (err) {
				return next(err);
			}
		});
	});

	app.use('/api', api);

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
			ok:      false,
			message: err.message
		});
	})

	app.listen(3100, () => console.log(`[Mongoku] listening on port 3100`));
}

(async () => {
	try {
		await factory.load();
		setupServer();
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
})();
