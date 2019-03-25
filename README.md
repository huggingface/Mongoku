# Mongoku

MongoDB client for the web. Query your data directly from your browser.

### Install & Run

This is the easy and recommended way of installing and running Mongoku.

```
# Install
npm install mongoku

# Run from your current terminal
mongoku start
```

You can also run Mongoku as a daemon, using either [PM2](https://github.com/Unitech/pm2) or
[Forever](https://github.com/foreverjs/forever)

```
mongoku start --pm2
# or
mongoku start --forever
```

### Manual Build

If you want to manually build and run mongoku, just clone this repository and run the following:

```bash
# Install the angular cli if you don't have it already
npm install -g typescript @angular/cli

# Build the front
cd app
npm install
ng build

# And the back
cd ..
npm install
tsc

# Run
node dist/server.js
```
