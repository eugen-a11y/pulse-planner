# Pulse Project Planner — Foundation (Phase 1) Design

**Date:** 2026-05-09
**Status:** Draft (awaiting user review)
**Phase:** 1 of 3 (Foundation)
**Owner:** eugen@reinfeld.me

## 1. Context

Pulse Project Planner is a single-user project management application
synchronized between a Windows desktop (Electron EXE) and an iOS app
(React Native + Expo). Inspired by Banana-Split (an Electron-based
"Projekt-Management für Affen-Griff" tool installed at
`%LOCALAPPDATA%\Programs\Banana-Split\`), it adds local notifications,
project progress bars, and a dashboard, with custom branding ("Pulse"
— minimal, electric blue) inspired by `pulsehamburg.de`.

Total scope is too large for a single spec. Implementation is split into
three sequential sub-projects, each with its own design/plan/build cycle:

1. **Phase 1 — Foundation (this spec)** — monorepo, data model,
   Supabase schema, sync engine, auth. No UI. Deliverable: two CLI
   processes can mutate the same dataset on different machines and
   converge correctly.
2. **Phase 2 — Desktop App** — Electron + React shell, dashboard,
   kanban, notifications, installer.
3. **Phase 3 — iOS App** — Expo + React Native shell, dashboard,
   notifications, EAS build to TestFlight/App Store.

This spec covers Phase 1 only.

## 2. Goals

- A working `packages/core` library that any UI can consume.
- A Supabase project with full schema, RLS, and Storage configured.
- An offline-first sync engine that handles the round-trip:
  *local mutation → outbox → Supabase → other device → local apply*.
- Authentication that produces a session usable across both UIs.
- Confidence via tests: two simulated clients converge on the same
  state under concurrent writes, network partitions, and re-connection.

## 3. Non-Goals (Phase 1)

- No GUI of any kind — Phase 2/3 own that.
- No multi-user / sharing — single account only. RLS exists from day
  one to make later multi-user feasible without migration.
- No realtime push notifications across devices — only local
  reminders, and those live in the device-specific app code (Phase 2/3).
- No file upload UX — but the storage bucket and policies are
  provisioned so the desktop/mobile apps can use them later.
- No web app, no integrations, no AI features.

## 4. Architecture Overview

```
┌────────────────────────────┐     ┌────────────────────────────┐
│  Desktop (Phase 2)         │     │  Mobile (Phase 3)          │
│  ─ Electron + React        │     │  ─ Expo + React Native     │
│  ─ better-sqlite3          │     │  ─ expo-sqlite             │
│  ─ keytar (token store)    │     │  ─ expo-secure-store       │
└──────────────┬─────────────┘     └─────────────┬──────────────┘
               │                                 │
               │ depends on                      │ depends on
               ▼                                 ▼
       ┌─────────────────────────────────────────────────┐
       │  packages/core   (this phase)                   │
       │  ─ Domain types + Zod schemas                   │
       │  ─ Repository interfaces (storage adapter)      │
       │  ─ SyncEngine (push/pull/realtime/conflict)     │
       │  ─ AuthService (Supabase wrapper)               │
       └────────────────────────┬────────────────────────┘
                                │
                                ▼
                   ┌───────────────────────┐
                   │  Supabase             │
                   │  ─ Postgres + RLS     │
                   │  ─ Auth (email/pass)  │
                   │  ─ Storage (bucket)   │
                   │  ─ Realtime (WS)      │
                   └───────────────────────┘
```

`packages/core` is platform-agnostic. SQLite access is abstracted behind
a `LocalStore` interface so the desktop app injects `better-sqlite3`
and the mobile app injects an `expo-sqlite` adapter. The sync engine,
auth service, validation, and domain types are 100 % shared.

## 5. Repository Layout

```
pulse-project-planner/
├── package.json                  # workspace root, scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example                  # SUPABASE_URL, SUPABASE_ANON_KEY
├── packages/
│   └── core/
│       ├── package.json
│       ├── src/
│       │   ├── domain/           # types + Zod schemas per entity
│       │   ├── store/            # LocalStore interface, in-memory impl
│       │   ├── sync/             # SyncEngine, Outbox, conflict logic
│       │   ├── auth/             # AuthService
│       │   ├── supabase/         # typed Supabase client factory
│       │   └── index.ts
│       └── test/
│           ├── unit/
│           └── integration/      # two simulated clients, real Supabase
├── supabase/
│   ├── config.toml
│   ├── migrations/               # numbered SQL files
│   └── seed.sql                  # optional smoke data
├── tools/
│   └── cli/                      # tiny CLI to mutate data, used in tests
└── docs/
    └── superpowers/specs/
        └── 2026-05-09-pulse-planner-foundation-design.md   # this file
```

**Tooling:**

- **Package manager:** pnpm (workspaces).
- **Language:** TypeScript 5.x, strict mode.
- **Validation:** Zod 3.x.
- **Test runner:** Vitest.
- **Linting:** ESLint + Prettier.
- **Supabase local dev:** Supabase CLI (`supabase start` runs Postgres
  in Docker).

## 6. Data Model

All tables share standard columns:

| Column        | Type        | Notes                                   |
|---------------|-------------|-----------------------------------------|
| `id`          | uuid        | Client-generated (uuid v7 for sortable) |
| `user_id`     | uuid        | `auth.uid()`, RLS filter                |
| `created_at`  | timestamptz | Set on insert                           |
| `updated_at`  | timestamptz | Set on every write (trigger)            |
| `deleted_at`  | timestamptz | NULL = active; soft-delete for sync     |

### Entities

```sql
-- Top-level grouping
CREATE TABLE projects (
  id           uuid PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users(id),
  name         text NOT NULL,
  color        text NOT NULL DEFAULT '#2563eb',
  archived     boolean NOT NULL DEFAULT false,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

-- Tasks (one level of subtasks via parent_task_id; parent must itself
-- have parent_task_id IS NULL — enforced by app layer + CHECK trigger)
CREATE TABLE tasks (
  id                    uuid PRIMARY KEY,
  user_id               uuid NOT NULL REFERENCES auth.users(id),
  project_id            uuid NOT NULL REFERENCES projects(id),
  parent_task_id        uuid REFERENCES tasks(id),
  title                 text NOT NULL,
  description           text,
  status                text NOT NULL DEFAULT 'todo'
                          CHECK (status IN ('todo','in_progress','done')),
  priority              integer NOT NULL DEFAULT 3
                          CHECK (priority BETWEEN 1 AND 4),
  due_date              timestamptz,
  completed_at          timestamptz,
  sort_order            integer NOT NULL DEFAULT 0,
  recurrence_rule       text,                 -- RFC 5545 RRULE
  recurrence_parent_id  uuid REFERENCES tasks(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

CREATE TABLE tags (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  name        text NOT NULL,
  color       text NOT NULL DEFAULT '#71717a',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (user_id, name)
);

CREATE TABLE task_tags (
  task_id     uuid NOT NULL REFERENCES tasks(id),
  tag_id      uuid NOT NULL REFERENCES tags(id),
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, tag_id)
);

CREATE TABLE attachments (
  id            uuid PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id),
  task_id       uuid NOT NULL REFERENCES tasks(id),
  storage_path  text NOT NULL,             -- attachments/{user}/{task}/{file}
  filename      text NOT NULL,
  mime          text NOT NULL,
  size_bytes    bigint NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE TABLE time_entries (
  id                uuid PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES auth.users(id),
  task_id           uuid NOT NULL REFERENCES tasks(id),
  started_at        timestamptz NOT NULL,
  ended_at          timestamptz,           -- NULL = running
  duration_seconds  integer,                -- denormalized on stop
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE TABLE comments (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  task_id     uuid NOT NULL REFERENCES tasks(id),
  body_md     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

-- Notes are attached to either a project or a task, not both.
CREATE TABLE notes (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  project_id  uuid REFERENCES projects(id),
  task_id     uuid REFERENCES tasks(id),
  body_md     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  CHECK ( (project_id IS NULL) <> (task_id IS NULL) )
);

CREATE TABLE activity_log (
  id           uuid PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users(id),
  entity_type  text NOT NULL,
  entity_id    uuid NOT NULL,
  action       text NOT NULL,            -- created/updated/deleted/status_changed
  payload      jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
  -- no updated_at/deleted_at — append-only
);
```

### RLS

Every table (except `activity_log`, which has the same policy) gets:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can all" ON <table>
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### Triggers

- `set_updated_at` BEFORE UPDATE on every entity table → `NEW.updated_at = now()`.
- `enforce_subtask_depth` BEFORE INSERT/UPDATE on `tasks` → reject when
  `parent_task_id` references a task whose `parent_task_id` is non-NULL.

### Indexes

```sql
CREATE INDEX ON tasks (user_id, project_id) WHERE deleted_at IS NULL;
CREATE INDEX ON tasks (user_id, due_date)   WHERE deleted_at IS NULL;
CREATE INDEX ON tasks (user_id, updated_at);   -- sync delta queries
CREATE INDEX ON time_entries (user_id, task_id);
CREATE INDEX ON comments (task_id);
-- Same `(user_id, updated_at)` index on every synced table.
```

### Local SQLite mirror

The local schema mirrors Postgres 1:1 with two additions:

```sql
-- Mutations queued for upload
CREATE TABLE outbox (
  id              integer PRIMARY KEY AUTOINCREMENT,
  entity_table    text    NOT NULL,
  entity_id       text    NOT NULL,            -- the row's uuid
  op              text    NOT NULL,            -- insert | update | delete
  changed_fields  text    NOT NULL,            -- JSON: {field: value}
  client_ts       text    NOT NULL,            -- ISO timestamp at mutation
  attempts        integer NOT NULL DEFAULT 0,
  last_error      text
);

-- Sync state, single row
CREATE TABLE sync_state (
  id                integer PRIMARY KEY CHECK (id = 1),
  last_pulled_at    text,                      -- ISO timestamp
  last_full_sync_at text
);
```

## 7. Sync Engine

### Sequencing

1. **Local mutation:**
   - Caller invokes `repo.tasks.update(id, {status: 'done'})`.
   - Local SQLite is updated inside a transaction.
   - In the same transaction an `outbox` row is appended:
     `(entity_table='tasks', entity_id, op='update',
      changed_fields={status: 'done'}, client_ts=now())`.
   - UI observes the local change immediately.

2. **Push (outbox drain):**
   - Triggered every 5 s when online, on app foreground, on network
     reconnect, and immediately after each local mutation.
   - Drain serially. For each entry:
     - For `update`: send `UPSERT` with the changed fields plus the
       row's `id`, `user_id`, and `client_ts` as `updated_at`.
       Server-side conflict resolution: see below.
     - For `insert`: full row.
     - For `delete`: set `deleted_at = client_ts`.
   - On 2xx: delete outbox row.
   - On 4xx (validation): mark `last_error`, leave row, surface to UI.
   - On 5xx / network: increment `attempts`, exponential backoff up to
     5 min, retry on next tick.

3. **Pull:**
   - Triggered on app start, every 60 s when online, on app foreground,
     and on Realtime notification.
   - For each table: `SELECT * WHERE user_id = me AND
     updated_at > sync_state.last_pulled_at ORDER BY updated_at`.
   - For each row: `INSERT … ON CONFLICT (id) DO UPDATE …` locally.
     - Crucially: if the local row has an outstanding outbox entry that
       changes a field also present in the pulled row, the outbox value
       wins for that field (it will be re-pushed). Other pulled fields
       still apply.
   - Update `sync_state.last_pulled_at = max(updated_at)`.

4. **Realtime:**
   - Subscribe to Supabase Realtime on all entity tables filtered by
     `user_id = auth.uid()`.
   - On notification: trigger an immediate pull (cheap delta).
   - Realtime is a hint, not a source of truth — the pull is what
     applies the state.

### Conflict resolution: Last-Write-Wins per field

Mutations carry only changed fields, not full rows. The Supabase write
becomes a partial update where we conditionally apply each field:

```sql
UPDATE tasks SET
  status = CASE WHEN updated_at < $client_ts THEN $status ELSE status END,
  …
  updated_at = GREATEST(updated_at, $client_ts)
WHERE id = $id AND user_id = auth.uid();
```

Implementation note: this is too unwieldy for direct SQL from the
client. Ship a **single Postgres function** `sync_upsert(entity_table,
id, changed_fields jsonb, client_ts)` that performs the per-field LWW
update inside the function. The client just calls
`rpc('sync_upsert', …)`.

For `insert`: standard `INSERT … ON CONFLICT (id) DO NOTHING`. If the
row already exists (rare; recovery from a partial push), treat the
insert as an update.

For `delete`: `UPDATE … SET deleted_at = client_ts WHERE
deleted_at IS NULL OR deleted_at > client_ts`.

### Identity & ordering

- IDs are **client-generated UUIDv7**. Sortable by creation time, no
  collisions, no round-trip needed.
- All timestamps are `timestamptz`. Client uses Date.now() converted to
  ISO. Clock skew between devices is acceptable up to a few seconds for
  LWW; document this trade-off in the README.

### Failure modes covered by tests

| Scenario | Expected outcome |
|---|---|
| Two clients update different fields of same task offline | Both fields survive after both reconnect |
| Two clients update *same* field offline, A first then B | B's value wins (later client_ts) |
| Client deletes task offline; other client updates it | Delete wins iff `delete.client_ts > update.client_ts` |
| Push fails mid-batch (network drop) | Failed entries retry, succeeded entries don't double-apply |
| Pull arrives during local mutation | Local mutation's outbox value wins for changed fields |
| Initial sync on fresh device | All non-deleted rows arrive, no duplicates |
| Storage attachment row references missing storage object | App handles 404, retains row, surfaces to UI later |

## 8. Authentication

- **Provider:** Supabase Auth, email + password. No magic links, no
  social login in v1.
- **AuthService API:**
  ```ts
  signUp(email, password): Promise<Session>
  signIn(email, password): Promise<Session>
  signOut(): Promise<void>
  getSession(): Promise<Session | null>
  onAuthStateChange(cb): Unsubscribe
  ```
- The session contains `access_token` (1-hour TTL) and `refresh_token`.
- Token storage is **not** implemented in `core` — it's injected by the
  host app via a `TokenStorage` interface (so desktop uses keytar and
  mobile uses expo-secure-store).
- Sync engine pauses while no session is present and resumes on sign-in.

## 9. CLI Test Harness

`tools/cli/` is a tiny TS CLI used by integration tests and manual
smoke checks:

```
pulse-cli signin <email> <password>
pulse-cli project create "Website"
pulse-cli task add --project=<name> --title="…" --due=2026-05-15 --priority=1
pulse-cli task list [--today|--overdue|--project=…]
pulse-cli task done <task_id>
pulse-cli sync-status
pulse-cli sync-now
```

Stores its SQLite DB in `~/.pulse-cli/db.sqlite`. This is the harness
the integration tests script to run two clients in parallel and assert
convergence.

## 10. Testing Strategy

- **Unit tests** (`packages/core/test/unit/`) — domain validators,
  conflict-resolution function in isolation, outbox queue ordering.
- **Integration tests** (`packages/core/test/integration/`) — spin up
  local Supabase via the Supabase CLI; instantiate two `SyncEngine`
  instances backed by separate in-memory SQLite databases. Drive the
  scenarios from the table in §7. Each test starts from a clean DB,
  performs a script of mutations with controlled "offline" windows,
  and asserts both clients converge to the same final state.
- **Test gate:** Phase 1 is "done" when all rows in the §7 failure-mode
  table pass.

## 11. Open Questions Deferred to Later Phases

- Dark mode tokens (Phase 2/3).
- Whether to encrypt the local SQLite at rest on desktop (Phase 2).
- Cross-device push notification routing (Phase 4 / "Polish").
- Auto-update strategy for the desktop installer (Phase 2).
- Apple Developer Account setup, bundle ID confirmation (Phase 3).

## 12. Phase 1 Acceptance Criteria

- [ ] `pnpm install && pnpm -r build` succeeds from a clean clone.
- [ ] `supabase start && supabase db reset` provisions the schema with
  all RLS policies and the `sync_upsert` function.
- [ ] `pnpm test` passes all unit tests and all scenarios from §7's
  failure-mode table.
- [ ] `pulse-cli` end-to-end smoke: a fresh user can sign up, create
  projects/tasks, sign in on a second machine, see the same data, and
  modify it concurrently with the expected LWW behavior.
- [ ] All entity tables enforce RLS (negative test: an unauthenticated
  client receives zero rows).
- [ ] README documents environment setup, the LWW trade-off, and
  clock-skew expectations.
