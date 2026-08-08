# AGENTS.md

## 1. Purpose of this file

This file is the repository-level operating guide for coding agents working on this project.

Follow it before making architectural decisions, adding dependencies, changing database schemas, or implementing features. Treat the decisions marked **fixed for the MVP** as constraints unless the user explicitly asks to change them.

When this repository is empty or only partially initialized, start with the earliest incomplete milestone in the implementation plan. Do not attempt to build the entire product in one change.

---

## 2. Project overview

This project is a production-minded MVP for conducting real-time technical interviews.

Two participants join a private interview room:

- **Interviewer**: authenticated account that creates and controls the session.
- **Candidate**: joins through a secure invitation link and may participate without creating an account.

The room combines:

- A collaborative Monaco code editor.
- A collaborative Fabric.js whiteboard.
- A synchronized interview timer.
- A problem statement and starter-code panel.
- Participant presence and connection status.
- Session recording through structured events and snapshots.
- Interview history and code replay.

The product is not a general-purpose IDE, video-conferencing platform, or online coding judge. It is a focused interview collaboration tool.

### Primary user flow

1. The interviewer signs in.
2. The interviewer creates a session.
3. The interviewer selects a problem, language, and time limit.
4. The application creates a secure candidate invitation link.
5. The candidate opens the link and enters a display name.
6. Both participants enter the same real-time room.
7. The interviewer starts the session timer.
8. The candidate writes code and both participants use the whiteboard.
9. The application records meaningful collaboration events and snapshots.
10. The interviewer ends the session.
11. The session appears in interview history.
12. The interviewer opens the completed session and replays the code progression.

---

## 3. MVP priorities

Implement the MVP in this order:

1. Reliable room creation and joining.
2. Authentication and role enforcement.
3. Real-time participant presence.
4. Monaco collaboration through Yjs.
5. Collaborative whiteboard synchronization.
6. Server-authoritative timer.
7. Problem library.
8. Session persistence.
9. Event transcript and code replay.
10. Reliability, testing, security, and deployment polish.

When choosing between adding a feature and improving reliability, prioritize reliability.

### MVP success criteria

The MVP is successful when the following demo works in two independent browser contexts:

1. An authenticated interviewer creates a room.
2. A guest candidate joins from an invitation link.
3. Both users see each other as connected.
4. Candidate code changes appear in the interviewer window.
5. The interviewer can enable collaborative editing or take editor control.
6. Both users can draw and manipulate objects on the whiteboard.
7. The timer remains synchronized.
8. A participant can disconnect, reconnect, and recover the latest state.
9. Ending the session persists final code, whiteboard state, metadata, and transcript.
10. The interviewer can open history and replay the code changes.

---

## 4. Explicit non-goals for the MVP

Do not implement these unless the user explicitly expands the scope:

- Built-in video or audio calls.
- Screen sharing.
- AI candidate scoring.
- AI cheating detection.
- Automated hiring decisions.
- Full code execution or sandbox infrastructure.
- A LeetCode-style judge with hidden test cases.
- Multi-tenant companies, billing, or subscriptions.
- Multi-interviewer panels.
- Public candidate profiles.
- Calendar integrations.
- Public problem submissions or voting.
- Native mobile applications.
- Full whiteboard replay in the first version.
- Redis before a real need exists.
- Kubernetes or microservices.
- Premature horizontal scaling.

External meeting software can provide audio/video during the MVP demo.

---

## 5. Fixed technology decisions

These choices are fixed for the MVP unless explicitly changed.

### Repository

- **Monorepo**: pnpm workspaces.
- **Task runner**: Turborepo.
- **Language**: TypeScript in strict mode.
- **Runtime**: A currently supported Node.js release compatible with all locked dependencies.
- **Package versions**: controlled by the lockfile. Do not perform unrelated major-version upgrades.

### Frontend

- **Framework**: Next.js with the App Router.
- **UI**: React, Tailwind CSS, and accessible reusable components.
- **Component primitives**: shadcn/ui or equivalent Radix-based components.
- **Server-state fetching**: TanStack Query.
- **Local UI state**: Zustand where necessary.
- **Validation**: Zod.
- **Code editor**: Monaco Editor.
- **Code collaboration**: Yjs and y-monaco.
- **Whiteboard**: Fabric.js.
- **Testing**: Vitest, React Testing Library, and Playwright.

### Backend

- **Runtime**: Node.js.
- **HTTP API**: Fastify.
- **Realtime room events**: WebSocket transport hosted by the backend.
- **Yjs server**: Hocuspocus in the same backend process for the MVP.
- **Validation**: Zod schemas shared with the frontend.
- **Logging**: structured Fastify/Pino logging.
- **Testing**: Vitest and Fastify injection tests.

### Persistence and authentication

- **Authentication**: Supabase Auth.
- **Primary database**: PostgreSQL provided by Supabase.
- **ORM/query layer**: Drizzle ORM.
- **Database migrations**: Drizzle Kit.
- **Redis**: not part of the first implementation.
- **Object storage**: Supabase Storage only if later needed for exported assets.

### Deployment

- **Frontend**: Vercel.
- **Backend and persistent WebSockets**: Railway.
- **Database and Auth**: Supabase.
- Render is an acceptable backend fallback, but do not maintain two deployment paths.

---

## 6. Architectural principles

### 6.1 Use one deployable backend for the MVP

The backend process should host:

- REST endpoints.
- Room WebSocket events.
- Hocuspocus/Yjs collaboration.
- Session snapshot and transcript persistence.

Keep boundaries clean enough to split services later, but do not create separate services initially.

### 6.2 Separate state by ownership

Do not put every kind of state into one store.

#### Collaborative code state

Owned by Yjs.

Examples:

- Current code text.
- Monaco selections and cursors through awareness.
- Collaborative undo/redo state.

Do not duplicate the canonical code text in Zustand.

#### Whiteboard state

Owned by the Fabric.js canvas in the browser and synchronized through room operations.

The backend stores ordered operations and periodic snapshots.

#### Server-authoritative room state

Owned by the backend.

Examples:

- Session status.
- Participant roles.
- Editor access policy.
- Current problem.
- Selected language.
- Timer state.
- Session start and end state.
- Monotonic room event sequence.

#### Persistent application state

Owned by PostgreSQL.

Examples:

- Users and profiles.
- Problems.
- Sessions.
- Participants.
- Invitation records.
- Session events.
- Code updates and snapshots.
- Whiteboard snapshots.
- Final session artifacts.

#### Ephemeral state

Do not persist:

- Mouse pointer movement.
- Temporary drawing previews.
- Typing indicators.
- Heartbeats.
- Hover state.
- Open UI panels.
- Monaco scroll positions unless needed for a replay feature.

### 6.3 Prefer vertical slices

Implement one complete path across frontend, backend, validation, database, and tests before starting the next major feature.

Avoid creating dozens of placeholder modules that are not exercised.

### 6.4 Keep shared contracts explicit

All REST payloads, WebSocket event payloads, and important domain types must be defined in the shared contracts package.

Runtime validation is mandatory at trust boundaries.

### 6.5 Optimize for correctness before scale

The MVP targets one interviewer and one candidate per room.

Design for multiple rooms, but do not optimize for massive concurrency until measurement justifies it.

---

## 7. Recommended repository structure

Use this structure unless the existing repository already has an equivalent clean layout.

```text
.
├── AGENTS.md
├── README.md
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── turbo.json
├── .env.example
├── .gitignore
├── docker-compose.yml
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── providers/
│   │   ├── public/
│   │   └── tests/
│   └── api/
│       ├── src/
│       │   ├── app.ts
│       │   ├── server.ts
│       │   ├── config/
│       │   ├── plugins/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── health/
│       │   │   ├── problems/
│       │   │   ├── sessions/
│       │   │   ├── invitations/
│       │   │   ├── realtime/
│       │   │   ├── collaboration/
│       │   │   └── replay/
│       │   ├── services/
│       │   └── test/
│       └── package.json
├── packages/
│   ├── contracts/
│   │   └── src/
│   ├── database/
│   │   ├── src/
│   │   └── drizzle/
│   ├── ui/
│   │   └── src/
│   ├── config/
│   └── test-utils/
└── docs/
    ├── architecture.md
    ├── realtime-protocol.md
    ├── data-model.md
    ├── local-development.md
    ├── deployment.md
    └── decisions/
```

### Package responsibilities

#### `apps/web`

Browser-facing application only.

It contains:

- Authentication pages.
- Interviewer dashboard.
- Session creation.
- Candidate waiting room.
- Interview workspace.
- History and replay pages.
- Browser collaboration adapters.

Do not access the database directly from browser code.

#### `apps/api`

The authoritative application backend.

It contains:

- Supabase JWT verification.
- Guest invitation exchange.
- Session and problem APIs.
- Role and permission enforcement.
- Room presence.
- Timer coordination.
- Whiteboard synchronization.
- Hocuspocus/Yjs server.
- Transcript and snapshot persistence.

#### `packages/contracts`

Shared TypeScript types and Zod schemas for:

- REST requests and responses.
- WebSocket envelopes.
- Domain enums.
- Error codes.
- Session events.
- Whiteboard operations.

This package must not depend on frontend or backend frameworks.

#### `packages/database`

Contains:

- Drizzle schema.
- Database client.
- Migrations.
- Repository/query functions.
- Seed data.

Keep business rules out of raw query files.

#### `packages/ui`

Reusable presentational components.

Do not move feature-specific business components here merely to reduce file count.

---

## 8. Domain model

Use UUIDs for persistent entity identifiers unless a strong existing convention says otherwise.

### 8.1 User profile

Supabase Auth owns authentication identities. The application stores an associated profile.

Suggested fields:

```text
profiles
- id uuid primary key references auth.users
- display_name text
- avatar_url text nullable
- created_at timestamptz
- updated_at timestamptz
```

### 8.2 Problem

```text
problems
- id uuid primary key
- owner_id uuid nullable
- visibility enum: seeded | private
- title text
- slug text
- description_markdown text
- difficulty enum: easy | medium | hard
- tags text[]
- constraints_markdown text nullable
- examples jsonb
- interviewer_notes_markdown text nullable
- created_at timestamptz
- updated_at timestamptz
```

Starter code should be stored separately by language.

```text
problem_starter_code
- id uuid primary key
- problem_id uuid
- language enum
- code text
- created_at timestamptz
- updated_at timestamptz
- unique(problem_id, language)
```

### 8.3 Interview session

```text
interview_sessions
- id uuid primary key
- interviewer_id uuid
- problem_id uuid nullable
- title text
- status enum: waiting | active | paused | completed | cancelled
- language enum
- editing_policy enum: candidate_only | collaborative | interviewer_only
- duration_seconds integer
- started_at timestamptz nullable
- ended_at timestamptz nullable
- timer_state jsonb
- final_code text nullable
- final_whiteboard jsonb nullable
- created_at timestamptz
- updated_at timestamptz
```

### 8.4 Participant

```text
session_participants
- id uuid primary key
- session_id uuid
- user_id uuid nullable
- display_name text
- role enum: interviewer | candidate
- joined_at timestamptz nullable
- left_at timestamptz nullable
- created_at timestamptz
```

A session must have exactly one interviewer. The MVP permits one candidate.

### 8.5 Invitation

Store only a hash of the raw invitation token.

```text
session_invitations
- id uuid primary key
- session_id uuid
- token_hash text unique
- expires_at timestamptz
- consumed_at timestamptz nullable
- revoked_at timestamptz nullable
- created_at timestamptz
```

### 8.6 Structured session event

```text
session_events
- id uuid primary key
- session_id uuid
- sequence bigint
- actor_participant_id uuid nullable
- type text
- schema_version integer
- payload jsonb
- occurred_at timestamptz
- created_at timestamptz
- unique(session_id, sequence)
```

### 8.7 Yjs updates and snapshots

```text
code_updates
- id uuid primary key
- session_id uuid
- sequence bigint
- actor_participant_id uuid nullable
- update bytea
- occurred_at timestamptz
- unique(session_id, sequence)
```

```text
code_snapshots
- id uuid primary key
- session_id uuid
- through_sequence bigint
- state_update bytea
- plain_text text
- created_at timestamptz
```

### 8.8 Whiteboard snapshots

```text
whiteboard_snapshots
- id uuid primary key
- session_id uuid
- through_sequence bigint
- canvas_json jsonb
- created_at timestamptz
```

Indexes must support:

- Sessions by interviewer and creation date.
- Events by session and sequence.
- Code updates by session and sequence.
- Invitations by token hash.
- Problems by owner, visibility, difficulty, and tags.

---

## 9. Authentication and authorization

### 9.1 Interviewer authentication

Interviewer accounts use Supabase Auth.

Initial providers:

- Google OAuth.
- Email magic link or email/password, whichever is faster to implement cleanly.

The web application obtains a Supabase access token and sends it to the backend using:

```text
Authorization: Bearer <access-token>
```

The backend must verify the token. Never trust decoded JWT claims without signature and expiry verification.

### 9.2 Candidate guest authentication

Candidates should not be required to create an account.

Recommended flow:

1. Candidate opens `/join/[inviteToken]`.
2. Web app calls the backend to inspect the invitation.
3. Candidate submits a display name.
4. Backend hashes and validates the invitation token.
5. Backend creates or updates the candidate participant.
6. Backend returns a short-lived, room-scoped guest token.
7. The token contains only the minimum required claims:
   - participant ID
   - session ID
   - role
   - expiry
8. The token is used for room WebSocket and Yjs authorization.

Prefer an HttpOnly secure cookie where practical. If a collaboration provider requires an explicit token, keep it in memory rather than local storage.

### 9.3 Normalized backend principal

Normalize authenticated users and guests into one internal type:

```ts
type AuthPrincipal =
  | {
      kind: "user";
      userId: string;
      participantId?: string;
    }
  | {
      kind: "guest";
      participantId: string;
      sessionId: string;
      role: "candidate";
    };
```

Do not spread Supabase-specific auth logic throughout feature modules.

### 9.4 Role permissions

#### Interviewer

Can:

- Create sessions.
- Select or change a problem before the session starts.
- Set language and duration.
- Start, pause, resume, extend, and end the timer.
- End or cancel a session.
- Change editor access policy.
- Read session history they own.
- Replay completed sessions.
- Use the whiteboard.
- Edit code only when policy permits.

#### Candidate

Can:

- Join a valid invited session.
- View the assigned problem.
- Edit code when policy permits.
- Use the whiteboard.
- View timer and connection state.
- Leave the session.

Cannot:

- Change the problem.
- Control the timer.
- End the session.
- View unrelated sessions or interview history.
- Change editing policy.

Enforce permissions on the backend and collaboration server, not only in the UI.

---

## 10. Interview workspace UX

The application is desktop-first.

### Main layout

```text
┌───────────────────────────────────────────────────────────────┐
│ Room title | Presence | Connection | Timer | End session      │
├──────────────────┬────────────────────────────────────────────┤
│ Problem panel    │ [Code] [Whiteboard] [Split]                │
│                  │                                            │
│ Description      │ Active workspace                           │
│ Examples         │                                            │
│ Constraints      │                                            │
│ Notes            │                                            │
├──────────────────┴────────────────────────────────────────────┤
│ Language | Editing policy | Session status                    │
└───────────────────────────────────────────────────────────────┘
```

### Workspace modes

- **Code**: Monaco uses the full workspace.
- **Whiteboard**: Fabric.js canvas uses the full workspace.
- **Split**: Monaco and whiteboard are visible together.

Default split ratio:

- Code: approximately 60–70%.
- Whiteboard: approximately 30–40%.

The user should be able to resize the split.

### Problem panel

The panel should be:

- Collapsible.
- Scrollable independently.
- Readable without covering collaboration controls.

### Mobile behavior

The active interview room does not need a full mobile editing experience for the MVP.

On narrow screens:

- Show a clear desktop recommendation.
- Permit read-only viewing when reasonable.
- Do not ship a broken compressed editor/whiteboard layout.

### Accessibility

At minimum:

- Keyboard-accessible controls.
- Visible focus states.
- Proper labels for icon buttons.
- Semantic headings.
- Sufficient contrast.
- Reduced-motion respect.
- Timer status announced without noisy per-second screen-reader updates.

---

## 11. Monaco and Yjs collaboration

### 11.1 Canonical model

Each session has one Yjs document for code.

Recommended document name:

```text
session:<sessionId>:code
```

The shared code is stored in:

```ts
ydoc.getText("monaco");
```

### 11.2 Client integration

The web client creates:

- `Y.Doc`
- Hocuspocus or compatible Yjs provider
- `MonacoBinding`
- Awareness state

Awareness may include:

```ts
type EditorAwareness = {
  participantId: string;
  displayName: string;
  role: "interviewer" | "candidate";
  cursorColorToken: string;
};
```

Do not store sensitive user data in awareness.

### 11.3 Editing policy

Default policy:

```text
candidate_only
```

Supported policies:

- `candidate_only`
- `collaborative`
- `interviewer_only`

The interviewer controls policy through a backend-authorized room command.

The UI sets Monaco to read-only when the current participant lacks permission. The Yjs server must also reject unauthorized document updates where practical. UI-only read-only mode is not sufficient authorization.

### 11.4 Initial content

When creating the session document:

1. Load the selected problem's starter code.
2. Initialize the Yjs document only if it has no existing content.
3. Never overwrite a non-empty collaborative document during reconnection.

### 11.5 Persistence

The backend must:

- Listen for Yjs document updates.
- Batch small updates for persistence.
- Assign a monotonic sequence for stored update chunks.
- Store periodic full Yjs state snapshots.
- Store a plain-text projection with each full snapshot.
- Create a final snapshot when the session ends.

Suggested initial policy:

- Batch updates over a short window such as 250–500 ms.
- Create a full snapshot every 30–60 seconds or after a configurable update threshold.
- Flush pending updates before completing the session.

Make thresholds configurable. Do not hard-code them across multiple files.

### 11.6 Reconnection

On reconnection:

- Authenticate again.
- Rejoin the Yjs document.
- Allow Yjs to merge missing changes.
- Restore awareness.
- Do not reinitialize starter code.
- Show `reconnecting`, `connected`, or `offline` status in the UI.

### 11.7 Undo and redo

Use Yjs-aware undo/redo behavior for collaborative code.

Do not replace shared content with whole-document strings for ordinary undo operations.

### 11.8 Replay

Code replay is based on:

- A nearest earlier full snapshot.
- Ordered Yjs update chunks after that snapshot.
- Playback timestamps.

The replay UI uses a read-only Monaco instance.

The first replay version needs:

- Play.
- Pause.
- Seek.
- 0.5×, 1×, 2×, and 4× speed.
- Current replay timestamp.
- Final-code shortcut.

Exact per-keystroke timing is not required. Batched updates are acceptable.

---

## 12. Fabric.js whiteboard collaboration

### 12.1 Access model

Both interviewer and candidate can use the whiteboard simultaneously by default.

Typical uses:

- Trees and graphs.
- Linked lists.
- Dynamic programming tables.
- Algorithm flow.
- System architecture.
- API or data-flow diagrams.
- Edge-case explanation.

### 12.2 MVP tools

Implement:

- Select/move.
- Freehand pen.
- Line.
- Arrow.
- Rectangle.
- Ellipse.
- Text.
- Eraser or object delete.
- Undo.
- Redo.
- Clear canvas.
- Zoom and pan if it does not destabilize synchronization.

Do not add sticky notes, images, templates, comments, or complex grouping before the core tools are reliable.

### 12.3 Stable object identity

Every synchronized Fabric object must have application metadata with a stable ID.

Example:

```ts
type WhiteboardObjectMetadata = {
  objectId: string;
  createdBy: string;
  version: number;
};
```

Persist custom metadata through Fabric serialization.

Do not use array position as object identity.

### 12.4 Operation protocol

Synchronize semantic operations rather than sending the full canvas on every pointer movement.

Supported operations:

```ts
type WhiteboardOperation =
  | { kind: "object.add"; object: SerializedCanvasObject }
  | {
      kind: "object.modify";
      objectId: string;
      version: number;
      patch: Partial<SerializedCanvasObject>;
    }
  | { kind: "object.remove"; objectId: string; version: number }
  | { kind: "canvas.clear" };
```

Each operation is wrapped in the standard room event envelope.

### 12.5 Interaction behavior

- Apply local operations optimistically.
- Send finalized object changes after an interaction.
- Do not persist every `object:moving` frame.
- Cursor/pointer previews may be throttled and broadcast as ephemeral events.
- Remote operations must not trigger a duplicate outbound local operation.
- Maintain a guard such as `isApplyingRemoteOperation`.

### 12.6 Conflict strategy

For the MVP:

- Use server ordering for operations.
- Use last-write-wins per object.
- Reject stale object versions where possible.
- If an object update is rejected, request the current object or canvas snapshot.

Do not build a CRDT for Fabric.js objects in the MVP.

### 12.7 Whiteboard persistence

Store:

- Ordered meaningful whiteboard operations as session events.
- Periodic full serialized canvas snapshots.
- Final canvas JSON at session completion.

Suggested snapshot policy:

- Every 30–60 seconds.
- Every 50 accepted operations.
- At session completion.
- On explicit recovery checkpoints.

Whiteboard replay is not required initially. The completed-session page must show the final whiteboard.

---

## 13. Timer design

The timer is server-authoritative.

Do not broadcast a decrement event every second.

### Timer state

```ts
type TimerState =
  | {
      status: "idle";
      durationMs: number;
    }
  | {
      status: "running";
      durationMs: number;
      startedAt: string;
      endsAt: string;
      accumulatedPausedMs: number;
    }
  | {
      status: "paused";
      durationMs: number;
      remainingMs: number;
      pausedAt: string;
      accumulatedPausedMs: number;
    }
  | {
      status: "finished";
      durationMs: number;
      finishedAt: string;
    };
```

The server broadcasts state transitions:

- Start.
- Pause.
- Resume.
- Extend.
- Finish.

Clients calculate display time locally from the authoritative timestamps.

Periodically correct drift, but do not generate persistent events every second.

Only the interviewer may mutate timer state.

---

## 14. Realtime room protocol

### 14.1 Standard envelope

All non-Yjs realtime events use a versioned envelope.

```ts
type RoomEvent<TType extends string, TPayload> = {
  eventId: string;
  roomId: string;
  type: TType;
  schemaVersion: 1;
  actorParticipantId: string | null;
  clientEventId?: string;
  sequence?: number;
  occurredAt: string;
  payload: TPayload;
};
```

Rules:

- Clients generate `clientEventId` for idempotency.
- Server generates `eventId`, `sequence`, and authoritative `occurredAt`.
- Persisted room events have a monotonic sequence per session.
- Validate every payload with Zod.
- Unknown event types should return a structured error and not crash the socket.

### 14.2 Core event names

Use a consistent namespace.

#### Connection and room state

```text
room.join
room.joined
room.state
room.error
presence.changed
participant.disconnected
participant.reconnected
```

#### Session lifecycle

```text
session.started
session.paused
session.resumed
session.completed
session.cancelled
```

#### Editor policy

```text
editor.policy.requested
editor.policy.changed
```

#### Timer

```text
timer.start
timer.pause
timer.resume
timer.extend
timer.state
timer.finished
```

#### Problem and language

```text
problem.selected
language.changed
```

#### Whiteboard

```text
whiteboard.operation
whiteboard.snapshot.request
whiteboard.snapshot
whiteboard.pointer
```

Do not send Yjs document updates through the general room-event protocol.

### 14.3 Presence

Presence state includes:

- Participant ID.
- Display name.
- Role.
- Connected/disconnected state.
- Last-seen timestamp.
- Current workspace mode where useful.

Presence must tolerate temporary disconnects. Do not immediately treat every socket drop as a permanent leave.

### 14.4 Reconnection recovery

After room reconnection:

1. Verify the principal.
2. Confirm session access.
3. Rejoin the room.
4. Send current authoritative room state.
5. Send current participant presence.
6. Send latest whiteboard snapshot and missing operations.
7. Yjs independently synchronizes the code document.
8. Restore timer state.
9. Mark the participant connected.

---

## 15. REST API outline

Use a versioned API prefix:

```text
/api/v1
```

### Health

```text
GET /api/v1/health
GET /api/v1/ready
```

### Current user

```text
GET /api/v1/me
```

### Problems

```text
GET    /api/v1/problems
POST   /api/v1/problems
GET    /api/v1/problems/:problemId
PATCH  /api/v1/problems/:problemId
DELETE /api/v1/problems/:problemId
```

Only owners can mutate private custom problems. Seeded problems are read-only.

### Sessions

```text
POST   /api/v1/sessions
GET    /api/v1/sessions
GET    /api/v1/sessions/:sessionId
PATCH  /api/v1/sessions/:sessionId
POST   /api/v1/sessions/:sessionId/start
POST   /api/v1/sessions/:sessionId/end
POST   /api/v1/sessions/:sessionId/cancel
```

### Invitations

```text
POST /api/v1/sessions/:sessionId/invitations
GET  /api/v1/invitations/:rawToken
POST /api/v1/invitations/:rawToken/join
POST /api/v1/sessions/:sessionId/invitations/revoke
```

Never return stored token hashes.

### Replay

```text
GET /api/v1/sessions/:sessionId/replay/manifest
GET /api/v1/sessions/:sessionId/replay/code
GET /api/v1/sessions/:sessionId/final-artifacts
```

### API conventions

- JSON request and response bodies.
- Consistent error envelope.
- Cursor pagination for history when needed.
- ISO 8601 UTC timestamps.
- Explicit enum values.
- No silent coercion of malformed inputs.
- No raw database errors exposed to clients.

Suggested error shape:

```ts
type ApiError = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
};
```

---

## 16. Session transcript

The transcript is an event stream, not a screen recording.

### Persist these event categories

- Participant joined.
- Participant disconnected.
- Participant reconnected.
- Session started.
- Session paused.
- Session resumed.
- Session completed.
- Problem selected.
- Language changed.
- Editing policy changed.
- Timer state changed.
- Whiteboard object added.
- Whiteboard object modified.
- Whiteboard object removed.
- Canvas cleared.
- Code update chunk persisted.
- Code snapshot created.
- Whiteboard snapshot created.

### Do not persist

- Every cursor movement.
- Every pointer frame.
- Every timer tick.
- Hover events.
- Local UI tab changes unless later useful for replay.

### Event requirements

Every persisted event must have:

- Session ID.
- Sequence.
- Type.
- Schema version.
- Actor when known.
- Occurrence timestamp.
- Validated payload.

Transcript insertion must not block the realtime path for long. Use in-process batching for the MVP, flush at important lifecycle boundaries, and log failures.

Do not add Redis or a message queue merely to avoid writing a small batching service.

---

## 17. Frontend state management

### TanStack Query

Use for server-backed data:

- Current user.
- Problem list.
- Session list.
- Session details.
- Replay manifest.
- Final artifacts.

### Zustand

Use only for local application state that is shared across unrelated components:

- Workspace mode.
- Sidebar visibility.
- Split-panel preferences.
- Non-canonical connection UI state.

### Yjs

Use for collaborative code and editor awareness.

### Fabric.js

Use as the active whiteboard object model.

Do not mirror entire Yjs or Fabric.js state into Zustand. Doing so creates synchronization bugs and unnecessary renders.

---

## 18. Database access rules

- All schema changes require a migration.
- Never edit an already-applied migration.
- Prefer additive migrations.
- Destructive migrations require explicit user approval.
- Use database transactions for multi-step state transitions.
- Enforce ownership and uniqueness with database constraints where possible.
- Use UTC timestamps.
- Keep IDs opaque.
- Hash invitation tokens before storage.
- Do not log raw tokens, authorization headers, or service-role keys.
- Seed data must be deterministic and idempotent.
- Test data must not be mixed with production seed data.

### Supabase access

The browser may use the public anonymous key for Supabase Auth.

The Supabase service-role key:

- Is backend-only.
- Must never use a `NEXT_PUBLIC_` prefix.
- Must never appear in browser bundles.
- Must never be committed.

Application authorization still belongs in the Fastify backend, even when database RLS also exists.

---

## 19. Environment variables

Maintain root and application-specific `.env.example` files when appropriate.

Suggested variables:

```bash
# Shared
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:4000
WS_URL=ws://localhost:4000

# Web: public
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# API
HOST=0.0.0.0
PORT=4000
LOG_LEVEL=info
DATABASE_URL=
DIRECT_DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
INVITE_TOKEN_PEPPER=
GUEST_JWT_SECRET=
CORS_ALLOWED_ORIGINS=http://localhost:3000

# Collaboration tuning
YJS_UPDATE_BATCH_MS=400
YJS_SNAPSHOT_INTERVAL_MS=45000
YJS_SNAPSHOT_UPDATE_THRESHOLD=100
WHITEBOARD_SNAPSHOT_INTERVAL_MS=45000
WHITEBOARD_SNAPSHOT_OPERATION_THRESHOLD=50

# Optional later
REDIS_URL=
```

Validate environment variables at process startup with Zod.

Fail clearly when a required variable is missing. Do not scatter `process.env` access across the codebase.

---

## 20. Local development

### Prerequisites

- Node.js supported by the lockfile and dependencies.
- Corepack.
- pnpm.
- Docker for local PostgreSQL when not using a development Supabase project.
- Supabase CLI only if the repository adopts local Supabase services.

### Expected commands

The root package must expose these commands:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm format
pnpm format:check
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:studio
```

When Docker Compose is included:

```bash
pnpm infra:up
pnpm infra:down
```

Do not claim a command works until it has been run successfully or its limitation is documented.

### Development ports

Default ports:

```text
Web:      3000
API/WS:   4000
Postgres: 5432
```

Avoid adding more local services without need.

---

## 21. Testing strategy

### 21.1 Unit tests

Write unit tests for:

- Permission policies.
- Timer state transitions.
- Invitation token hashing and expiry.
- Event validation.
- Event ordering and idempotency.
- Whiteboard operation reducers.
- Replay timeline calculations.
- Environment validation.
- Domain state machines.

### 21.2 Backend integration tests

Use Fastify injection where possible.

Cover:

- Authenticated session creation.
- Guest invitation exchange.
- Invalid, expired, used, and revoked invitation tokens.
- Session ownership.
- Problem CRUD permissions.
- Timer commands.
- Session completion.
- Replay manifest authorization.

Use a real test database for repository-level behavior.

### 21.3 Realtime tests

Test:

- Interviewer and candidate room join.
- Unauthorized room access rejection.
- Presence updates.
- Duplicate `clientEventId` handling.
- Event sequencing.
- Reconnection state recovery.
- Whiteboard operation propagation.
- Stale whiteboard object update handling.
- Unauthorized timer commands.
- Unauthorized editor-policy changes.

### 21.4 Collaboration tests

Test:

- Starter code initializes once.
- Two Yjs clients converge.
- Offline changes merge after reconnection.
- Read-only participants cannot submit updates when policy forbids editing.
- A final code snapshot is written on session completion.
- Replay reconstructs the expected code at selected checkpoints.

### 21.5 End-to-end tests

Use Playwright with two browser contexts.

Critical E2E scenario:

1. Sign in or use a test interviewer session.
2. Create an interview.
3. Open the candidate invitation in a second context.
4. Join as candidate.
5. Start the timer.
6. Edit code.
7. Draw a whiteboard object.
8. Verify both contexts receive updates.
9. Disconnect and reconnect one context.
10. Verify state restoration.
11. End the session.
12. Open history.
13. Verify final code and replay.

### 21.6 Quality gates

Before considering a change complete, run the relevant subset of:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For collaboration, room, or replay changes, also run the relevant Playwright tests.

If a command cannot run because required infrastructure or credentials are unavailable, state that clearly in the task summary. Do not report unrun tests as passing.

---

## 22. Coding standards

### TypeScript

- Use strict mode.
- Avoid `any`.
- Prefer `unknown` plus validation.
- Use discriminated unions for state machines and event payloads.
- Avoid unsafe type assertions.
- Export explicit public types.
- Keep framework-specific types at module boundaries.
- Prefer named functions for domain operations.
- Use exhaustive checks for important enums.

### Validation

Use Zod at:

- API inputs.
- WebSocket messages.
- Environment startup.
- Parsed database JSON.
- Invitation and guest-token claims.
- External-service responses when assumptions matter.

Shared schemas should infer TypeScript types instead of duplicating interfaces.

### Naming

- React components: `PascalCase`.
- Hooks: `useSomething`.
- Functions and variables: `camelCase`.
- Constants: `UPPER_SNAKE_CASE` only for genuine constants.
- Files: use the repository's established convention consistently.
- Events: lowercase dot-separated namespaces.
- Database tables and columns: `snake_case`.
- Public TypeScript fields: `camelCase`, mapped at the database boundary.

### Functions and modules

- Keep functions focused.
- Prefer composition over large service classes.
- Avoid generic `utils.ts` dumping grounds.
- Organize by feature/domain.
- Extract only when it improves ownership, reuse, or testability.
- Avoid abstracting code that has only one simple use.

### Error handling

- Return structured public errors.
- Preserve internal error causes in logs.
- Attach request or correlation IDs.
- Never leak stack traces, SQL text, secrets, or raw tokens.
- Do not swallow persistence failures.
- Realtime errors should be recoverable where possible.

### Logging

Use structured logs.

Include useful fields:

- requestId
- sessionId
- participantId
- eventType
- eventSequence
- durationMs
- errorCode

Never log:

- Authorization headers.
- Raw invite tokens.
- Guest JWTs.
- Supabase service keys.
- Full code documents by default.
- Sensitive candidate notes.

---

## 23. Security requirements

Security is part of the MVP.

Implement:

- Backend role checks.
- WebSocket authentication.
- Hocuspocus/Yjs connection authorization.
- Invitation expiry and revocation.
- Hashed invitation tokens.
- Short-lived guest credentials.
- Origin and CORS restrictions.
- Payload-size limits.
- Rate limits for room joining and high-frequency events.
- Zod validation.
- Secure production cookies.
- No secrets in client bundles.
- Database ownership checks.
- Safe Markdown rendering.
- Sanitization or restriction for user-created problem content.
- Protection against replaying consumed invitation tokens where policy requires one-time use.

### Room isolation

A participant in one session must never:

- Subscribe to another session's room.
- Open another session's Yjs document.
- Read another interviewer's history.
- Retrieve another session's replay.
- Mutate another room by changing a client-supplied session ID.

Always derive or verify access server-side.

### Candidate privacy

Do not expose candidate session data publicly.

Read-only replay sharing is not part of the MVP unless explicitly requested.

---

## 24. Performance guidelines

Initial target:

- Two active collaborators per room.
- Many independent rooms.
- Smooth local drawing.
- Typing updates that feel immediate.
- Recovery after ordinary transient disconnects.

Guidelines:

- Throttle ephemeral pointer events.
- Batch database writes.
- Avoid full-canvas broadcasts on every change.
- Avoid full-code-string broadcasts; use Yjs updates.
- Avoid timer ticks over the network.
- Use snapshots to bound replay and recovery work.
- Paginate interview history.
- Avoid rerendering the entire room on cursor changes.
- Dynamically import browser-only heavy libraries such as Monaco and Fabric.js where appropriate.
- Measure before adding caching.

---

## 25. Redis policy

Redis is intentionally deferred.

Add Redis only when at least one is true:

- The backend runs more than one instance.
- Room events need cross-instance pub/sub.
- Presence must be shared across instances.
- Connection routing requires shared ephemeral state.
- Database load measurements justify caching.
- Background work requires a durable queue.

Before adding Redis, write an architecture decision record explaining:

- The measured or deployment-driven problem.
- Why in-process state is insufficient.
- Key expiry strategy.
- Failure behavior.
- Local-development impact.

Do not use Redis as the canonical store for completed sessions.

---

## 26. Deployment requirements

### Vercel

Deploy only the Next.js web application.

Do not rely on Vercel serverless functions for persistent interview-room WebSockets.

### Railway

Deploy the Fastify/Hocuspocus backend as a long-running service.

Requirements:

- Health endpoint.
- Readiness endpoint.
- Graceful shutdown.
- Flush pending transcript and collaboration batches on shutdown where possible.
- Environment variables configured through the platform.
- Production CORS/origin allowlist.
- Structured logs.

### Supabase

Use:

- Auth.
- PostgreSQL.
- Optional Storage later.

Migrations must run through a controlled deployment step. Do not run unsafe schema mutations automatically on every application startup.

---

## 27. Documentation requirements

Keep these documents current as their corresponding features are implemented:

### `README.md`

Include:

- Product summary.
- Architecture overview.
- Screenshots or demo GIF later.
- Local setup.
- Environment variables.
- Development commands.
- Test commands.
- Deployment links.
- Known limitations.
- Roadmap.

### `docs/architecture.md`

Include:

- Container/component diagram.
- State ownership.
- Authentication flows.
- Realtime boundaries.
- Persistence strategy.

### `docs/realtime-protocol.md`

Include:

- WebSocket event envelope.
- Event schemas.
- Sequence and idempotency behavior.
- Reconnection flow.
- Whiteboard protocol.
- Yjs route and authorization.

### `docs/data-model.md`

Include:

- Tables.
- Relationships.
- Important constraints.
- Indexes.
- Retention considerations.

### `docs/decisions/`

Use architecture decision records for meaningful changes such as:

- Replacing Fastify.
- Splitting Hocuspocus into another service.
- Adding Redis.
- Changing ORM.
- Adding a code runner.
- Replacing Fabric.js.
- Enabling public replay links.

---

## 28. Git and change-management rules

Before editing:

1. Read this file.
2. Read the relevant feature code and documentation.
3. Check the current git status.
4. Identify the smallest complete change.
5. Avoid overwriting unrelated user work.

During implementation:

- Keep changes scoped.
- Do not reformat unrelated files.
- Do not rename broad directory trees without need.
- Do not upgrade unrelated dependencies.
- Do not delete failing tests merely to pass CI.
- Add or update tests for behavior changes.
- Add migrations for schema changes.
- Update documentation when contracts or architecture change.

Commit style, when commits are requested:

```text
feat(scope): concise description
fix(scope): concise description
test(scope): concise description
docs(scope): concise description
refactor(scope): concise description
chore(scope): concise description
```

Suggested scopes:

```text
web
api
auth
sessions
collab
whiteboard
timer
replay
db
infra
docs
```

---

## 29. Agent execution protocol

### When asked to “start development”

Do not implement the whole roadmap.

1. Inspect the repository.
2. Find the earliest incomplete milestone.
3. Implement that milestone or a coherent vertical slice.
4. Run relevant quality checks.
5. Report:
   - What changed.
   - Important design decisions.
   - Tests run.
   - Tests not run and why.
   - Remaining next step.

### When requirements are ambiguous

Prefer the defaults in this file.

Ask the user only when the ambiguity materially affects:

- Product scope.
- Security.
- Data loss.
- Destructive migration.
- Paid external services.
- Public exposure.
- A major architectural dependency.

For minor visual or implementation details, make a reasonable decision and document it.

### When tests fail

- Investigate the failure.
- Fix failures caused by the change.
- Do not hide or disable tests.
- If a pre-existing failure is clearly unrelated, report it with evidence.

### When adding dependencies

Before adding a package:

- Confirm an existing dependency does not already solve the problem.
- Prefer actively maintained, focused packages.
- Avoid overlapping state-management or validation libraries.
- Explain major runtime dependencies in the task summary.
- Do not add a dependency for trivial helpers.

### When editing contracts

Changes to REST, WebSocket, database, or replay contracts require:

- Runtime schema update.
- Shared type update.
- Producer update.
- Consumer update.
- Tests.
- Documentation update.

---

## 30. Milestone plan

### Milestone 0 — Repository bootstrap

Deliver:

- pnpm workspace.
- Turborepo configuration.
- Next.js app.
- Fastify app.
- Shared contracts package.
- Database package.
- Strict TypeScript.
- ESLint and formatting.
- Vitest.
- Playwright skeleton.
- Environment validation.
- Health and readiness endpoints.
- Root scripts.
- CI workflow.
- Basic README.

Acceptance criteria:

- `pnpm install` succeeds.
- `pnpm dev` starts web and API.
- Web can call API health endpoint.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
- No product feature is faked.

### Milestone 1 — Authenticated interviewer dashboard

Deliver:

- Supabase Auth integration.
- Protected dashboard.
- Profile bootstrap.
- Session list empty state.
- Sign-in/sign-out.
- Backend JWT verification.

Acceptance criteria:

- Unauthenticated users cannot access dashboard APIs.
- Authenticated users can retrieve `/me`.
- Service-role credentials never reach the browser.

### Milestone 2 — Problems and session creation

Deliver:

- Drizzle schema and migrations.
- Seeded problems.
- Problem search/filter.
- Session creation form.
- Session detail page.
- Secure invitation generation.

Acceptance criteria:

- Interviewer can create a waiting session.
- Invitation stores only a token hash.
- Session appears in the owner’s history.
- Another user cannot read it.

### Milestone 3 — Candidate waiting room and presence

Deliver:

- Invitation inspection.
- Candidate display-name form.
- Guest token exchange.
- Room WebSocket authentication.
- Interviewer/candidate presence.
- Connection status.
- Waiting-to-active transition.

Acceptance criteria:

- Valid candidate joins.
- Invalid/expired/revoked invite fails safely.
- Two browser contexts see correct presence.
- Unauthorized room joins are rejected.

### Milestone 4 — Monaco collaboration

Deliver:

- Monaco integration.
- Hocuspocus/Yjs backend.
- y-monaco binding.
- Awareness cursors.
- Starter code initialization.
- Editing policy.
- Reconnection.
- Yjs update persistence and snapshots.

Acceptance criteria:

- Two clients converge on the same code.
- Candidate edits appear to interviewer.
- Editing policy is enforced.
- Reconnection restores content.
- Final snapshot persists.

### Milestone 5 — Whiteboard collaboration

Deliver:

- Fabric.js canvas.
- Core drawing tools.
- Stable object IDs.
- Operation protocol.
- Pointer presence.
- Canvas snapshots.
- Reconnection recovery.

Acceptance criteria:

- Both users can add, modify, and remove objects.
- Remote operations do not echo infinitely.
- Stale operations are handled safely.
- Latest canvas restores after reconnect.

### Milestone 6 — Timer and full session lifecycle

Deliver:

- Server-authoritative timer.
- Start, pause, resume, extend, finish.
- Session start/end.
- Final artifact flush.
- Completed-session view.

Acceptance criteria:

- Both clients display nearly identical time.
- Candidate cannot control timer.
- Refresh restores timer state.
- Ending a session locks further mutation and persists final artifacts.

### Milestone 7 — Transcript, history, and replay

Deliver:

- Ordered session events.
- Code update timeline.
- Snapshot-assisted replay.
- Interview history.
- Session summary.
- Final code and final whiteboard.

Acceptance criteria:

- Interviewer sees owned completed sessions.
- Replay reconstructs code progression.
- Seeking does not replay from the beginning when a suitable snapshot exists.
- Candidates cannot browse history.

### Milestone 8 — Reliability and portfolio polish

Deliver:

- Two-context Playwright suite.
- Reconnect tests.
- Rate limits.
- Payload-size limits.
- Better loading/error/empty states.
- Accessibility pass.
- Architecture diagrams.
- Deployment configuration.
- Demo seed data.
- Production README.
- Public deployed demo.

Acceptance criteria:

- Critical E2E flow passes.
- Deployment health checks pass.
- No secrets are committed.
- Recruiter can understand architecture from README in a few minutes.

---

## 31. Initial bootstrap task for an empty repository

When the repository contains only this file or is otherwise empty, the first implementation task is **Milestone 0 only**.

Perform these steps:

1. Initialize a pnpm workspace.
2. Add Turborepo.
3. Create `apps/web` using Next.js App Router and TypeScript.
4. Create `apps/api` using Fastify and TypeScript.
5. Create `packages/contracts`, `packages/database`, and `packages/config`.
6. Configure strict shared TypeScript settings.
7. Configure linting and formatting.
8. Add environment validation.
9. Add API `/api/v1/health` and `/api/v1/ready`.
10. Add a simple web landing page that calls or displays API health.
11. Add Vitest unit tests for environment parsing and health routes.
12. Add a Playwright configuration and one basic web smoke test.
13. Add root commands listed in this file.
14. Add `.env.example`.
15. Add a minimal Docker Compose PostgreSQL service.
16. Add CI that installs, lints, type-checks, tests, and builds.
17. Write local setup instructions in `README.md`.

Do not add Supabase Auth, Monaco, Yjs, Fabric.js, Redis, or deployment configuration in the same bootstrap change unless required only as a harmless placeholder. Avoid unused dependencies.

---

## 32. Definition of done

A feature is done only when:

- The user-visible behavior works.
- Backend authorization is enforced.
- Inputs are runtime-validated.
- Persistent changes have migrations.
- Errors are handled.
- Loading and empty states are considered.
- Relevant tests exist and pass.
- Type-checking passes.
- Linting passes.
- Documentation is updated.
- No secrets or debug artifacts are committed.
- The implementation does not violate MVP non-goals.

A mock UI without the corresponding backend behavior is not complete.

---

## 33. Final product principles

Keep the product:

- Focused.
- Reliable.
- Secure by default.
- Easy to demo.
- Easy to understand from the repository.
- Architecturally intentional without unnecessary complexity.

The strongest portfolio story is not the number of features. It is the clear demonstration of:

- Real-time systems.
- CRDT-based collaboration.
- WebSocket protocol design.
- Role-based authorization.
- State ownership.
- Reconnection recovery.
- Event sourcing concepts.
- Snapshot-based replay.
- Full-stack TypeScript.
- Production-minded testing and deployment.
