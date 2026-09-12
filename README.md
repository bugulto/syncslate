# SyncSlate

SyncSlate is a production-minded MVP for conducting real-time technical
interviews. The current Milestone 3 foundation adds persisted room participants,
public invitation inspection, atomic candidate admission, and short-lived guest
credentials to the Milestone 2 interviewer and session flow.

Realtime room joining, Monaco/Yjs collaboration, the Fabric.js whiteboard, the
server-authoritative timer, collaboration persistence, and replay remain on the
later roadmap.

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
  ├── auth.users                 Supabase-owned identity
  ├── public.profiles            SyncSlate-owned profile
  ├── public.problems            Seeded/private problem metadata
  ├── public.problem_starter_code
  ├── public.interview_sessions  Owner-scoped session history
  └── public.session_invitations Hashed invitation records
```

Supabase proves the interviewer's identity. Fastify remains the application
authorization boundary, and the browser never accesses PostgreSQL directly.
Shared Zod contracts validate current-user, problem, session, invitation, and
error payloads at API and web boundaries.

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

Generate a private invitation-token pepper and place it in `apps/api/.env`:

```bash
openssl rand -hex 32
```

```text
INVITE_TOKEN_PEPPER=<generated-value>
GUEST_JWT_SECRET=<a-second-generated-value>
GUEST_JWT_TTL_SECONDS=1800
```

Both secrets are required by the API, must contain at least 32 characters, must
use separate values, and must not be exposed to the browser. The guest lifetime
may be set from 300 to 86400 seconds.

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

Apply the committed Drizzle migrations, seed the built-in problem library, and
verify PostgreSQL connectivity:

```bash
pnpm db:migrate
pnpm db:seed
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
| Problems          | http://localhost:4000/api/v1/problems                   |
| Sessions          | http://localhost:4000/api/v1/sessions                   |
| Supabase API      | http://127.0.0.1:54321                                  |
| PostgreSQL        | postgresql://postgres:postgres@127.0.0.1:54322/postgres |
| Supabase Studio   | http://127.0.0.1:54323                                  |
| Local email inbox | http://127.0.0.1:54324                                  |

`/health` confirms the API process is responding. `/ready` also checks the
database. `/me`, `/problems`, `/sessions`, and invitation management require a
valid Supabase bearer token. Session and invitation access is scoped to the
authenticated interviewer.

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

`pnpm test` runs the Vitest suites. They cover shared contracts, deterministic
seed validation, repositories, owner-scoped Fastify routes, invitation hashing
and revocation, and the authenticated web flows. PostgreSQL integration tests
cover seed idempotency, search/filter behavior, ownership denial, and hash-only
invitation storage. Playwright requires local Supabase and all migrations; it
covers anonymous dashboard rejection, email sign-in, dashboard access,
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
pnpm db:seed
pnpm db:studio
```

Migration `0000` creates `public.profiles`, which references Supabase-managed
`auth.users`. Migration `0001` adds problems, starter code, interview sessions,
and hashed invitation records. `pnpm db:seed` idempotently upserts the
deterministic built-in problem library and its language-specific starter code.
Raw invitation tokens never enter PostgreSQL; only HMAC-SHA-256 hashes are
stored.

## Repository layout

```text
apps/web/             Next.js App Router web application
apps/api/             Fastify application backend
packages/contracts/   Shared Zod schemas and public types
packages/database/    Drizzle schema, migration, and repositories
supabase/             Local Supabase configuration
```

## Milestone 2 flow

1. Sign in and open `/dashboard`.
2. Select **Create interview**.
3. Search/filter the seeded problem library and choose a supported language.
4. Create a waiting, candidate-only session.
5. Generate and copy the one-time candidate invitation link.
6. Revoke the invitation or generate a replacement when needed.
7. Return to the dashboard to see owner-scoped session history, newest first.

The raw invitation link is available only in the page visit that generated it.
Refreshing requires generating a new link. Guest invitation inspection and
joining are intentionally deferred to Milestone 3.

## Current limitations and next milestone

Milestone 3 adds candidate invitation inspection/joining, guest credentials,
participants, realtime room presence, and the first collaboration transport.
The current `/join/<token>` link therefore identifies the future candidate
entry route but does not yet admit a guest to a room.
