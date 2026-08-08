# SyncSlate

SyncSlate is a production-minded MVP for running real-time technical
interviews. The planned workspace combines collaborative code editing, a
shared whiteboard, a synchronized timer, problem context, presence, and
session replay.

The repository currently contains the Milestone 0 application foundation:

- A Next.js web application.
- A Fastify API with health and database-readiness endpoints.
- A landing page that reports the API connection status.
- Shared runtime contracts using Zod.
- A Drizzle database package with validated PostgreSQL connections.
- TypeScript, Tailwind CSS, Vitest, ESLint, pnpm workspaces, and Turborepo.

## Prerequisites

- Node.js 24.x
- pnpm 11.x
- Git

The repository pins its pnpm version in `package.json`. If pnpm is not
available, enable it through Corepack:

```bash
corepack enable
corepack prepare pnpm@11.18.0 --activate
```

## Install

From the repository root:

```bash
pnpm install --frozen-lockfile
```

## Environment configuration

The API requires a PostgreSQL connection for readiness checks. Copy the API
template after starting local Supabase:

```bash
cp apps/api/.env.example apps/api/.env
```

The API uses these non-database defaults:

```text
NODE_ENV=development
HOST=0.0.0.0
PORT=4000
LOG_LEVEL=info
```

The web application reads its API base URL from `NEXT_PUBLIC_API_URL`:

```bash
cp apps/web/.env.example apps/web/.env.local
```

The root `.env.example` documents the complete planned configuration. Never
commit real `.env` files or backend secrets. Only non-secret browser values
may use the `NEXT_PUBLIC_` prefix.

## Run locally

Start the web application and API together:

```bash
pnpm dev
```

Local services:

| Service       | URL                                 |
| ------------- | ----------------------------------- |
| Web           | http://localhost:3000               |
| API           | http://localhost:4000               |
| API health    | http://localhost:4000/api/v1/health |
| API readiness | http://localhost:4000/api/v1/ready  |

Verify the API from another terminal:

```bash
curl -i http://localhost:4000/api/v1/health
curl -i http://localhost:4000/api/v1/ready
```

Run one application at a time:

```bash
pnpm --filter @syncslate/web dev
pnpm --filter @syncslate/api dev
```

## Quality checks

Run these from the repository root:

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

Turborepo runs each command in every workspace that supports it.

## Repository layout

```text
apps/
  api/                 Fastify backend
  web/                 Next.js frontend
packages/
  contracts/           Shared Zod schemas and TypeScript types
  database/            Drizzle configuration and PostgreSQL connection
```

Database product schemas, authentication, realtime collaboration, and
interview-room features are not implemented yet.

## Database commands

With local Supabase running and `apps/api/.env` configured, verify PostgreSQL:

```bash
pnpm db:check
```

Migration commands are available for later schema milestones:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```
