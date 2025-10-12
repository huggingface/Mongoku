FROM node:24-alpine
# Install pnpm
RUN npm install -g pnpm@10.11.0

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the app
RUN pnpm build

# See also other MONGOKU_SERVER_ env vars, in README.md. Like MONGOKU_SERVER_ORIGIN, or reverse-proxy-related vars.
# See https://svelte.dev/docs/kit/adapter-node#environment-variables-port-and-host
ENV MONGOKU_SERVER_PORT=3100

# Expose port
EXPOSE 3100

LABEL description="MongoDB client for the web. Query your data directly from your browser. You can host it locally, or anywhere else, for you and your team."

# Start the app
CMD ["node", "build"]
