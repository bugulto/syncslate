# SyncSlate

SyncSlate is a production-minded MVP for conducting real-time technical
interviews. Milestone 1 provides the authenticated interviewer foundation:
email/password and Google sign-in through Supabase Auth, a protected dashboard,
Fastify bearer-token verification, conflict-safe profile bootstrap, and
sign-out.

The next milestone adds problems, interview-session creation, and secure
candidate invitations. Realtime rooms, Monaco/Yjs collaboration, the Fabric.js
whiteboard, the server-authoritative timer, persistence, and replay remain on
the later roadmap.

## Architecture

```text
Browser / Next.js
  ├── Supabase Auth (identity, OAuth, session cookies)
  └── Authorization: Bearer <Supabase access token>
                         │
                         ▼
Fastify API (token verification and application authorization)
                         │
                         ▼
Supabase PostgreSQL
  ├── auth.users      Supabase-owned identity
  └── public.profiles SyncSlate-owned profile
```

Supabase proves the interviewer's identity. Fastify remains the application
authorization boundary, and the browser never accesses PostgreSQL directly.
Shared Zod contracts validate `/api/v1/me` at both API and web boundaries.

## Prerequisites

- Node.js 24.x
- pnpm 11.x
- Docker Engine or Docker Desktop
- Git
- Google OAuth web credentials when testing Google sign-in locally

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

Create the ignored application environment files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

For local Google OAuth, create the ignored root `.env` and set:

```bash
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<google-web-client-id>
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET=<google-web-client-secret>
```

Never put the Google secret, Supabase service-role key, or other backend
credentials in a `NEXT_PUBLIC_` variable.

Start local Supabase:

```bash
pnpm infra:up
pnpm infra:status
```

Copy the local values reported by `infra:status` into the application files:

| Supabase status value | API environment                       | Web environment                 |
| --------------------- | ------------------------------------- | ------------------------------- |
| `API_URL`             | `SUPABASE_URL`                        | `NEXT_PUBLIC_SUPABASE_URL`      |
| `ANON_KEY`            | `SUPABASE_ANON_KEY`                   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `DB_URL`              | `DATABASE_URL`, `DIRECT_DATABASE_URL` | —                               |

Apply the committed Drizzle migration and verify PostgreSQL connectivity:

```bash
pnpm db:migrate
pnpm db:check
```

Start the web application and API together:

```bash
pnpm dev
```

If Next.js reports that another development server owns port 3000, stop the
older process before starting a second workspace server.

## Authentication configuration

### Local redirect URLs

The committed Supabase configuration allows these application callbacks:

```text
http://localhost:3000/auth/callback
http://127.0.0.1:3000/auth/callback
```

For a Google OAuth web client, configure:

```text
Authorized JavaScript origin:
http://localhost:3000

Authorized redirect URI from Google to local Supabase:
http://127.0.0.1:54321/auth/v1/callback
```

For hosted Supabase, Google must instead also allow:

```text
https://<project-reference>.supabase.co/auth/v1/callback
```

The production SyncSlate callback, such as
`https://<web-domain>/auth/callback`, must be added to Supabase Auth's redirect
allow-list. Provider secrets belong in Supabase configuration, never in the
web deployment.

### Local test interviewer

Local email confirmation is disabled for development. To create a reusable
test interviewer:

1. Open `http://localhost:3000/sign-in`.
2. Select **Create an account**.
3. Enter a 3–20 character display name, a local test email, and a password.
4. Submit the form and confirm that `/dashboard` loads.
5. Sign out, then use the same credentials in the normal sign-in form.

The first authenticated `/api/v1/me` request creates exactly one associated
`public.profiles` row. Passwords and provider identities remain exclusively in
Supabase Auth.

## Local services

| Service           | URL                                                     |
| ----------------- | ------------------------------------------------------- |
| Web               | http://localhost:3000                                   |
| API               | http://localhost:4000                                   |
| API health        | http://localhost:4000/api/v1/health                     |
| API readiness     | http://localhost:4000/api/v1/ready                      |
| Current user      | http://localhost:4000/api/v1/me                         |
| Supabase API      | http://127.0.0.1:54321                                  |
| PostgreSQL        | postgresql://postgres:postgres@127.0.0.1:54322/postgres |
| Supabase Studio   | http://127.0.0.1:54323                                  |
| Local email inbox | http://127.0.0.1:54324                                  |

`/health` confirms the API process is responding. `/ready` also checks the
database. `/me` requires a valid Supabase bearer token.

Stop local Supabase when finished:

```bash
pnpm infra:down
```

## Quality commands

```bash
pnpm db:generate
pnpm db:migrate
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:unit
pnpm test:integration
pnpm build
pnpm test:e2e
```

`pnpm test` runs the Vitest suites. Fastify injection tests cover protected
`/me`, including missing and invalid credentials, profile bootstrap, and
repeated requests. Playwright requires local Supabase and the profile migration;
it covers anonymous dashboard rejection, email sign-in, dashboard access,
sign-out, and denial after sign-out. Google consent is verified manually rather
than automated against Google's external UI.

Install Chromium once when needed:

```bash
pnpm --filter @syncslate/web exec playwright install chromium
```

## Database commands

```bash
pnpm db:check
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

Milestone 1 intentionally contains only `public.profiles`, which references
Supabase-managed `auth.users`. Do not add problems, sessions, participants, or
invitations without a new Milestone 2 migration. Product seeding remains
disabled until deterministic problem seed data is introduced.

## Repository layout

```text
apps/web/             Next.js App Router web application
apps/api/             Fastify application backend
packages/contracts/   Shared Zod schemas and public types
packages/database/    Drizzle schema, migration, and repositories
supabase/             Local Supabase configuration
```

## Current limitations and next milestone

Milestone 1 does not create interview sessions or display fabricated session
history. The dashboard intentionally shows **No interviews yet**.

Milestone 2 begins with shared problem/session contracts and additive Drizzle
migrations for problems, starter code, sessions, and hashed invitation records.
It must preserve Fastify authorization, opaque UUIDs, database ownership
constraints, and the separation between Supabase identities and SyncSlate
profiles.
