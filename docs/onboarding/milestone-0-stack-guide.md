# SyncSlate Milestone 0: A Beginner's Guide

This guide explains the foundation created during Milestone 0. It assumes you
are new to Node.js, TypeScript, React, Next.js, monorepos, backend APIs, and
automated testing.

You do not need to memorize everything before starting Milestone 1. Use this
document as a map: read it once, then return to the relevant section whenever
you encounter a tool or file.

## 1. What Milestone 0 accomplished

Milestone 0 created a reliable starting point for the SyncSlate product. It
does not implement interview rooms yet.

The repository now has:

- A pnpm monorepo containing multiple related projects.
- Turborepo commands that coordinate those projects.
- Strict TypeScript rules shared by the repository.
- A Next.js and React web application on port `3000`.
- Tailwind CSS for styling the web application.
- A Fastify API on port `4000`.
- A health endpoint at `GET /api/v1/health`.
- A shared Zod contract for the health response.
- Validated API environment configuration.
- ESLint checks for TypeScript, React, and Next.js.
- Vitest tests for the API, environment parser, and landing page.
- Reproducible dependency versions in `pnpm-lock.yaml`.
- Example environment files and local-development documentation.

The following product features are intentionally not implemented:

- Supabase authentication.
- PostgreSQL or Drizzle database access.
- Interview session creation.
- Candidate invitation links.
- WebSocket presence.
- Monaco, Yjs, and Hocuspocus collaboration.
- Fabric.js whiteboard collaboration.
- Timer synchronization.
- Session persistence and replay.

This separation matters. Milestone 0 proves the development foundation works
before product complexity is added.

## 2. The current system at a glance

The repository contains three workspaces:

```text
syncslate
├── apps/web                 Next.js browser-facing application
├── apps/api                 Fastify backend application
└── packages/contracts       Code shared safely between applications
```

The current runtime flow is:

```text
Browser
   |
   | HTTP request to localhost:3000
   v
Next.js web application

curl or a future web API client
   |
   | GET http://localhost:4000/api/v1/health
   v
Fastify API
   |
   | calls the health route
   v
Zod validates { status: "ok" }
   |
   v
JSON response: {"status":"ok"}
```

The web application does not call the API yet. They can run together, but the
landing page is currently independent of the health endpoint.

## 3. The stack, from the bottom up

### 3.1 Git

Git records snapshots of the repository. A commit should represent a coherent
change, such as adding the API health endpoint or configuring linting.

Useful commands:

```bash
git status
git diff
git log --oneline
```

- `git status` shows changed, new, and deleted files.
- `git diff` shows uncommitted line changes.
- `git log` shows previous commits.

Generated output, dependencies, local secrets, and caches are excluded through
[`.gitignore`](../.gitignore).

### 3.2 Node.js

JavaScript was originally designed for web browsers. Node.js is a runtime that
executes JavaScript outside the browser.

In this repository, Node.js runs:

- The Fastify API.
- Next.js development and production tooling.
- TypeScript, ESLint, Vitest, Tailwind, and Turborepo.
- Package scripts such as `pnpm build`.

The repository requires Node.js 24:

```json
"engines": {
  "node": ">=24.0.0 <25"
}
```

Check your installed version:

```bash
node --version
```

Node.js is the runtime. It is not a web framework, package manager, database,
or programming language.

### 3.3 Corepack and pnpm

A package manager downloads libraries and keeps track of their versions.

`npm` is bundled with Node.js. This project uses `pnpm` instead because pnpm:

- Works well with monorepos.
- Avoids unnecessary duplicate dependency files.
- Supports workspace dependencies explicitly.
- Uses a strict dependency layout that helps reveal undeclared imports.

Corepack selects the package-manager version declared by the project:

```json
"packageManager": "pnpm@11.18.0"
```

Common commands:

```bash
pnpm install
pnpm add some-package
pnpm add --save-dev some-tool
pnpm --filter @syncslate/api dev
```

Production libraries used by application code belong in `dependencies`.
Build, test, and development tools belong in `devDependencies`.

The `--filter` option targets one workspace instead of the entire monorepo.

### 3.4 `package.json`

A `package.json` file describes a Node.js project.

The root [`package.json`](../package.json) contains:

- Repository-wide commands.
- Node and pnpm version requirements.
- Shared development tools such as TypeScript, ESLint, and Turborepo.

Each workspace also has a `package.json`:

- [`apps/web/package.json`](../apps/web/package.json)
- [`apps/api/package.json`](../apps/api/package.json)
- [`packages/contracts/package.json`](../packages/contracts/package.json)

Scripts are named commands:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build"
}
```

Running `pnpm dev` executes the root `dev` script. Running
`pnpm --filter @syncslate/web dev` executes the web workspace's `dev` script.

### 3.5 The lockfile

[`pnpm-lock.yaml`](../pnpm-lock.yaml) records the exact dependency graph
resolved by pnpm.

`package.json` may allow a compatible version range:

```json
"react": "^19.2.8"
```

The lockfile records the exact installed version and its transitive
dependencies. Commit the lockfile so local machines, CI, and deployments
install the same dependency graph.

This command verifies that installation does not need to change the lockfile:

```bash
pnpm install --frozen-lockfile
```

### 3.6 pnpm workspaces and the monorepo

A monorepo stores multiple related applications and libraries in one Git
repository.

[`pnpm-workspace.yaml`](../pnpm-workspace.yaml) tells pnpm where workspaces
live:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

The API declares the contracts package as a workspace dependency:

```json
"@syncslate/contracts": "workspace:*"
```

This means “use the local package from this repository,” not a package from the
public npm registry.

The `allowBuilds` section records dependency install scripts that were
explicitly approved:

- `esbuild` compiles code for tools such as Vitest and tsx.
- `sharp` provides image processing used by Next.js.
- `unrs-resolver` supports module resolution used by lint tooling.

Explicit approval reduces the risk of automatically running arbitrary package
installation scripts.

### 3.7 JavaScript and TypeScript

JavaScript is the language executed by browsers and Node.js.

TypeScript adds static types to JavaScript. Types help catch mistakes before
the program runs:

```ts
const port: number = 4000;
```

TypeScript would reject:

```ts
const port: number = "four thousand";
```

Types disappear when TypeScript is compiled to JavaScript. They protect the
developer; Node.js still executes JavaScript.

The shared [`tsconfig.base.json`](../tsconfig.base.json) enables strict rules.
Important settings include:

- `strict`: enables TypeScript's main safety checks.
- `noUncheckedIndexedAccess`: array or object lookup may return `undefined`.
- `exactOptionalPropertyTypes`: distinguishes an absent property from a
  property explicitly set to `undefined`.
- `noImplicitOverride`: subclasses must clearly mark overridden methods.
- `noFallthroughCasesInSwitch`: helps prevent accidental `switch` behavior.
- `noEmit`: ordinary type-checking checks code without writing JavaScript.
- `isolatedModules`: ensures files can be compiled independently by modern
  tools.

The web, API, and contracts TypeScript configurations extend this shared file.
They add only the options needed by their environment.

The API uses `NodeNext` module resolution because its compiled JavaScript runs
directly in Node.js as ES modules. That is why a TypeScript source import may
end in `.js`:

```ts
import { buildApp } from "./app.js";
```

TypeScript finds `app.ts` while developing and emits an import that Node.js can
understand after compilation.

### 3.8 React

React is a UI library. A React component is a function that describes UI:

```tsx
export default function HomePage() {
  return <h1>SyncSlate</h1>;
}
```

The HTML-like syntax is JSX. A `.tsx` file is TypeScript that may contain JSX.

React organizes interfaces into components. Later, the interview room will
contain components for the timer, editor controls, problem panel, presence,
and whiteboard.

React itself does not provide routing, production builds, backend APIs, or
deployment. Next.js supplies the application framework around React.

### 3.9 Next.js and the App Router

Next.js is the web framework in [`apps/web`](../apps/web). It provides:

- File-based routing.
- Development and production servers.
- Server-side rendering and static generation.
- React Server Components.
- Bundling and optimization.
- Metadata and error-page conventions.

The project uses the App Router. Important files are:

- [`app/layout.tsx`](../apps/web/app/layout.tsx): the shared root HTML layout.
- [`app/page.tsx`](../apps/web/app/page.tsx): the page served at `/`.
- [`app/globals.css`](../apps/web/app/globals.css): global styles.
- [`next.config.ts`](../apps/web/next.config.ts): Next.js configuration.

Folders and filenames define routes. For example:

```text
app/page.tsx                  /
app/history/page.tsx          /history
app/sessions/[id]/page.tsx    /sessions/:id
```

App Router components are Server Components by default. The current layout and
page do not contain `"use client"`, so they can be rendered by Next.js without
sending component JavaScript for client-only behavior.

A future interactive component that uses browser state or event handlers may
need:

```tsx
"use client";
```

Do not add `"use client"` to every file. Server Components reduce browser
JavaScript and can safely access server-side resources when appropriate.

#### Rendering and hydration

Rendering converts React components into HTML.

Hydration is React attaching client-side behavior to HTML that was already
rendered by the server. The server HTML and the browser DOM must match.

The earlier `class="mdv-loaded"` warning was caused by a browser extension
changing `<html>` before hydration. The application did not create that class.
Testing in a private window with extensions disabled confirms this kind of
issue.

#### `next-env.d.ts`

Next.js generates `next-env.d.ts` to expose Next-specific TypeScript types.
Development and production generation can reference different `.next`
directories, so this generated file is ignored by Git.

The web type-check command runs:

```bash
next typegen && tsc --project tsconfig.json --noEmit
```

`next typegen` creates the required generated types before TypeScript checks
the application. `next dev` and `next build` also generate them.

### 3.10 Tailwind CSS and PostCSS

CSS controls presentation: color, spacing, layout, type size, responsive
behavior, and more.

Tailwind CSS is a utility-first CSS framework. Instead of inventing a custom
class for every element, components combine small utility classes:

```tsx
<h1 className="text-5xl font-bold text-slate-100">
  SyncSlate
</h1>
```

- `text-5xl` controls font size.
- `font-bold` controls font weight.
- `text-slate-100` controls text color.

Tailwind is not inherently “better CSS.” It is a workflow that makes consistent
design tokens and responsive styling convenient. The tradeoff is that JSX can
contain long class lists.

[`app/globals.css`](../apps/web/app/globals.css) loads Tailwind:

```css
@import "tailwindcss";
```

PostCSS transforms CSS during the build. The
[`postcss.config.mjs`](../apps/web/postcss.config.mjs) file connects Tailwind's
PostCSS plugin to the Next.js build.

### 3.11 HTTP, APIs, JSON, and curl

HTTP is the protocol used by browsers and clients to communicate with servers.

An HTTP request contains:

- A method such as `GET`, `POST`, `PATCH`, or `DELETE`.
- A URL path.
- Headers.
- Sometimes a request body.

An HTTP response contains:

- A status code, such as `200`, `400`, `401`, `404`, or `500`.
- Headers.
- Sometimes a response body.

JSON is a text format commonly used for API bodies:

```json
{
  "status": "ok"
}
```

`curl` is a terminal HTTP client:

```bash
curl -i http://localhost:4000/api/v1/health
```

The `-i` option displays response headers as well as the body.

### 3.12 Fastify and Pino

Fastify is the backend HTTP framework in [`apps/api`](../apps/api).

[`src/app.ts`](../apps/api/src/app.ts) creates and configures the Fastify
application. [`src/server.ts`](../apps/api/src/server.ts) validates the
environment and starts listening on a network port.

Keeping these responsibilities separate is useful:

- Tests can create the application without opening a real port.
- Server startup remains a small production entry point.
- Routes can be registered as focused modules.

The health route is registered under `/api/v1`:

```ts
app.register(healthRoutes, { prefix: "/api/v1" });
```

The route module adds `/health`, producing the full URL:

```text
/api/v1 + /health = /api/v1/health
```

Fastify uses Pino for structured logging. Instead of arbitrary text, logs
contain fields such as level, time, request ID, method, URL, status code, and
response time. Structured logs are easier to search in production.

### 3.13 Zod and runtime validation

TypeScript checks code while developing, but its types do not exist at runtime.
External data can still be malformed.

Zod defines schemas that validate real runtime values.

The shared health response contract is:

```ts
export const healthResponseSchema = z.object({
  status: z.literal("ok"),
});
```

This schema accepts exactly an object whose `status` is `"ok"`.

Zod can also derive a TypeScript type:

```ts
export type HealthResponse = z.infer<typeof healthResponseSchema>;
```

Keeping the schema in [`packages/contracts`](../packages/contracts) allows the
web and API to share the same definition later.

The API environment parser also uses Zod. Environment values start as strings,
so this rule converts `PORT` into a number and validates its range:

```ts
PORT: z.coerce.number().int().min(1).max(65_535).default(4000)
```

Failing at startup with a clear configuration error is safer than starting a
partially broken server.

### 3.14 Environment variables

Environment variables configure an application without hard-coding values.

The API currently has safe defaults:

```text
NODE_ENV=development
HOST=0.0.0.0
PORT=4000
LOG_LEVEL=info
```

Real local overrides may be placed in:

```text
apps/api/.env
```

The API start scripts load that file when it exists. The message below is
normal when it does not exist:

```text
.env not found. Continuing without it.
```

Next.js uses:

```text
apps/web/.env.local
```

The web application does not read environment variables yet.

Variables prefixed with `NEXT_PUBLIC_` may be included in browser JavaScript.
They must never contain secrets.

These are backend-only and must not use `NEXT_PUBLIC_`:

- Database connection strings.
- Supabase service-role keys.
- Invitation token peppers.
- Guest JWT secrets.

The `.env.example` files are safe templates. Real `.env` files are ignored by
Git.

### 3.15 Turborepo

Turborepo coordinates scripts across monorepo workspaces.

The root command:

```bash
pnpm typecheck
```

runs:

```text
turbo run typecheck
```

Turborepo finds every workspace with a `typecheck` script and runs it.

[`turbo.json`](../turbo.json) defines task behavior. For example:

```json
"build": {
  "dependsOn": ["^build"],
  "outputs": [".next/**", "dist/**"]
}
```

`^build` means dependencies build first. Because the API depends on contracts,
the contracts package builds before the API.

Turborepo hashes relevant inputs and caches results. If code and configuration
have not changed, it may replay a previous successful result. This is why
output sometimes says `cache hit`.

Development tasks are persistent and not cached:

```json
"dev": {
  "cache": false,
  "persistent": true
}
```

They continue watching files until stopped.

### 3.16 ESLint

ESLint examines source code for suspicious or disallowed patterns.

The root [`eslint.config.mjs`](../eslint.config.mjs) provides general
JavaScript and TypeScript rules for the API and contracts.

The web app has its own
[`eslint.config.mjs`](../apps/web/eslint.config.mjs) because React and Next.js
need additional rules, including Core Web Vitals guidance.

Every lint script uses:

```text
--max-warnings=0
```

This makes warnings fail the command instead of being silently accumulated.

Linting is not the same as formatting. ESLint checks code quality rules. The
repository does not currently include a dedicated formatter such as Prettier.

### 3.17 Vitest

Vitest is the automated test runner. It:

- Finds files matching the configured test patterns.
- Provides `describe`, `it`, and `expect`.
- Runs tests and reports failures.
- Integrates well with TypeScript and Vite-based tooling.

The repository currently has five tests:

1. API environment defaults are correct.
2. Valid environment strings are parsed.
3. Invalid environment values are rejected.
4. The health endpoint returns HTTP 200 and the correct JSON.
5. The landing page exposes an accessible heading and description.

### 3.18 React Testing Library, Jest DOM, and jsdom

React Testing Library renders React components and queries them in ways that
resemble user interaction.

The landing-page test asks for a semantic heading:

```ts
screen.getByRole("heading", { level: 1, name: "SyncSlate" })
```

This is stronger than checking a CSS selector because it also encourages
accessible HTML.

`jsdom` simulates browser DOM APIs inside Node.js. It is not a full browser.

Jest DOM adds readable assertions:

```ts
expect(element).toBeInTheDocument();
```

Despite its name, `@testing-library/jest-dom` can integrate with Vitest.

Full real-browser workflows will later use Playwright.

### 3.19 Fastify injection tests

Fastify's `app.inject()` sends a simulated HTTP request directly into the
application:

```ts
const response = await app.inject({
  method: "GET",
  url: "/api/v1/health",
});
```

This checks routing and response behavior without opening port `4000`. It is
fast and avoids network flakiness.

The test closes every created Fastify application afterward so resources do
not leak between tests.

## 4. Repository tour

### Root files

| File | Purpose |
| --- | --- |
| `AGENTS.md` | Architecture, product constraints, and agent instructions. |
| `README.md` | Short local-development reference. |
| `package.json` | Root scripts, tool versions, and shared development dependencies. |
| `pnpm-lock.yaml` | Exact reproducible dependency graph. |
| `pnpm-workspace.yaml` | Workspace locations and approved dependency build scripts. |
| `turbo.json` | Task dependencies, caching, and build outputs. |
| `tsconfig.base.json` | Shared strict TypeScript rules. |
| `eslint.config.mjs` | Shared API/contracts lint rules. |
| `.gitignore` | Files Git must not track. |
| `.env.example` | Combined reference for planned environment variables. |

### API files

| File | Purpose |
| --- | --- |
| `apps/api/src/app.ts` | Constructs Fastify and registers route modules. |
| `apps/api/src/server.ts` | Parses configuration and starts the network server. |
| `apps/api/src/config/env.ts` | Validates and types API environment values. |
| `apps/api/src/config/env.test.ts` | Tests defaults, parsing, and rejection. |
| `apps/api/src/modules/health/health.routes.ts` | Implements the health endpoint. |
| `apps/api/src/modules/health/health.routes.test.ts` | Tests the endpoint through Fastify injection. |
| `apps/api/tsconfig.json` | API TypeScript configuration. |
| `apps/api/tsconfig.build.json` | Excludes tests from production output. |
| `apps/api/vitest.config.ts` | Restricts API tests to source test files. |
| `apps/api/.env.example` | Backend-only configuration template. |

### Web files

| File | Purpose |
| --- | --- |
| `apps/web/app/layout.tsx` | Root HTML structure and page metadata. |
| `apps/web/app/page.tsx` | Landing page at `/`. |
| `apps/web/app/page.test.tsx` | Accessible landing-page test. |
| `apps/web/app/globals.css` | Loads global Tailwind CSS. |
| `apps/web/postcss.config.mjs` | Enables Tailwind processing. |
| `apps/web/next.config.ts` | Next.js configuration. |
| `apps/web/tsconfig.json` | Browser, JSX, and Next TypeScript settings. |
| `apps/web/vitest.config.ts` | React test environment and file patterns. |
| `apps/web/tests/setup.ts` | Loads Jest DOM matchers for Vitest. |
| `apps/web/eslint.config.mjs` | Next.js, React, and TypeScript lint rules. |
| `apps/web/.env.example` | Future public browser configuration template. |

### Contracts files

| File | Purpose |
| --- | --- |
| `packages/contracts/src/health.ts` | Runtime health schema and inferred TypeScript type. |
| `packages/contracts/src/index.ts` | Public exports of the contracts package. |
| `packages/contracts/tsconfig.json` | Builds JavaScript and declaration files into `dist`. |

## 5. What happens when you run commands

### `pnpm install --frozen-lockfile`

1. pnpm reads every workspace `package.json`.
2. It reads the exact dependency graph in `pnpm-lock.yaml`.
3. It links dependencies into workspace `node_modules` directories.
4. It fails if installation would require changing the lockfile.

### `pnpm dev`

1. The root script runs `turbo run dev`.
2. Turborepo starts the web and API development scripts.
3. Next.js watches the web application on port `3000`.
4. The API builds the contracts package.
5. tsx watches API TypeScript files and runs the server on port `4000`.
6. Editing source files triggers the appropriate development process to
   refresh or restart.

Stop the processes with `Ctrl+C`.

Because development tasks are persistent, the package manager may display an
`ELIFECYCLE` or interrupted-task message after `Ctrl+C`. That is expected when
you intentionally stop the processes; it is different from an immediate
startup failure.

### `pnpm lint`

1. Turborepo finds lint scripts in web, API, and contracts.
2. The web uses its Next.js-specific configuration.
3. API and contracts use the shared root configuration.
4. Any error or warning makes the command fail.

### `pnpm test`

1. Turborepo builds dependency packages required by tests.
2. API and web Vitest suites run.
3. Five tests must pass.

### `pnpm typecheck`

1. The web generates Next.js route types.
2. TypeScript checks all three workspaces without emitting JavaScript.
3. Strict type errors make the command fail.

### `pnpm build`

1. Contracts compile into `packages/contracts/dist`.
2. The API compiles into `apps/api/dist`.
3. Next.js creates an optimized web build in `apps/web/.next`.
4. Turborepo records cache information for future unchanged builds.

Generated directories are ignored by Git.

## 6. Quality tools answer different questions

These commands overlap slightly, but none replaces the others:

| Command | Main question |
| --- | --- |
| `pnpm lint` | Does the code violate known quality or framework rules? |
| `pnpm test` | Does the implemented behavior match our assertions? |
| `pnpm typecheck` | Are TypeScript values and interfaces used safely? |
| `pnpm build` | Can production artifacts actually be generated? |

Examples:

- A misspelled object property may fail type-checking.
- An inaccessible React pattern may fail linting.
- A health response changed to the wrong JSON may fail a test.
- A framework bundling problem may fail the build.

Run all four before considering a slice complete.

## 7. Development and production commands

Install:

```bash
pnpm install --frozen-lockfile
```

Run everything in development:

```bash
pnpm dev
```

Run only one application:

```bash
pnpm --filter @syncslate/web dev
pnpm --filter @syncslate/api dev
```

Check the API:

```bash
curl -i http://localhost:4000/api/v1/health
```

Run the quality gate:

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

Run compiled applications after building:

```bash
pnpm --filter @syncslate/api start
pnpm --filter @syncslate/web start
```

The two production start commands occupy the terminal and normally run in
separate terminals.

## 8. Common issues and what they mean

### “Address already in use”

Another process is using port `3000` or `4000`.

On Linux, inspect listeners:

```bash
ss -ltnp '( sport = :3000 or sport = :4000 )'
```

Stop the existing development server before starting another one.

### `.env not found. Continuing without it.`

This is expected. The API has safe defaults and uses an `.env` file only when
you create one.

### `ELIFECYCLE` after Ctrl+C

If both services were running successfully and the message appears only after
you pressed `Ctrl+C`, it reports that a persistent process was interrupted.
That is normal.

If it appears immediately during startup, scroll upward to find the original
error.

### tsx tries to find a module named `watch`

tsx expects its watch subcommand before the Node environment flag:

```text
tsx watch --env-file-if-exists=.env src/server.ts
```

Putting the flag before `watch` makes tsx interpret `watch` as a script path.

### Hydration attributes do not match

First try a private browser window with extensions disabled. An extension may
modify the DOM before React hydrates it.

Do not immediately hide the issue with `suppressHydrationWarning`. Confirm
whether application code or an extension caused the mismatch.

### `next-env.d.ts` appears or changes

It is generated by Next.js and ignored by Git. `next dev`, `next build`, and
`next typegen` may regenerate it.

### Turborepo says “cache hit”

The relevant inputs match an earlier successful task, so Turborepo reused the
result. Use a forced run only when diagnosing cache behavior:

```bash
pnpm exec turbo run lint test typecheck build --force
```

Ordinary development should use the normal root commands.

### pnpm blocks a dependency build script

pnpm applies supply-chain protections. Do not approve every package
automatically. Identify why the dependency needs a script and approve only the
specific expected package.

## 9. Tools that are planned but not active

It is important to distinguish installed utilities, documented technology
choices, and implemented application code.

### Docker

Docker runs software in containers. It will later help provide reproducible
local services such as PostgreSQL. There is no active Docker Compose database
configuration yet.

### PostgreSQL and `psql`

PostgreSQL is the planned relational database.

`psql` is only a command-line client used to connect to PostgreSQL. Installing
`psql` does not create the SyncSlate database or schema.

### Supabase

Supabase will provide hosted PostgreSQL and interviewer authentication. No
Supabase client or backend token verification is implemented yet.

### Drizzle ORM and Drizzle Kit

Drizzle will define typed database tables and queries. Drizzle Kit will
generate and manage database migrations. They are not installed yet.

### Playwright

Playwright controls a real browser for end-to-end testing. Vitest currently
tests units, React components, and Fastify routes; Playwright will later test
complete user flows.

### Monaco Editor

Monaco is the code editor used by VS Code. It will provide the interview code
editing interface.

### Yjs and Hocuspocus

Yjs is a conflict-free collaborative data model. Hocuspocus will host Yjs
documents on the backend. They will synchronize Monaco code between
participants.

### Fabric.js

Fabric.js provides an interactive canvas and object model for the whiteboard.
Its operations will use the room WebSocket protocol rather than Yjs.

### TanStack Query and Zustand

TanStack Query will manage server-backed frontend data. Zustand will be used
sparingly for shared local UI state. Neither is needed by the current static
landing page.

## 10. Safe beginner exercises

These exercises help you learn without beginning Milestone 1.

### Exercise 1: Trace a root command

1. Find `test` in the root `package.json`.
2. Find `test` in the API and web `package.json` files.
3. Run `pnpm test`.
4. Identify which workspace produced each output line.

### Exercise 2: Read the health request

1. Start `pnpm dev`.
2. Run the health `curl` command in another terminal.
3. Find the `/api/v1` prefix in `apps/api/src/app.ts`.
4. Find `/health` in the route module.
5. Find the response schema in `packages/contracts`.

### Exercise 3: Cause and fix a test failure

1. Temporarily change the expected landing-page heading in the test.
2. Run the web test and read the failure.
3. Undo your temporary edit.
4. Run the test again.

Do not commit the intentional failing change.

### Exercise 4: Explore TypeScript safety

1. Temporarily pass an invalid value where a number is expected.
2. Run `pnpm typecheck`.
3. Read the file path, line, and error message.
4. Undo the edit and confirm type-checking passes.

### Exercise 5: Inspect generated output

1. Run `pnpm build`.
2. Observe `apps/web/.next`, `apps/api/dist`, and
   `packages/contracts/dist`.
3. Confirm `git status` does not list those directories.

Do not manually edit generated build output.

## 11. Glossary

| Term | Beginner definition |
| --- | --- |
| API | A defined way for software systems to communicate. |
| App Router | Next.js routing system based on the `app` directory. |
| Build | Transforming source code into production-ready output. |
| Cache | Reused output from unchanged inputs. |
| CLI | Command-line interface, such as `pnpm` or `psql`. |
| Component | A reusable React function that describes UI. |
| Contract | A shared definition of allowed request or response data. |
| Dependency | A library or tool used by a project. |
| DOM | Browser representation of an HTML document. |
| Environment variable | External configuration supplied to a process. |
| ES module | Modern JavaScript import/export module format. |
| Framework | A structured system for building an application. |
| Health endpoint | A route indicating that a service process is responding. |
| Hydration | React attaching client behavior to server-rendered HTML. |
| Injection test | Sending a simulated request directly into Fastify. |
| JSON | Text data format used by APIs. |
| JSX | HTML-like syntax used in React components. |
| Linting | Static checks for suspicious or disallowed code patterns. |
| Lockfile | Exact resolved dependency graph committed to Git. |
| Monorepo | One repository containing multiple applications or packages. |
| ORM | Tool for describing and querying a relational database in code. |
| Package | A Node.js project or reusable library with a `package.json`. |
| PostCSS | Tool that transforms CSS using plugins. |
| Runtime | Software that executes a program, such as Node.js or a browser. |
| Schema | Runtime description of valid data. |
| Server Component | React component rendered by the server by default in the App Router. |
| Static generation | Producing HTML during the build rather than per request. |
| Type-checking | Verifying TypeScript types without running behavior tests. |
| Workspace | One package managed as part of the pnpm monorepo. |

## 12. Milestone 0 completion checklist

Milestone 0 is complete when all of these pass:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

Then:

1. Run `pnpm dev`.
2. Open `http://localhost:3000`.
3. Request `http://localhost:4000/api/v1/health`.
4. Confirm the API returns `{"status":"ok"}`.
5. Stop the processes.
6. Confirm `git status` contains only intentional source/documentation changes.

At that point, the repository is ready for the first carefully scoped
Milestone 1 slice.
