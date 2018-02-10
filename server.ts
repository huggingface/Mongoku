import * as path from 'path';
import * as fs from 'fs';

import * as express from 'express';
const app = express()

app.get('/app', (req, res, next) => {
	res.sendFile("app/index.html", { root: __dirname }, (err) => {
		if (err) {
			return next(err);
		}
	})
})
app.get('/app/*', (req, res, next) => {
	const ext = path.extname(req.url);

	fs.stat(path.join(__dirname, req.url), (err, stats) => {
		let file = "app/index.html";
		if (stats && stats.isFile()) {
			file = req.url;
		}
		
		res.sendFile(file, { root: __dirname }, (err) => {
			if (err) {
				return next(err);
			}
		});
	})
});

app.get('*', (req, res, next) => {
	return res.redirect('/app');
});

app.listen(3000, () => console.log('Example app listening on port 3000!'))