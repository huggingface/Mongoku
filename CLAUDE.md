# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Mongoku is a web-based MongoDB client (query/administer databases from the browser). It is a SvelteKit app (Svelte 5) served by `@sveltejs/adapter-node`, plus a small `commander` CLI (`cli.ts`) published as the `mongoku` bin. Package manager is **pnpm**.

## Commands

```bash
pnpm dev              # dev server on port 3100
pnpm build            # vite build + compile cli.ts -> dist/ (+ postbuild)
pnpm build:app        # SvelteKit build only (-> build/)
pnpm build:cli        # compile cli.ts only
pnpm start            # node build  (run a production build)

pnpm test             # vitest run (all tests)
pnpm test:watch       # vitest watch
vitest run src/tests/api/aggregation.test.ts   # run a single test file
vitest run -t "name"                            # run tests matching a name

pnpm check            # svelte-check type checking (run after svelte-kit sync)
pnpm lint             # eslint
pnpm lint:fix         # eslint --fix
pnpm format           # prettier --write .
pnpm format:check     # prettier --check .
```

CI (`.github/workflows/ci.yml`) runs, in order: `format:check`, `lint`, `check`, `test`, `build:app`, `build:cli` on Node 22. Match all of these before considering work done. A `pre-commit` hook (simple-git-hooks + lint-staged) runs eslint/prettier on staged files; enable with `npx simple-git-hooks`.

## Architecture

### Client/server boundary: SvelteKit remote functions
This app uses SvelteKit's **experimental remote functions** (`kit.experimental.remoteFunctions` in `svelte.config.js`). All client→server RPC lives in `src/api/servers.remote.ts`, imported in components via the `$api` alias (e.g. `import { dropCollection } from "$api/servers.remote"`). Each export is a `query(...)` (read) or `command(...)` (write) from `$app/server`, with a **Zod schema** validating input. When adding server-callable logic, add a `query`/`command` here rather than a new endpoint. Page-load-time reads use conventional `+page.server.ts` `load` functions (see the deeply-nested `routes/servers/[server]/databases/[database]/collections/[collection]/...` tree).

### MongoDB connection layer (`src/lib/server/mongo.ts`)
- `getMongo()` returns a lazily-initialized **singleton** `MongoConnections` (guarded by an init promise). Everything server-side goes through it.
- `MongoConnections` holds a `Map` of `MongoClientWithMappings` (one per configured host), keyed by an internal `_id`. `MongoClientWithMappings` extends the driver's `MongoClient` and adds cached `getMappings`, `getIndexes`, `hasIndexOnField`.
- Host list is persisted by `HostsManager` to a newline-delimited JSON file at `$HOME/.mongoku.db` (override with `MONGOKU_DATABASE_FILE`). Defaults come from `MONGOKU_DEFAULT_HOST` (`;`-separated) or `localhost:27017`.
- Sharding/replica-set/index-stats features connect to specific nodes and honor `MONGOKU_READ_PREFERENCE` (+ `MONGOKU_READ_PREFERENCE_TAGS`).

### BSON wire format: `JsonEncoder` (`src/lib/server/JsonEncoder.ts`)
BSON does not survive JSON transport, so all documents crossing the boundary are wrapped: `ObjectId`, `Date`, `RegExp`, `Binary`, `Decimal128`, etc. become `{ $type, $value, ... }`. **Always `JsonEncoder.encode(...)` documents before returning them to the client and `JsonEncoder.decode(...)` values received from the client** (see `updateDocument`/`insertDocument` in `servers.remote.ts`). Query/sort/projection JSON from the UI is parsed with `parseJSON` from `src/lib/utils/jsonParser.ts` (extended JSON: supports `ObjectId(...)`, etc.), not `JSON.parse`.

### Auth & request context (`src/hooks.server.ts`)
The `handle` hook enforces auth before routing: **OAuth2 PKCE** (when `MONGOKU_OAUTH_CLIENT_ID` is set; logic in `src/lib/server/oauth.ts`, routes under `src/routes/auth/`) or HTTP **basic auth** (`MONGOKU_AUTH_BASIC`). App state (DB connections) is shared across all authenticated users. Every request is wrapped in `contextStore` — an `AsyncLocalStorage<RequestEvent>` (`src/lib/server/contextStore.ts`) — so server code can access the current request; the logger uses it for per-request IDs.

### Read-only mode
`MONGOKU_READ_ONLY_MODE=true` (or `mongoku --readonly`) blocks all writes. Write `command`s call `checkReadOnly()` which throws `error(403, ...)`. Any new mutating command must call it. The flag is surfaced to the UI via `+layout.server.ts` (`readOnly`).

## Conventions

- **No `console.*`** — eslint enforces `no-console: error`. Use the logger in `src/lib/server/logger.ts`. Exceptions (allowed console): `cli.ts`, `logger.ts`, `*.svelte`, `scripts/**`.
- **Log sanitized connection strings only.** Credentials must never be logged — use `sanitizeMongoUri`/`sanitizeMongoUrl` (`src/lib/server/connectionString.ts`) before logging any URI, as existing commands do.
- Prettier: **tabs**, width 120, double quotes, trailing commas, semicolons. `curly: error` (always brace `if`/`for`).
- `$api` → `src/api`; standard SvelteKit `$lib` → `src/lib`. Server-only code lives in `src/lib/server/` (never import it into client code).
- The subpath the app is served under is set at **build time** via `BASE_PATH` env (baked into `svelte.config.js` `paths.base`); reference it in code as `base` from `$app/paths`.

## Editing Svelte code
`AGENTS.md` documents a Svelte MCP server available in this environment. When writing Svelte 5 code, prefer its tools: `list-sections` + `get-documentation` for docs, and run `svelte-autofixer` on any Svelte code until it reports no issues.

## Configuration
Runtime behavior is driven by `MONGOKU_*` environment variables (default hosts, excluded DBs, query/count timeouts, read preference, read-only, auth, server port/origin). The full list with descriptions is in `README.md` — consult it before adding a new config knob.
