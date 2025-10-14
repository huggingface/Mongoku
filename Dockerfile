FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /app
WORKDIR /app

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm build

FROM base
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/build /app/build

# See also other MONGOKU_SERVER_ env vars, in README.md. Like MONGOKU_SERVER_ORIGIN, or reverse-proxy-related vars.
# See https://svelte.dev/docs/kit/adapter-node#environment-variables-port-and-host
ENV MONGOKU_SERVER_PORT=3100

EXPOSE 3100

LABEL description="MongoDB client for the web. Query your data directly from your browser. You can host it locally, or anywhere else, for you and your team."

CMD ["node", "build"]
