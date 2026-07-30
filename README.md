# SyncSlate

SyncSlate is a production-minded MVP for running real-time technical
interviews. The planned workspace combines collaborative code editing, a
shared whiteboard, a synchronized timer, problem context, presence, and
session replay.

The repository currently contains the Milestone 0 application foundation:

- A Next.js web application.
- A Fastify API with a health endpoint.
- Shared runtime contracts using Zod.
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

No environment files are required for the current local application. The API
uses these defaults:

```text
NODE_ENV=development
HOST=0.0.0.0
PORT=4000
LOG_LEVEL=info
```

To override API settings:

```bash
cp apps/api/.env.example apps/api/.env
```

The web application does not consume environment variables yet. Its template
is ready for later API and Supabase integration:

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

| Service | URL |
| --- | --- |
| Web | http://localhost:3000 |
| API | http://localhost:4000 |
| API health | http://localhost:4000/api/v1/health |

Verify the API from another terminal:

```bash
curl -i http://localhost:4000/api/v1/health
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
```

Database, authentication, realtime collaboration, and interview-room features
are not implemented yet.

## Learning material

If you are new to the stack, read the
[Development stack and onboarding guide](docs/onboarding/milestone-0-stack-guide.md). It
explains the tools, repository structure, request flow, tests, and commands
used to build the current foundation.
