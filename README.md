# Mongoku

[![CI](https://github.com/huggingface/Mongoku/actions/workflows/ci.yml/badge.svg)](https://github.com/huggingface/Mongoku/actions/workflows/ci.yml)

MongoDB client for the web. Query your data directly from your browser. You can host it locally,
or anywhere else, for you and your team.

It scales with your data (at Hugging Face we use it on a 1TB+ cluster) and is blazing fast for all
operations, including sort/skip/limit. Built on TypeScript/Node.js/SvelteKit.

### Demo

![mongoku](https://huggingface.co/landing/assets/mongoku/mongoku-demo.gif)

## Installation & Usage

### Install Globally

This is the easiest way to use Mongoku:

```bash
# Install globally
npm install -g mongoku

# Start the server
mongoku
mongoku start

# Start with PM2
mongoku --pm2
# Start on a custom port
mongoku --port 8080
# Start in read-only mode
mongoku --readonly

# Stop the server with pm2
mongoku stop
```

## Local Development

### Prerequisites

- Node.js 20+
- pnpm (will be auto-installed if using the `packageManager` field)

### Setup & Run

```bash
# Install dependencies
pnpm install

# Start development server (runs on port 3100)
pnpm dev
```

### Docker

<!-- #### Using the Docker HUB image

```bash
docker run -d --name mongoku -p 3100:3100 huggingface/mongoku

# Run with customized default hosts
docker run -d --name mongoku -p 3100:3100 \
  --env MONGOKU_DEFAULT_HOST="mongodb://user:password@myhost.com:8888" \
  huggingface/mongoku
```
-->

#### Build your own image

If you want to build your own docker image, just clone this repository and run the following:

```bash
# Build
docker build -t yournamehere/mongoku .

# Run
docker run -d --name mongoku -p 3100:3100 yournamehere/mongoku
```

## Configuration

You can configure Mongoku using environment variables:

```bash
# Use customized default hosts (Default = localhost:27017)
MONGOKU_DEFAULT_HOST="mongodb://user:password@localhost:27017"

# See https://svelte.dev/docs/kit/adapter-node#environment-variables-port-and-host
MONGOKU_SERVER_PORT=8000
MONGOKU_SERVER_ORIGIN=https://mongoku.example.com
MONGOKU_SERVER_HOST=127.0.0.1
MONGOKU_SERVER_PROTOCOL_HEADER=x-forwarded-proto
MONGOKU_SERVER_HOST_HEADER=x-forwarded-host
MONGOKU_SERVER_ADDRESS_HEADER=X-Forwarded-For
MONGOKU_SERVER_XFF_DEPTH=1
MONGOKU_SERVER_SHUTDOWN_TIMEOUT=30
MONGOKU_SERVER_SOCKET_PATH=/tmp/socket

# Use a specific file to store hosts (Default = $HOME/.mongoku.db)
MONGOKU_DATABASE_FILE="/tmp/mongoku.db"

# Timeout before falling back to estimated documents count in ms (Default = 5000)
MONGOKU_COUNT_TIMEOUT=1000

# Read-only mode (prevent write queries to mongodb)
MONGOKU_READ_ONLY_MODE=true
```

## License

MIT
