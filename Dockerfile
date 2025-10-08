FROM node:24-alpine


ENV UID=991 GID=991

ENV MONGOKU_DEFAULT_HOST="mongodb://localhost:27017"
ENV MONGOKU_SERVER_PORT=3100
ENV MONGOKU_DATABASE_FILE="/tmp/mongoku.db"
ENV MONGOKU_COUNT_TIMEOUT=5000
ARG READ_ONLY=false
ENV MONGOKU_READ_ONLY_MODE=$READ_ONLY

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

# Expose port
EXPOSE 3100

LABEL description="MongoDB client for the web. Query your data directly from your browser. You can host it locally, or anywhere else, for you and your team."

# Start the app
CMD ["node", "build"]
