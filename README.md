# SyncSlate

SyncSlate is a production-minded MVP for real-time technical interviews. The
planned product combines collaborative code editing, a shared whiteboard, a
server-authoritative timer, problem context, presence, and session replay.

The repository currently provides the Milestone 0 foundation: a Next.js web
app, a Fastify API, shared Zod contracts, a Drizzle/PostgreSQL package, local
Supabase development, Vitest, Playwright, Prettier, ESLint, Turborepo, and CI.

## Prerequisites

- Node.js 24.x
- pnpm 11.x
- Docker Engine or Docker Desktop
- Git

The repository pins pnpm in `package.json`. If it is unavailable:

```bash
corepack enable
corepack prepare pnpm@11.18.0 --activate
```

## Local setup

Install dependencies from the repository root:

```bash
pnpm install --frozen-lockfile
```

Start the local Supabase services. The Supabase CLI uses Docker internally, so
this repository does not maintain a second Docker Compose database:

```bash
pnpm infra:up
pnpm infra:status
```

Create the ignored local environment files from their committed templates:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

The templates target the default local ports. Never commit `.env` files or
backend secrets. Only browser-safe values may use the `NEXT_PUBLIC_` prefix.

Start the web application and API together:

```bash
pnpm dev
```

Stop local Supabase when finished:

```bash
pnpm infra:down
```

## Local services

| Service           | URL                                                     |
| ----------------- | ------------------------------------------------------- |
| Web               | http://localhost:3000                                   |
| API               | http://localhost:4000                                   |
| API health        | http://localhost:4000/api/v1/health                     |
| API readiness     | http://localhost:4000/api/v1/ready                      |
| Supabase API      | http://127.0.0.1:54321                                  |
| PostgreSQL        | postgresql://postgres:postgres@127.0.0.1:54322/postgres |
| Supabase Studio   | http://127.0.0.1:54323                                  |
| Local email inbox | http://127.0.0.1:54324                                  |

Check the API from another terminal:

```bash
curl -i http://localhost:4000/api/v1/health
curl -i http://localhost:4000/api/v1/ready
```

`/health` confirms that the API process is responding. `/ready` also checks
the PostgreSQL connection and returns HTTP 503 when the database is unavailable.

## Quality commands

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:unit
pnpm test:integration
pnpm build
```

`pnpm test` runs the complete Vitest suite. The narrower test commands separate
unit tests from Fastify route integration tests.

## End-to-end tests

Install Chromium once on a development machine:

```bash
pnpm --filter @syncslate/web exec playwright install chromium
```

Run the browser smoke test:

```bash
pnpm test:e2e
```

Playwright starts the web and API development servers, opens the landing page,
and verifies that the API health status becomes connected.

## Database commands

With local Supabase running and `apps/api/.env` configured:

```bash
pnpm db:check
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

Supabase seeding is disabled until the project has deterministic product seed
data. Database schema and migration work will be added in a later milestone.

## Repository layout

```text
apps/
  api/                 Fastify backend
  web/                 Next.js frontend
packages/
  contracts/           Shared Zod schemas and TypeScript types
  database/            Drizzle configuration and PostgreSQL connection
supabase/               Local Supabase configuration
```

## Current limitations

Milestone 0 intentionally does not include authentication, product database
tables, interview sessions, WebSockets, Monaco/Yjs collaboration, the Fabric.js
whiteboard, timers, persistence, or replay. Those features begin in later
milestones.
