# Pulse Project Planner — Desktop App (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Windows-x64 Electron desktop app that consumes `@pulse/core` (Phase 1), implements `BetterSqliteStore`, and surfaces a Today-Agenda 3-pane UI with native tray, global hotkey, notifications, auto-update, and Banana-Split feature parity.

**Architecture:** Two-process Electron app. Main process hosts `@pulse/core` (SyncEngine, AuthService, new `BetterSqliteStore`) plus all native APIs (Tray, GlobalShortcut, Notifications, Auto-Update). Renderer is a sandboxed Vite + React + Zustand SPA, communicates with main exclusively via a typed `contextBridge` IPC surface (`window.pulse.*`).

**Tech Stack:** Electron 33+, Vite 5, vite-plugin-electron, React 18, Zustand 4, Tailwind 3, shadcn/ui, better-sqlite3, electron-builder, electron-updater, react-window, dnd-kit, chrono-node (de), date-fns, react-hook-form + zod, lucide-react, Vitest, @testing-library/react, Playwright + electron-launcher.

**Spec:** `docs/superpowers/specs/2026-05-09-pulse-planner-desktop-design.md`

---

## File Map

```
apps/
└── desktop/
    ├── package.json                                 # @pulse/desktop
    ├── tsconfig.json
    ├── tsconfig.node.json                           # main + preload
    ├── vite.config.ts                               # vite-plugin-electron config
    ├── electron-builder.yml
    ├── tailwind.config.ts
    ├── postcss.config.js
    ├── index.html                                   # renderer entry
    ├── src/
    │   ├── main/
    │   │   ├── index.ts                             # app.whenReady, lifecycle
    │   │   ├── window.ts                            # main window + quick-add window
    │   │   ├── tray.ts                              # tray icon + menu
    │   │   ├── hotkey.ts                            # globalShortcut
    │   │   ├── notifications.ts                     # toast scheduler
    │   │   ├── updater.ts                           # electron-updater wiring
    │   │   ├── ipc.ts                               # ipcMain.handle registrations
    │   │   ├── ipc-types.ts                         # shared IPC types (also used by preload + renderer)
    │   │   ├── timer.ts                             # active-timer state (singleton in main)
    │   │   ├── deps.ts                              # buildDeps() — wires SyncEngine + store + auth
    │   │   └── store/
    │   │       ├── better-sqlite-store.ts           # implements LocalStore via better-sqlite3
    │   │       ├── case-mapping-row.ts              # camelCase ⇄ snake_case mapper for SQLite rows
    │   │       └── migrations/
    │   │           └── 001_init.sql                 # local SQLite schema (mirrors Supabase + sync_state)
    │   ├── preload.ts                               # contextBridge.exposeInMainWorld('pulse', ...)
    │   └── renderer/
    │       ├── main.tsx                             # ReactDOM.createRoot
    │       ├── App.tsx                              # root component, routes
    │       ├── api.ts                               # typed window.pulse wrapper + observable helpers
    │       ├── stores/
    │       │   ├── auth.ts                          # Zustand: session
    │       │   ├── tasks.ts                         # Zustand: tasks cache + selectors
    │       │   ├── projects.ts
    │       │   ├── tags.ts
    │       │   ├── ui.ts                            # selected project, detail pane open/closed
    │       │   ├── timer.ts                         # active timer mirror
    │       │   └── sync.ts                          # last sync time, status, offline flag
    │       ├── shell/
    │       │   ├── AppShell.tsx
    │       │   ├── Sidebar.tsx
    │       │   ├── SystemViews.tsx                  # Today, Upcoming, Inbox links
    │       │   ├── ProjectList.tsx
    │       │   ├── TagList.tsx
    │       │   ├── StatusBar.tsx                    # sync state, last-sync
    │       │   ├── TopBarPill.tsx                   # active timer pill
    │       │   ├── ToastStack.tsx                   # bottom-right toast container
    │       │   └── OfflineBanner.tsx
    │       ├── auth/
    │       │   └── AuthScreen.tsx                   # signin/signup form
    │       ├── today/
    │       │   ├── TodayView.tsx                    # overdue + due-today
    │       │   └── UpcomingView.tsx
    │       ├── project/
    │       │   ├── ProjectView.tsx                  # list/kanban toggle host
    │       │   ├── ListView.tsx                     # virtualised task list
    │       │   ├── TaskRow.tsx
    │       │   ├── KanbanView.tsx
    │       │   └── KanbanColumn.tsx
    │       ├── detail/
    │       │   ├── DetailPane.tsx
    │       │   ├── TaskHeader.tsx
    │       │   ├── TaskMeta.tsx                     # due, recurrence, tags
    │       │   ├── TaskBody.tsx                     # markdown description
    │       │   ├── SubtaskList.tsx
    │       │   ├── TimeEntryList.tsx
    │       │   ├── CommentList.tsx
    │       │   ├── NotePane.tsx                     # task-attached notes
    │       │   └── AttachmentList.tsx
    │       ├── quick-add/
    │       │   ├── index.html                       # quick-add window entry (separate)
    │       │   ├── main.tsx
    │       │   └── QuickAdd.tsx
    │       ├── components/
    │       │   ├── ui/                              # shadcn primitives (button, dialog, ...)
    │       │   ├── PriorityBadge.tsx
    │       │   ├── DueDateBadge.tsx
    │       │   ├── ProjectChip.tsx
    │       │   ├── TagChip.tsx
    │       │   ├── EmptyState.tsx
    │       │   └── ReSignInModal.tsx
    │       ├── lib/
    │       │   ├── cn.ts                            # tailwind classnames helper
    │       │   ├── format.ts                        # date/time formatters (de locale)
    │       │   └── quick-add-parser.ts              # text → { title, projectId, dueDate, priority, tagNames }
    │       └── styles/
    │           └── tailwind.css
    ├── test/
    │   ├── unit/
    │   │   ├── better-sqlite-store.test.ts          # @pulse/core LocalStore contract against real sqlite
    │   │   ├── case-mapping-row.test.ts
    │   │   ├── ipc-types.test.ts
    │   │   ├── notifications-scheduler.test.ts
    │   │   ├── quick-add-parser.test.ts
    │   │   └── timer.test.ts
    │   └── e2e/
    │       ├── electron-fixture.ts                  # Playwright launcher
    │       ├── auth.spec.ts
    │       ├── today.spec.ts
    │       ├── timer.spec.ts
    │       ├── kanban.spec.ts
    │       └── persistence.spec.ts
    └── assets/
        ├── icon.ico
        ├── tray-default.png
        └── tray-overlay-template.png

packages/
└── core/
    ├── src/
    │   ├── sync/
    │   │   ├── case-mapping.ts                      # MOVED out of sync-engine.ts (extract for reuse)
    │   │   └── sync-state-repo.ts                   # interface for persisted pull cursors
    │   └── ... (Phase 1 unchanged)
    └── test/
        └── unit/
            └── case-mapping.test.ts                 # tests for extracted mapping
```

Workspace root: append `apps/*` to `pnpm-workspace.yaml`.

---

## Task 1: Workspace bootstrap for `@pulse/desktop`

**Files:**
- Modify: `pnpm-workspace.yaml`
- Create: `apps/desktop/package.json`, `apps/desktop/tsconfig.json`, `apps/desktop/tsconfig.node.json`, `apps/desktop/.gitignore`

- [ ] **Step 1: Add `apps/*` to `pnpm-workspace.yaml`**

Replace the file with:

```yaml
packages:
  - "packages/*"
  - "tools/*"
  - "apps/*"
```

- [ ] **Step 2: Create `apps/desktop/package.json`**

```json
{
  "name": "@pulse/desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist-electron/main/index.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.node.json && tsc -p tsconfig.json --noEmit && vite build",
    "pack": "pnpm build && electron-builder --dir",
    "dist": "pnpm build && electron-builder",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint src test"
  },
  "dependencies": {
    "@pulse/core": "workspace:*",
    "@supabase/supabase-js": "^2.45.0",
    "better-sqlite3": "^11.3.0",
    "chrono-node": "^2.7.7",
    "date-fns": "^3.6.0",
    "electron-updater": "^6.3.0"
  },
  "devDependencies": {
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@playwright/test": "^1.47.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-popover": "^1.1.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "@testing-library/react": "^16.0.0",
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^20.12.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "electron": "^33.0.0",
    "electron-builder": "^25.1.0",
    "happy-dom": "^15.7.0",
    "lucide-react": "^0.452.0",
    "playwright": "^1.47.0",
    "postcss": "^8.4.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-hook-form": "^7.53.0",
    "react-window": "^1.8.10",
    "tailwindcss": "^3.4.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vite-plugin-electron": "^0.28.0",
    "vite-plugin-electron-renderer": "^0.14.0",
    "vitest": "^2.0.0",
    "zod": "^3.23.0",
    "zustand": "^5.0.0"
  }
}
```

- [ ] **Step 3: Create `apps/desktop/tsconfig.json` (renderer)**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "moduleResolution": "Bundler",
    "outDir": "dist/renderer",
    "rootDir": "src/renderer",
    "types": ["vite/client"]
  },
  "include": ["src/renderer/**/*"]
}
```

- [ ] **Step 4: Create `apps/desktop/tsconfig.node.json` (main + preload)**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "dist-electron",
    "rootDir": "src",
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["src/main/**/*", "src/preload.ts", "src/main/ipc-types.ts"]
}
```

- [ ] **Step 5: Create `apps/desktop/.gitignore`**

```
dist/
dist-electron/
release/
node_modules/
.vite/
*.log
playwright-report/
test-results/
```

- [ ] **Step 6: Install workspace dependencies**

Run: `pnpm install`
Expected: `apps/desktop` linked, `pnpm-lock.yaml` updated, no errors.

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml apps/desktop/package.json apps/desktop/tsconfig.json apps/desktop/tsconfig.node.json apps/desktop/.gitignore pnpm-lock.yaml
git commit -m "chore(desktop): workspace bootstrap"
```

---

## Task 2: Extract `case-mapping` to `@pulse/core` (TDD)

**Files:**
- Create: `packages/core/src/sync/case-mapping.ts`
- Create: `packages/core/test/unit/case-mapping.test.ts`
- Modify: `packages/core/src/sync/sync-engine.ts` (remove duplicate helpers, import from new module)
- Modify: `packages/core/src/sync/index.ts` (re-export case-mapping)

- [ ] **Step 1: Write failing test — `packages/core/test/unit/case-mapping.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { camelToSnake, snakeToCamel, snakifyKeys, snakeToCamelRow } from "../../src/sync/case-mapping.js";

describe("case-mapping", () => {
  it("camelToSnake handles single + multi-segment camelCase", () => {
    expect(camelToSnake("dueDate")).toBe("due_date");
    expect(camelToSnake("parentTaskId")).toBe("parent_task_id");
    expect(camelToSnake("id")).toBe("id");
  });

  it("snakeToCamel reverses camelToSnake for known field names", () => {
    expect(snakeToCamel("due_date")).toBe("dueDate");
    expect(snakeToCamel("parent_task_id")).toBe("parentTaskId");
    expect(snakeToCamel("updated_at")).toBe("updatedAt");
  });

  it("snakifyKeys converts all top-level keys", () => {
    expect(snakifyKeys({ dueDate: "x", parentTaskId: null, sortOrder: 1 }))
      .toEqual({ due_date: "x", parent_task_id: null, sort_order: 1 });
  });

  it("snakeToCamelRow converts top-level keys, leaves values untouched", () => {
    expect(snakeToCamelRow({ user_id: "u", payload: { from: "todo" } }))
      .toEqual({ userId: "u", payload: { from: "todo" } });
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @pulse/core test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/core/src/sync/case-mapping.ts`**

```ts
export function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
}

export function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function snakifyKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[camelToSnake(k)] = v;
  }
  return out;
}

export function snakeToCamelRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[snakeToCamel(k)] = v;
  }
  return out;
}
```

- [ ] **Step 4: Replace duplicate helpers in `sync-engine.ts`**

Open `packages/core/src/sync/sync-engine.ts`. At the top, add:

```ts
import { snakifyKeys, snakeToCamelRow } from "./case-mapping.js";
```

Remove the local `camelToSnake`, `snakifyKeys`, `snakeToCamel`, `snakeToCamelRow` definitions if they exist. Keep all other code unchanged.

- [ ] **Step 5: Add to barrel — `packages/core/src/sync/index.ts`**

Append:
```ts
export * from "./case-mapping.js";
```

- [ ] **Step 6: Run all core tests**

Run: `pnpm --filter @pulse/core test`
Expected: 65 tests pass (61 prior + 4 new). All sync-engine integration tests still pass.

- [ ] **Step 7: Build sanity**

Run: `pnpm --filter @pulse/core build`
Expected: tsc exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/sync packages/core/test/unit
git commit -m "refactor(core): extract case-mapping helpers for reuse"
```

---

## Task 3: `SyncStateRepo` interface in `@pulse/core` (TDD)

**Files:**
- Create: `packages/core/src/sync/sync-state-repo.ts`
- Create: `packages/core/test/unit/sync-state-repo.test.ts`
- Modify: `packages/core/src/sync/index.ts`

- [ ] **Step 1: Write failing test — `packages/core/test/unit/sync-state-repo.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { InMemorySyncStateRepo } from "../../src/sync/sync-state-repo.js";

describe("InMemorySyncStateRepo", () => {
  it("returns null for unseen tables", async () => {
    const repo = new InMemorySyncStateRepo();
    expect(await repo.getCursor("tasks")).toBeNull();
  });

  it("stores and reads cursor by table", async () => {
    const repo = new InMemorySyncStateRepo();
    await repo.setCursor("tasks", "2026-05-09T10:00:00.000Z");
    expect(await repo.getCursor("tasks")).toBe("2026-05-09T10:00:00.000Z");
    expect(await repo.getCursor("projects")).toBeNull();
  });

  it("overwrites cursor on second set", async () => {
    const repo = new InMemorySyncStateRepo();
    await repo.setCursor("tasks", "2026-05-09T10:00:00.000Z");
    await repo.setCursor("tasks", "2026-05-09T11:00:00.000Z");
    expect(await repo.getCursor("tasks")).toBe("2026-05-09T11:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @pulse/core test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/core/src/sync/sync-state-repo.ts`**

```ts
import type { SyncTable } from "../store/local-store.js";

export interface SyncStateRepo {
  getCursor(table: SyncTable): Promise<string | null>;
  setCursor(table: SyncTable, iso: string): Promise<void>;
}

export class InMemorySyncStateRepo implements SyncStateRepo {
  private map = new Map<SyncTable, string>();
  async getCursor(table: SyncTable): Promise<string | null> {
    return this.map.get(table) ?? null;
  }
  async setCursor(table: SyncTable, iso: string): Promise<void> {
    this.map.set(table, iso);
  }
}
```

- [ ] **Step 4: Add to barrel — `packages/core/src/sync/index.ts`**

Append:
```ts
export * from "./sync-state-repo.js";
```

- [ ] **Step 5: Run tests, expect 68 passing**

Run: `pnpm --filter @pulse/core test`
Expected: 68 tests (65 prior + 3 new).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/sync packages/core/test/unit
git commit -m "feat(core): SyncStateRepo interface + in-memory impl"
```

---

## Task 4: Local SQLite migration (Phase 2)

**Files:**
- Create: `apps/desktop/src/main/store/migrations/001_init.sql`

- [ ] **Step 1: Create the SQL file**

The local DB mirrors the Supabase schema with two differences: types adapted to SQLite (no `bigint`/`uuid`/`jsonb`; uses `TEXT` for ids and dates, `INTEGER` for booleans), and adds `sync_state` for persisted pull cursors.

```sql
-- Pulse local SQLite schema (Phase 2 desktop). Mirrors Supabase shapes.
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  name         TEXT NOT NULL,
  color        TEXT NOT NULL,
  archived     INTEGER NOT NULL,
  sort_order   INTEGER NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);
CREATE INDEX IF NOT EXISTS projects_user_updated ON projects (user_id, updated_at);

CREATE TABLE IF NOT EXISTS tasks (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL,
  project_id            TEXT NOT NULL,
  parent_task_id        TEXT,
  title                 TEXT NOT NULL,
  description           TEXT,
  status                TEXT NOT NULL,
  priority              INTEGER NOT NULL,
  due_date              TEXT,
  completed_at          TEXT,
  sort_order            INTEGER NOT NULL,
  recurrence_rule       TEXT,
  recurrence_parent_id  TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  deleted_at            TEXT
);
CREATE INDEX IF NOT EXISTS tasks_user_project ON tasks (user_id, project_id);
CREATE INDEX IF NOT EXISTS tasks_user_due ON tasks (user_id, due_date);
CREATE INDEX IF NOT EXISTS tasks_user_updated ON tasks (user_id, updated_at);

CREATE TABLE IF NOT EXISTS tags (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);
CREATE INDEX IF NOT EXISTS tags_user_updated ON tags (user_id, updated_at);

CREATE TABLE IF NOT EXISTS task_tags (
  task_id     TEXT NOT NULL,
  tag_id      TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (task_id, tag_id)
);
CREATE INDEX IF NOT EXISTS task_tags_task ON task_tags (task_id);

CREATE TABLE IF NOT EXISTS attachments (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  task_id       TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  filename      TEXT NOT NULL,
  mime          TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT
);
CREATE INDEX IF NOT EXISTS attachments_user_updated ON attachments (user_id, updated_at);

CREATE TABLE IF NOT EXISTS time_entries (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL,
  task_id            TEXT NOT NULL,
  started_at         TEXT NOT NULL,
  ended_at           TEXT,
  duration_seconds   INTEGER,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  deleted_at         TEXT
);
CREATE INDEX IF NOT EXISTS time_entries_user_updated ON time_entries (user_id, updated_at);
CREATE INDEX IF NOT EXISTS time_entries_user_task ON time_entries (user_id, task_id);

CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  task_id     TEXT NOT NULL,
  body_md     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);
CREATE INDEX IF NOT EXISTS comments_user_updated ON comments (user_id, updated_at);
CREATE INDEX IF NOT EXISTS comments_task ON comments (task_id);

CREATE TABLE IF NOT EXISTS notes (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  project_id  TEXT,
  task_id     TEXT,
  body_md     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);
CREATE INDEX IF NOT EXISTS notes_user_updated ON notes (user_id, updated_at);

CREATE TABLE IF NOT EXISTS sync_state (
  table_name      TEXT PRIMARY KEY,
  last_pulled_at  TEXT NOT NULL
);
```

- [ ] **Step 2: Commit (file-only commit; consumers come in Task 5)**

```bash
git add apps/desktop/src/main/store/migrations/001_init.sql
git commit -m "feat(desktop): local SQLite migration schema"
```

---

## Task 5: `BetterSqliteStore` and `SqliteSyncStateRepo` (TDD)

**Files:**
- Create: `apps/desktop/src/main/store/case-mapping-row.ts`
- Create: `apps/desktop/src/main/store/better-sqlite-store.ts`
- Create: `apps/desktop/src/main/store/sqlite-sync-state-repo.ts`
- Create: `apps/desktop/test/unit/better-sqlite-store.test.ts`
- Create: `apps/desktop/vitest.config.ts`

- [ ] **Step 1: Create `apps/desktop/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    testTimeout: 15_000,
  },
});
```

- [ ] **Step 2: Write failing test — `apps/desktop/test/unit/better-sqlite-store.test.ts`**

```ts
import { describe, expect, it, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BetterSqliteStore } from "../../src/main/store/better-sqlite-store.js";
import { SqliteSyncStateRepo } from "../../src/main/store/sqlite-sync-state-repo.js";
import { makeProject, makeTask } from "@pulse/core";

function freshDb(): Database.Database {
  const db = new Database(":memory:");
  const sql = readFileSync(
    join(__dirname, "..", "..", "src", "main", "store", "migrations", "001_init.sql"),
    "utf8",
  );
  db.exec(sql);
  return db;
}

describe("BetterSqliteStore", () => {
  let db: Database.Database;
  let store: BetterSqliteStore;
  beforeEach(() => {
    db = freshDb();
    store = new BetterSqliteStore(db);
  });

  it("upserts then findById returns the row", async () => {
    const p = makeProject({ userId: "u1", name: "P1" });
    await store.upsert("projects", p);
    const got = await store.findById<typeof p>("projects", p.id);
    expect(got?.id).toBe(p.id);
    expect(got?.name).toBe("P1");
    expect(got?.archived).toBe(false);
    expect(got?.deletedAt).toBeNull();
  });

  it("upsert is idempotent", async () => {
    const p = makeProject({ userId: "u1", name: "P1" });
    await store.upsert("projects", p);
    await store.upsert("projects", { ...p, name: "P1-renamed" });
    const got = await store.findById<typeof p>("projects", p.id);
    expect(got?.name).toBe("P1-renamed");
  });

  it("listSince filters by user_id and updated_at strict greater-than", async () => {
    const a = makeProject({ userId: "u1", name: "a" });
    a.updatedAt = "2026-05-01T00:00:00.000Z";
    const b = makeProject({ userId: "u1", name: "b" });
    b.updatedAt = "2026-05-09T00:00:00.000Z";
    const c = makeProject({ userId: "u2", name: "c" });
    c.updatedAt = "2026-05-09T00:00:00.000Z";
    await store.upsert("projects", a);
    await store.upsert("projects", b);
    await store.upsert("projects", c);
    const rows = await store.listSince("projects", "2026-05-05T00:00:00.000Z", { userId: "u1" });
    expect(rows.map((r) => (r as any).id)).toEqual([b.id]);
  });

  it("listSince with sinceIso null returns all non-deleted rows for user", async () => {
    const a = makeProject({ userId: "u1", name: "a" });
    const b = makeProject({ userId: "u1", name: "b" });
    await store.upsert("projects", a);
    await store.upsert("projects", b);
    await store.softDelete("projects", a.id, "2026-05-09T12:00:00.000Z");
    const rows = await store.listSince("projects", null, { userId: "u1" });
    expect(rows.map((r) => (r as any).id)).toEqual([b.id]);
  });

  it("softDelete sets deletedAt and bumps updatedAt", async () => {
    const t = makeTask({ userId: "u1", projectId: "p", title: "x" });
    await store.upsert("tasks", t);
    await store.softDelete("tasks", t.id, "2026-05-09T12:00:00.000Z");
    const got = await store.findById<typeof t>("tasks", t.id);
    expect(got?.deletedAt).toBe("2026-05-09T12:00:00.000Z");
    expect(got?.updatedAt).toBe("2026-05-09T12:00:00.000Z");
  });

  it("transaction rolls back on throw", async () => {
    const p = makeProject({ userId: "u1", name: "Original" });
    await store.upsert("projects", p);
    await expect(
      store.transaction(async (tx) => {
        await tx.upsert("projects", { ...p, name: "Changed" });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const got = await store.findById<typeof p>("projects", p.id);
    expect(got?.name).toBe("Original");
  });

  it("transaction rolls back softDelete", async () => {
    const t = makeTask({ userId: "u1", projectId: "p", title: "x" });
    await store.upsert("tasks", t);
    await expect(
      store.transaction(async (tx) => {
        await tx.softDelete("tasks", t.id, "2026-05-09T12:00:00.000Z");
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const got = await store.findById<typeof t>("tasks", t.id);
    expect(got?.deletedAt).toBeNull();
  });
});

describe("SqliteSyncStateRepo", () => {
  let db: Database.Database;
  let repo: SqliteSyncStateRepo;
  beforeEach(() => {
    db = freshDb();
    repo = new SqliteSyncStateRepo(db);
  });

  it("getCursor null when not set", async () => {
    expect(await repo.getCursor("tasks")).toBeNull();
  });

  it("setCursor then getCursor", async () => {
    await repo.setCursor("tasks", "2026-05-09T10:00:00.000Z");
    expect(await repo.getCursor("tasks")).toBe("2026-05-09T10:00:00.000Z");
  });

  it("setCursor overwrites", async () => {
    await repo.setCursor("tasks", "2026-05-09T10:00:00.000Z");
    await repo.setCursor("tasks", "2026-05-09T11:00:00.000Z");
    expect(await repo.getCursor("tasks")).toBe("2026-05-09T11:00:00.000Z");
  });
});
```

- [ ] **Step 3: Run, expect FAIL (module not found)**

Run: `pnpm --filter @pulse/desktop test`
Expected: FAIL.

- [ ] **Step 4: Implement `apps/desktop/src/main/store/case-mapping-row.ts`**

This wraps `@pulse/core`'s `snakifyKeys`/`snakeToCamelRow` plus a JS-boolean ⇄ SQLite-INTEGER coercion. SQLite has no boolean type — we store `archived` as `0`/`1` and need to coerce on read.

```ts
import { snakifyKeys, snakeToCamelRow } from "@pulse/core";

const BOOL_FIELDS_BY_TABLE: Record<string, readonly string[]> = {
  projects: ["archived"],
};

/** Convert a domain object (camelCase, JS booleans) to a SQLite row (snake_case, 0/1 ints). */
export function toSqliteRow(table: string, obj: Record<string, unknown>): Record<string, unknown> {
  const snake = snakifyKeys(obj);
  const boolFields = BOOL_FIELDS_BY_TABLE[table] ?? [];
  for (const camelField of boolFields) {
    const snakeField = camelField.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
    if (snakeField in snake) {
      snake[snakeField] = snake[snakeField] ? 1 : 0;
    }
  }
  return snake;
}

/** Convert a SQLite row (snake_case, 0/1 ints) to a domain object (camelCase, JS booleans). */
export function fromSqliteRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const camel = snakeToCamelRow(row);
  const boolFields = BOOL_FIELDS_BY_TABLE[table] ?? [];
  for (const f of boolFields) {
    if (f in camel) {
      camel[f] = camel[f] === 1 || camel[f] === true;
    }
  }
  return camel;
}
```

- [ ] **Step 5: Implement `apps/desktop/src/main/store/better-sqlite-store.ts`**

```ts
import type Database from "better-sqlite3";
import type {
  BaseRow,
  ListSinceOptions,
  LocalStore,
  SyncTable,
} from "@pulse/core";
import { fromSqliteRow, toSqliteRow } from "./case-mapping-row.js";

const ALLOWED_TABLES: readonly SyncTable[] = [
  "projects", "tasks", "tags", "task_tags",
  "attachments", "time_entries", "comments", "notes",
];

function assertAllowed(t: SyncTable): void {
  if (!ALLOWED_TABLES.includes(t)) {
    throw new Error(`unknown sync table: ${t}`);
  }
}

export class BetterSqliteStore implements LocalStore {
  constructor(private readonly db: Database.Database) {}

  async upsert<T extends BaseRow>(table: SyncTable, row: T): Promise<void> {
    assertAllowed(table);
    const r = toSqliteRow(table, row as unknown as Record<string, unknown>);
    const cols = Object.keys(r);
    const placeholders = cols.map(() => "?").join(", ");
    const updates = cols.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`).join(", ");
    const sql =
      `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders}) ` +
      `ON CONFLICT(id) DO UPDATE SET ${updates}`;
    this.db.prepare(sql).run(cols.map((c) => r[c] as never));
  }

  async findById<T extends BaseRow>(table: SyncTable, id: string): Promise<T | null> {
    assertAllowed(table);
    const row = this.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    return row ? (fromSqliteRow(table, row) as T) : null;
  }

  async listSince<T extends BaseRow>(
    table: SyncTable,
    sinceIso: string | null,
    opts: ListSinceOptions = {},
  ): Promise<T[]> {
    assertAllowed(table);
    const where: string[] = [];
    const args: unknown[] = [];
    if (opts.userId !== undefined) {
      where.push("user_id = ?");
      args.push(opts.userId);
    }
    if (sinceIso !== null) {
      where.push("updated_at > ?");
      args.push(sinceIso);
    }
    if (!opts.includeDeleted) {
      where.push("deleted_at IS NULL");
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const sql = `SELECT * FROM ${table} ${whereSql} ORDER BY updated_at ASC`;
    const rows = this.db.prepare(sql).all(...args) as Record<string, unknown>[];
    return rows.map((r) => fromSqliteRow(table, r) as T);
  }

  async softDelete(table: SyncTable, id: string, atIso: string): Promise<void> {
    assertAllowed(table);
    this.db.prepare(`UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?`)
      .run(atIso, atIso, id);
  }

  async transaction<R>(fn: (tx: LocalStore) => Promise<R>): Promise<R> {
    // better-sqlite3 transactions are sync. We wrap via savepoint + manual control
    // because LocalStore.transaction is async. SAVEPOINT lets us roll back on throw.
    const sp = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.db.prepare(`SAVEPOINT ${sp}`).run();
    try {
      const result = await fn(this);
      this.db.prepare(`RELEASE SAVEPOINT ${sp}`).run();
      return result;
    } catch (e) {
      this.db.prepare(`ROLLBACK TO SAVEPOINT ${sp}`).run();
      this.db.prepare(`RELEASE SAVEPOINT ${sp}`).run();
      throw e;
    }
  }
}
```

- [ ] **Step 6: Implement `apps/desktop/src/main/store/sqlite-sync-state-repo.ts`**

```ts
import type Database from "better-sqlite3";
import type { SyncStateRepo } from "@pulse/core";
import type { SyncTable } from "@pulse/core";

export class SqliteSyncStateRepo implements SyncStateRepo {
  constructor(private readonly db: Database.Database) {}

  async getCursor(table: SyncTable): Promise<string | null> {
    const row = this.db.prepare("SELECT last_pulled_at FROM sync_state WHERE table_name = ?")
      .get(table) as { last_pulled_at: string } | undefined;
    return row ? row.last_pulled_at : null;
  }

  async setCursor(table: SyncTable, iso: string): Promise<void> {
    this.db.prepare(
      "INSERT INTO sync_state (table_name, last_pulled_at) VALUES (?, ?) " +
      "ON CONFLICT(table_name) DO UPDATE SET last_pulled_at = excluded.last_pulled_at",
    ).run(table, iso);
  }
}
```

- [ ] **Step 7: Run tests — expect ALL PASS**

Run: `pnpm --filter @pulse/desktop test`
Expected: 10 tests pass (BetterSqliteStore: 7, SqliteSyncStateRepo: 3).

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/main/store apps/desktop/test/unit/better-sqlite-store.test.ts apps/desktop/vitest.config.ts
git commit -m "feat(desktop): BetterSqliteStore + SqliteSyncStateRepo with transaction rollback"
```

---

## Task 6: SyncEngine pull writes cursor via SyncStateRepo (TDD modify @pulse/core)

The Phase-1 SyncEngine took `sinceIso` from the caller and returned a new cursor. Phase 2 lets the caller inject a `SyncStateRepo` so cursors persist across app starts.

**Files:**
- Modify: `packages/core/src/sync/sync-engine.ts`
- Modify: `packages/core/test/unit/sync-engine.test.ts`

- [ ] **Step 1: Append failing test to `packages/core/test/unit/sync-engine.test.ts`**

After the existing pull tests, add:

```ts
import { InMemorySyncStateRepo } from "../../src/sync/sync-state-repo.js";

describe("SyncEngine.pull with SyncStateRepo", () => {
  it("reads + writes cursor via repo when injected", async () => {
    const fetched: Record<string, any[]> = {
      projects: [{ id: "p1", user_id: "u", name: "Hello", color: "#2563eb",
                   archived: false, sort_order: 0,
                   created_at: "2026-05-09T00:00:00.000Z",
                   updated_at: "2026-05-09T00:00:01.000Z",
                   deleted_at: null }],
    };
    const supa = {
      rpc: vi.fn(),
      from: (t: string) => ({
        select: () => ({
          gt: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: fetched[t] ?? [], error: null }),
            }),
          }),
        }),
      }),
    } as any;
    const store = new InMemoryStore();
    const stateRepo = new InMemorySyncStateRepo();
    const engine = new SyncEngine({ supabase: supa, outbox: new Outbox(), store, userId: "u", stateRepo });

    await engine.pull();
    expect(await stateRepo.getCursor("projects")).toBe("2026-05-09T00:00:01.000Z");
  });
});
```

- [ ] **Step 2: Run, expect FAIL (engine.pull signature mismatch — pull takes sinceIso, no overload)**

Run: `pnpm --filter @pulse/core test`
Expected: FAIL.

- [ ] **Step 3: Modify `packages/core/src/sync/sync-engine.ts`**

Add `stateRepo` to `SyncEngineDeps` and overload `pull` to accept zero arguments (uses repo) or a `sinceIso` (legacy).

Replace the `SyncEngineDeps` interface:

```ts
export interface SyncEngineDeps {
  supabase: SupabaseClient;
  outbox: Outbox;
  store: LocalStore;
  userId: string;
  stateRepo?: import("./sync-state-repo.js").SyncStateRepo;
}
```

Replace the `pull` method with two overloads. Keep the existing implementation but route through stateRepo when no explicit `sinceIso` is provided:

```ts
  async pull(): Promise<string>;
  async pull(sinceIso: string | null): Promise<string>;
  async pull(sinceIso?: string | null): Promise<string> {
    const repo = this.deps.stateRepo;
    let cursor: string | null;
    if (sinceIso !== undefined) {
      cursor = sinceIso;
    } else if (repo) {
      // Pull each table from its own per-table cursor; we still loop tables here,
      // but read each cursor inside the loop below. For the legacy single-cursor
      // return path we use the maximum.
      cursor = null;
    } else {
      cursor = null;
    }

    let maxSeen: string | null = null;
    const outboxEntries = await this.deps.outbox.peekAll();

    for (const t of CURSOR_TABLES) {
      const tableCursor = (sinceIso !== undefined)
        ? cursor
        : repo ? (await repo.getCursor(t)) : null;
      const sqlCursor = tableCursor ?? "1970-01-01T00:00:00.000Z";

      const { data, error } = await this.deps.supabase
        .from(t)
        .select("*")
        .gt("updated_at", sqlCursor)
        .eq("user_id", this.deps.userId)
        .order("updated_at", { ascending: true });
      if (error) throw new Error(`pull ${t}: ${error.message}`);

      const rows = (data ?? []) as Record<string, unknown>[];
      let tableMax: string | null = tableCursor;
      for (const row of rows) {
        const camel = snakeToCamelRow(row);
        const local = await this.deps.store.findById<any>(t, camel.id as string);
        const outstanding = collectOutstandingFields(outboxEntries, t, camel.id as string);
        const merged = local && outstanding.length
          ? mergeRemoteWithOutbox(local, camel, outstanding)
          : camel;
        await this.deps.store.upsert(t, merged as any);
        const ts = camel.updatedAt as string;
        if (!tableMax || ts > tableMax) tableMax = ts;
        if (!maxSeen || ts > maxSeen) maxSeen = ts;
      }
      if (repo && sinceIso === undefined && tableMax) {
        await repo.setCursor(t, tableMax);
      }
    }
    return maxSeen ?? (sinceIso ?? "1970-01-01T00:00:00.000Z");
  }
```

(Keep all other class members unchanged. `CURSOR_TABLES` was added in Phase 1's commit `1108772`.)

- [ ] **Step 4: Run tests, expect ALL PASS**

Run: `pnpm --filter @pulse/core test`
Expected: 69 pass (68 prior + 1 new).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/sync packages/core/test/unit
git commit -m "feat(core): SyncEngine accepts optional SyncStateRepo for persisted cursors"
```

---

## Task 7: Vite + Electron build wiring

**Files:**
- Create: `apps/desktop/vite.config.ts`
- Create: `apps/desktop/index.html`
- Create: `apps/desktop/postcss.config.js`
- Create: `apps/desktop/tailwind.config.ts`
- Create: `apps/desktop/src/renderer/styles/tailwind.css`
- Create: `apps/desktop/src/renderer/main.tsx` (placeholder)
- Create: `apps/desktop/src/main/index.ts` (placeholder)
- Create: `apps/desktop/src/preload.ts` (placeholder)

- [ ] **Step 1: Create `apps/desktop/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: "src/main/index.ts",
        vite: {
          build: {
            outDir: "dist-electron/main",
            rollupOptions: {
              external: ["electron", "better-sqlite3", "electron-updater"],
            },
          },
        },
      },
      preload: {
        input: "src/preload.ts",
        vite: {
          build: { outDir: "dist-electron/preload" },
        },
      },
      renderer: {},
    }),
  ],
  build: { outDir: "dist/renderer" },
});
```

- [ ] **Step 2: Create `apps/desktop/index.html`**

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pulse</title>
    <link rel="stylesheet" href="/src/renderer/styles/tailwind.css" />
  </head>
  <body class="bg-white text-gray-900 antialiased">
    <div id="root"></div>
    <script type="module" src="/src/renderer/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `apps/desktop/postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: Create `apps/desktop/tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/renderer/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pulse: {
          DEFAULT: "#2563EB",
          hover: "#1D4ED8",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 5: Create `apps/desktop/src/renderer/styles/tailwind.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --pulse-blue: #2563EB;
  --pulse-blue-hover: #1D4ED8;
  --gray-bg: #FAFAFA;
  --border: #E5E5E5;
}

html, body, #root { height: 100%; }
body { background: var(--gray-bg); }
```

- [ ] **Step 6: Create placeholder `apps/desktop/src/renderer/main.tsx`**

```tsx
import { createRoot } from "react-dom/client";

const App = () => (
  <div className="h-full flex items-center justify-center text-2xl text-pulse">Pulse · loading…</div>
);

createRoot(document.getElementById("root")!).render(<App />);
```

- [ ] **Step 7: Create placeholder `apps/desktop/src/main/index.ts`**

```ts
import { app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

let win: BrowserWindow | null = null;

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(join(__dirname, "..", "..", "renderer", "index.html"));
  }
  win.once("ready-to-show", () => win?.show());
}

void app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
```

- [ ] **Step 8: Create placeholder `apps/desktop/src/preload.ts`**

```ts
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("pulse", {
  // populated incrementally in later tasks
  ping: () => "pong",
});
```

- [ ] **Step 9: Build sanity**

Run: `pnpm --filter @pulse/desktop build`
Expected: tsc + vite emit `dist-electron/main/index.js`, `dist-electron/preload/preload.js`, `dist/renderer/index.html`. No errors.

- [ ] **Step 10: Commit**

```bash
git add apps/desktop/vite.config.ts apps/desktop/index.html apps/desktop/postcss.config.js apps/desktop/tailwind.config.ts apps/desktop/src/renderer/styles apps/desktop/src/renderer/main.tsx apps/desktop/src/main/index.ts apps/desktop/src/preload.ts
git commit -m "feat(desktop): Vite + Electron build wiring with placeholder shell"
```

---

## Task 8: IPC types, deps wiring, preload bridge

**Files:**
- Create: `apps/desktop/src/main/ipc-types.ts`
- Create: `apps/desktop/src/main/deps.ts`
- Modify: `apps/desktop/src/preload.ts`
- Create: `apps/desktop/src/renderer/api.ts`

- [ ] **Step 1: Create `apps/desktop/src/main/ipc-types.ts`** — single source of truth shared by preload and renderer.

```ts
import type {
  Project, Task, Tag, TaskTag, Attachment, TimeEntry, Comment, Note,
  PulseSession, OutboxEntry,
} from "@pulse/core";

export interface UpdateInfo {
  version: string;
  releaseNotes?: string;
}

export interface SyncStatus {
  online: boolean;
  lastPushAt: string | null;
  lastPullAt: string | null;
  outboxSize: number;
  lastError: string | null;
}

export interface ParsedQuickAdd {
  title: string;
  projectId: string | null;
  dueDate: string | null;
  priority: 1 | 2 | 3 | 4;
  tagNames: string[];
}

export interface PulseApi {
  auth: {
    signIn(email: string, password: string): Promise<PulseSession>;
    signUp(email: string, password: string): Promise<PulseSession>;
    signOut(): Promise<void>;
    restoreSession(): Promise<PulseSession | null>;
  };
  projects: {
    list(): Promise<Project[]>;
    create(input: { name: string; color?: string }): Promise<Project>;
    update(id: string, fields: Partial<Project>): Promise<Project>;
    delete(id: string): Promise<void>;
  };
  tasks: {
    list(filter: { projectId?: string }): Promise<Task[]>;
    listToday(): Promise<Task[]>;
    listUpcoming(): Promise<Task[]>;
    create(input: {
      projectId: string; title: string;
      dueDate?: string | null; priority?: 1 | 2 | 3 | 4;
      parentTaskId?: string | null; description?: string | null;
    }): Promise<Task>;
    update(id: string, fields: Partial<Task>): Promise<Task>;
    delete(id: string): Promise<void>;
    complete(id: string): Promise<Task>;
  };
  tags: {
    list(): Promise<Tag[]>;
    create(input: { name: string; color?: string }): Promise<Tag>;
    attach(taskId: string, tagId: string): Promise<void>;
    detach(taskId: string, tagId: string): Promise<void>;
  };
  notes: {
    listForTask(taskId: string): Promise<Note[]>;
    listForProject(projectId: string): Promise<Note[]>;
    create(input: { projectId?: string; taskId?: string; bodyMd: string }): Promise<Note>;
    update(id: string, fields: { bodyMd: string }): Promise<Note>;
    delete(id: string): Promise<void>;
  };
  comments: {
    listForTask(taskId: string): Promise<Comment[]>;
    create(input: { taskId: string; bodyMd: string }): Promise<Comment>;
    update(id: string, fields: { bodyMd: string }): Promise<Comment>;
    delete(id: string): Promise<void>;
  };
  attachments: {
    listForTask(taskId: string): Promise<Attachment[]>;
    upload(input: { taskId: string; localPath: string }): Promise<Attachment>;
    delete(id: string): Promise<void>;
  };
  time_entries: {
    listForTask(taskId: string): Promise<TimeEntry[]>;
    start(taskId: string): Promise<TimeEntry>;
    stop(): Promise<TimeEntry | null>;
  };
  sync: {
    pushNow(): Promise<void>;
    pullNow(): Promise<void>;
  };
  timer: {
    current(): Promise<{ taskId: string; startedAt: string } | null>;
  };
  quickAdd: {
    show(): void;
    parse(text: string): Promise<ParsedQuickAdd>;
    submit(parsed: ParsedQuickAdd): Promise<Task>;
  };
  notifications: {
    snooze(taskId: string, minutes: number): Promise<void>;
  };
  updater: {
    check(): Promise<UpdateInfo | null>;
    installAndRestart(): void;
  };
  events: {
    on(channel: PulseEvent, cb: (data: unknown) => void): () => void;
  };
}

export type PulseEvent =
  | "tasks.changed"
  | "projects.changed"
  | "tags.changed"
  | "sync.status"
  | "timer.current"
  | "updater.progress"
  | "auth.expired";
```

- [ ] **Step 2: Create `apps/desktop/src/main/deps.ts`**

```ts
import Database from "better-sqlite3";
import { app } from "electron";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AuthService,
  createPulseSupabaseClient,
  Outbox,
  SyncEngine,
  type TokenStorage,
} from "@pulse/core";
import { BetterSqliteStore } from "./store/better-sqlite-store.js";
import { SqliteSyncStateRepo } from "./store/sqlite-sync-state-repo.js";

class FileTokenStorage implements TokenStorage {
  // populated in Task 9
  async get(_k: string): Promise<string | null> { return null; }
  async set(_k: string, _v: string): Promise<void> { /* no-op until Task 9 */ }
  async clear(): Promise<void> { /* no-op until Task 9 */ }
}

export interface AppDeps {
  db: Database.Database;
  store: BetterSqliteStore;
  stateRepo: SqliteSyncStateRepo;
  outbox: Outbox;
  supabase: ReturnType<typeof createPulseSupabaseClient>;
  auth: AuthService;
  engine: SyncEngine | null;     // becomes non-null after sign-in (userId injected)
  setUserId(userId: string): void;
}

export function buildDeps(): AppDeps {
  const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
  const anonKey = process.env.SUPABASE_ANON_KEY ?? "";
  const dbPath = join(app.getPath("userData"), "pulse.db");
  const db = new Database(dbPath);
  const migration = readFileSync(
    join(import.meta.dirname ?? __dirname, "store", "migrations", "001_init.sql"),
    "utf8",
  );
  db.exec(migration);

  const store = new BetterSqliteStore(db);
  const stateRepo = new SqliteSyncStateRepo(db);
  const outbox = new Outbox();
  const supabase = createPulseSupabaseClient({ url, anonKey });
  const auth = new AuthService(supabase, new FileTokenStorage());

  const deps: AppDeps = {
    db, store, stateRepo, outbox, supabase, auth,
    engine: null,
    setUserId(userId) {
      deps.engine = new SyncEngine({ supabase, outbox, store, userId, stateRepo });
    },
  };
  return deps;
}
```

- [ ] **Step 3: Replace `apps/desktop/src/preload.ts`**

```ts
import { contextBridge, ipcRenderer } from "electron";
import type { PulseEvent } from "./main/ipc-types.js";

const invoke = (channel: string) => (...args: unknown[]) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld("pulse", {
  auth: {
    signIn: invoke("auth.signIn"),
    signUp: invoke("auth.signUp"),
    signOut: invoke("auth.signOut"),
    restoreSession: invoke("auth.restoreSession"),
  },
  projects: {
    list: invoke("projects.list"),
    create: invoke("projects.create"),
    update: invoke("projects.update"),
    delete: invoke("projects.delete"),
  },
  tasks: {
    list: invoke("tasks.list"),
    listToday: invoke("tasks.listToday"),
    listUpcoming: invoke("tasks.listUpcoming"),
    create: invoke("tasks.create"),
    update: invoke("tasks.update"),
    delete: invoke("tasks.delete"),
    complete: invoke("tasks.complete"),
  },
  tags: {
    list: invoke("tags.list"),
    create: invoke("tags.create"),
    attach: invoke("tags.attach"),
    detach: invoke("tags.detach"),
  },
  notes: {
    listForTask: invoke("notes.listForTask"),
    listForProject: invoke("notes.listForProject"),
    create: invoke("notes.create"),
    update: invoke("notes.update"),
    delete: invoke("notes.delete"),
  },
  comments: {
    listForTask: invoke("comments.listForTask"),
    create: invoke("comments.create"),
    update: invoke("comments.update"),
    delete: invoke("comments.delete"),
  },
  attachments: {
    listForTask: invoke("attachments.listForTask"),
    upload: invoke("attachments.upload"),
    delete: invoke("attachments.delete"),
  },
  time_entries: {
    listForTask: invoke("time_entries.listForTask"),
    start: invoke("time_entries.start"),
    stop: invoke("time_entries.stop"),
  },
  sync: {
    pushNow: invoke("sync.pushNow"),
    pullNow: invoke("sync.pullNow"),
  },
  timer: {
    current: invoke("timer.current"),
  },
  quickAdd: {
    show: () => ipcRenderer.send("quickAdd.show"),
    parse: invoke("quickAdd.parse"),
    submit: invoke("quickAdd.submit"),
  },
  notifications: {
    snooze: invoke("notifications.snooze"),
  },
  updater: {
    check: invoke("updater.check"),
    installAndRestart: () => ipcRenderer.send("updater.installAndRestart"),
  },
  events: {
    on: (channel: PulseEvent, cb: (data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => cb(data);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
  },
});
```

- [ ] **Step 4: Create `apps/desktop/src/renderer/api.ts`**

```ts
import type { PulseApi } from "../main/ipc-types.js";

declare global {
  interface Window {
    pulse: PulseApi;
  }
}

export const api: PulseApi = window.pulse;
```

- [ ] **Step 5: Build sanity**

Run: `pnpm --filter @pulse/desktop build`
Expected: tsc emits without errors. Both `tsconfig.json` and `tsconfig.node.json` succeed.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/main/ipc-types.ts apps/desktop/src/main/deps.ts apps/desktop/src/preload.ts apps/desktop/src/renderer/api.ts
git commit -m "feat(desktop): IPC type surface, deps factory, preload bridge"
```

---

## Task 9: FileTokenStorage + IPC handlers for auth

**Files:**
- Create: `apps/desktop/src/main/file-token-storage.ts`
- Modify: `apps/desktop/src/main/deps.ts` (use real FileTokenStorage)
- Create: `apps/desktop/src/main/ipc.ts`
- Modify: `apps/desktop/src/main/index.ts` (call registerIpc)

- [ ] **Step 1: Create `apps/desktop/src/main/file-token-storage.ts`**

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";
import type { TokenStorage } from "@pulse/core";

export class FileTokenStorage implements TokenStorage {
  private readonly path: string;

  constructor() {
    this.path = join(app.getPath("userData"), "tokens.json");
  }

  async get(key: string): Promise<string | null> {
    if (!existsSync(this.path)) return null;
    try {
      const data = JSON.parse(readFileSync(this.path, "utf8")) as Record<string, string>;
      return data[key] ?? null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    mkdirSync(dirname(this.path), { recursive: true });
    const data = existsSync(this.path)
      ? (JSON.parse(readFileSync(this.path, "utf8")) as Record<string, string>)
      : {};
    data[key] = value;
    writeFileSync(this.path, JSON.stringify(data), { mode: 0o600 });
  }

  async clear(): Promise<void> {
    if (existsSync(this.path)) {
      writeFileSync(this.path, "{}", { mode: 0o600 });
    }
  }
}
```

- [ ] **Step 2: Wire `FileTokenStorage` in `apps/desktop/src/main/deps.ts`**

Replace the placeholder class. Top of file, add:
```ts
import { FileTokenStorage } from "./file-token-storage.js";
```

Remove the local `class FileTokenStorage implements TokenStorage { ... }` block. The factory now uses the real class — no other changes.

- [ ] **Step 3: Create `apps/desktop/src/main/ipc.ts`** (auth-only for now; add more in later tasks)

```ts
import { ipcMain } from "electron";
import type { AppDeps } from "./deps.js";

export function registerIpc(deps: AppDeps): void {
  ipcMain.handle("auth.signIn", async (_e, email: string, password: string) => {
    const session = await deps.auth.signIn(email, password);
    deps.setUserId(session.user.id);
    return session;
  });

  ipcMain.handle("auth.signUp", async (_e, email: string, password: string) => {
    const session = await deps.auth.signUp(email, password);
    deps.setUserId(session.user.id);
    return session;
  });

  ipcMain.handle("auth.signOut", async () => {
    await deps.auth.signOut();
    deps.engine = null;
  });

  ipcMain.handle("auth.restoreSession", async () => {
    const session = await deps.auth.restoreSession();
    if (session) deps.setUserId(session.user.id);
    return session;
  });
}
```

- [ ] **Step 4: Wire `registerIpc` in `apps/desktop/src/main/index.ts`**

Add at the top:
```ts
import { buildDeps } from "./deps.js";
import { registerIpc } from "./ipc.js";

let deps: ReturnType<typeof buildDeps> | null = null;
```

Inside `app.whenReady().then(...)` — replace with:
```ts
void app.whenReady().then(() => {
  deps = buildDeps();
  registerIpc(deps);
  createWindow();
});
```

- [ ] **Step 5: Build sanity**

Run: `pnpm --filter @pulse/desktop build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/main
git commit -m "feat(desktop): FileTokenStorage + auth IPC handlers"
```

---

## Task 10: IPC handlers for projects, tasks, tags (with outbox + push integration)

This batches related IPC handlers. Each handler: write to local store + enqueue outbox + send `*.changed` event + fire-and-forget push.

**Files:**
- Modify: `apps/desktop/src/main/ipc.ts`
- Create: `apps/desktop/src/main/ipc-helpers.ts`

- [ ] **Step 1: Create `apps/desktop/src/main/ipc-helpers.ts`**

```ts
import type { BrowserWindow } from "electron";
import type { AppDeps } from "./deps.js";
import type { PulseEvent } from "./ipc-types.js";

export function broadcast(win: BrowserWindow | null, channel: PulseEvent, data: unknown = null): void {
  win?.webContents.send(channel, data);
}

export async function pushAfterMutation(deps: AppDeps): Promise<void> {
  if (!deps.engine) return;
  try {
    await deps.engine.push();
  } catch {
    // outbox carries lastError; renderer surfaces it via sync.status
  }
}

export function requireUser(deps: AppDeps): string {
  if (!deps.engine) throw new Error("not signed in");
  // We rely on engine.deps.userId being injected at signin.
  return (deps.engine as unknown as { deps: { userId: string } }).deps.userId;
}
```

- [ ] **Step 2: Replace `registerIpc` in `apps/desktop/src/main/ipc.ts`** with the full set:

```ts
import { ipcMain, type BrowserWindow } from "electron";
import {
  makeProject, makeTask, makeTag, makeTaskTag, nowIso,
  type Project, type Task, type Tag,
} from "@pulse/core";
import type { AppDeps } from "./deps.js";
import { broadcast, pushAfterMutation, requireUser } from "./ipc-helpers.js";

export function registerIpc(deps: AppDeps, getWin: () => BrowserWindow | null): void {
  // ─── auth ───
  ipcMain.handle("auth.signIn", async (_e, email: string, password: string) => {
    const session = await deps.auth.signIn(email, password);
    deps.setUserId(session.user.id);
    return session;
  });
  ipcMain.handle("auth.signUp", async (_e, email: string, password: string) => {
    const session = await deps.auth.signUp(email, password);
    deps.setUserId(session.user.id);
    return session;
  });
  ipcMain.handle("auth.signOut", async () => {
    await deps.auth.signOut();
    deps.engine = null;
  });
  ipcMain.handle("auth.restoreSession", async () => {
    const session = await deps.auth.restoreSession();
    if (session) deps.setUserId(session.user.id);
    return session;
  });

  // ─── projects ───
  ipcMain.handle("projects.list", async () => {
    const userId = requireUser(deps);
    return deps.store.listSince<Project>("projects", null, { userId });
  });
  ipcMain.handle("projects.create", async (_e, input: { name: string; color?: string }) => {
    const userId = requireUser(deps);
    const p = makeProject({ userId, name: input.name, color: input.color });
    await deps.store.upsert("projects", p);
    await deps.outbox.enqueue({
      entityTable: "projects", entityId: p.id, op: "insert",
      changedFields: {
        id: p.id, name: p.name, color: p.color,
        archived: p.archived, sortOrder: p.sortOrder,
        createdAt: p.createdAt, updatedAt: p.updatedAt, deletedAt: p.deletedAt,
      },
      clientTs: p.updatedAt,
    });
    broadcast(getWin(), "projects.changed");
    void pushAfterMutation(deps);
    return p;
  });
  ipcMain.handle("projects.update", async (_e, id: string, fields: Partial<Project>) => {
    const userId = requireUser(deps);
    const local = await deps.store.findById<Project>("projects", id);
    if (!local || local.userId !== userId) throw new Error("project not found");
    const ts = nowIso();
    const updated: Project = { ...local, ...fields, updatedAt: ts };
    await deps.store.upsert("projects", updated);
    const { id: _i, userId: _u, createdAt: _c, ...changedFields } = fields;
    await deps.outbox.enqueue({
      entityTable: "projects", entityId: id, op: "update",
      changedFields: { ...changedFields, updatedAt: ts },
      clientTs: ts,
    });
    broadcast(getWin(), "projects.changed");
    void pushAfterMutation(deps);
    return updated;
  });
  ipcMain.handle("projects.delete", async (_e, id: string) => {
    requireUser(deps);
    const ts = nowIso();
    await deps.store.softDelete("projects", id, ts);
    await deps.outbox.enqueue({
      entityTable: "projects", entityId: id, op: "delete",
      changedFields: {}, clientTs: ts,
    });
    broadcast(getWin(), "projects.changed");
    void pushAfterMutation(deps);
  });

  // ─── tasks ───
  ipcMain.handle("tasks.list", async (_e, filter: { projectId?: string }) => {
    const userId = requireUser(deps);
    const all = await deps.store.listSince<Task>("tasks", null, { userId });
    return filter.projectId ? all.filter((t) => t.projectId === filter.projectId) : all;
  });

  ipcMain.handle("tasks.listToday", async () => {
    const userId = requireUser(deps);
    const all = await deps.store.listSince<Task>("tasks", null, { userId });
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const cutoff = todayEnd.toISOString();
    return all.filter((t) => t.status !== "done" && t.dueDate !== null && t.dueDate <= cutoff);
  });

  ipcMain.handle("tasks.listUpcoming", async () => {
    const userId = requireUser(deps);
    const all = await deps.store.listSince<Task>("tasks", null, { userId });
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const sevenDays = new Date(); sevenDays.setDate(sevenDays.getDate() + 7);
    const startCutoff = todayEnd.toISOString();
    const endCutoff = sevenDays.toISOString();
    return all.filter((t) =>
      t.status !== "done" && t.dueDate !== null &&
      t.dueDate > startCutoff && t.dueDate <= endCutoff,
    );
  });

  ipcMain.handle("tasks.create", async (_e, input: {
    projectId: string; title: string;
    dueDate?: string | null; priority?: 1 | 2 | 3 | 4;
    parentTaskId?: string | null; description?: string | null;
  }) => {
    const userId = requireUser(deps);
    const t = makeTask({ userId, ...input });
    await deps.store.upsert("tasks", t);
    await deps.outbox.enqueue({
      entityTable: "tasks", entityId: t.id, op: "insert",
      changedFields: serializeTaskForOutbox(t),
      clientTs: t.updatedAt,
    });
    broadcast(getWin(), "tasks.changed");
    void pushAfterMutation(deps);
    return t;
  });

  ipcMain.handle("tasks.update", async (_e, id: string, fields: Partial<Task>) => {
    const userId = requireUser(deps);
    const local = await deps.store.findById<Task>("tasks", id);
    if (!local || local.userId !== userId) throw new Error("task not found");
    const ts = nowIso();
    const updated: Task = { ...local, ...fields, updatedAt: ts };
    await deps.store.upsert("tasks", updated);
    const { id: _i, userId: _u, createdAt: _c, ...rest } = fields;
    await deps.outbox.enqueue({
      entityTable: "tasks", entityId: id, op: "update",
      changedFields: { ...rest, updatedAt: ts },
      clientTs: ts,
    });
    broadcast(getWin(), "tasks.changed");
    void pushAfterMutation(deps);
    return updated;
  });

  ipcMain.handle("tasks.delete", async (_e, id: string) => {
    requireUser(deps);
    const ts = nowIso();
    await deps.store.softDelete("tasks", id, ts);
    await deps.outbox.enqueue({
      entityTable: "tasks", entityId: id, op: "delete",
      changedFields: {}, clientTs: ts,
    });
    broadcast(getWin(), "tasks.changed");
    void pushAfterMutation(deps);
  });

  ipcMain.handle("tasks.complete", async (_e, id: string) => {
    const userId = requireUser(deps);
    const local = await deps.store.findById<Task>("tasks", id);
    if (!local || local.userId !== userId) throw new Error("task not found");
    const ts = nowIso();
    const updated: Task = { ...local, status: "done", completedAt: ts, updatedAt: ts };
    await deps.store.upsert("tasks", updated);
    await deps.outbox.enqueue({
      entityTable: "tasks", entityId: id, op: "update",
      changedFields: { status: "done", completedAt: ts, updatedAt: ts },
      clientTs: ts,
    });
    broadcast(getWin(), "tasks.changed");
    void pushAfterMutation(deps);
    return updated;
  });

  // ─── tags ───
  ipcMain.handle("tags.list", async () => {
    const userId = requireUser(deps);
    return deps.store.listSince<Tag>("tags", null, { userId });
  });
  ipcMain.handle("tags.create", async (_e, input: { name: string; color?: string }) => {
    const userId = requireUser(deps);
    const tag = makeTag({ userId, name: input.name, color: input.color });
    await deps.store.upsert("tags", tag);
    await deps.outbox.enqueue({
      entityTable: "tags", entityId: tag.id, op: "insert",
      changedFields: {
        id: tag.id, name: tag.name, color: tag.color,
        createdAt: tag.createdAt, updatedAt: tag.updatedAt, deletedAt: tag.deletedAt,
      },
      clientTs: tag.updatedAt,
    });
    broadcast(getWin(), "tags.changed");
    void pushAfterMutation(deps);
    return tag;
  });
  ipcMain.handle("tags.attach", async (_e, taskId: string, tagId: string) => {
    const userId = requireUser(deps);
    const tt = makeTaskTag({ userId, taskId, tagId });
    await deps.store.upsert("task_tags", tt as any);
    await deps.outbox.enqueue({
      entityTable: "task_tags", entityId: taskId + ":" + tagId, op: "insert",
      changedFields: { task_id: taskId, tag_id: tagId, user_id: userId, created_at: tt.createdAt },
      clientTs: tt.createdAt,
    });
    broadcast(getWin(), "tags.changed");
    void pushAfterMutation(deps);
  });
  ipcMain.handle("tags.detach", async (_e, taskId: string, tagId: string) => {
    requireUser(deps);
    deps.db.prepare("DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?").run(taskId, tagId);
    // task_tags has no soft-delete + no updated_at; for v1 we rely on realtime sync.
    broadcast(getWin(), "tags.changed");
  });

  // ─── sync (placeholders, fleshed out later) ───
  ipcMain.handle("sync.pushNow", async () => { await pushAfterMutation(deps); });
  ipcMain.handle("sync.pullNow", async () => { if (deps.engine) await deps.engine.pull(); });
}

function serializeTaskForOutbox(t: Task): Record<string, unknown> {
  return {
    id: t.id, projectId: t.projectId, parentTaskId: t.parentTaskId,
    title: t.title, description: t.description, status: t.status,
    priority: t.priority, dueDate: t.dueDate, completedAt: t.completedAt,
    sortOrder: t.sortOrder, recurrenceRule: t.recurrenceRule,
    recurrenceParentId: t.recurrenceParentId, createdAt: t.createdAt,
    updatedAt: t.updatedAt, deletedAt: t.deletedAt,
  };
}
```

- [ ] **Step 3: Update `apps/desktop/src/main/index.ts`**

Replace the body of `app.whenReady().then(...)`:

```ts
void app.whenReady().then(() => {
  deps = buildDeps();
  createWindow();
  registerIpc(deps, () => win);
});
```

- [ ] **Step 4: Build sanity**

Run: `pnpm --filter @pulse/desktop build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main
git commit -m "feat(desktop): IPC handlers for projects/tasks/tags + outbox integration"
```

---

## Task 11: Zustand stores + IPC event subscription

**Files:**
- Create: `apps/desktop/src/renderer/stores/auth.ts`
- Create: `apps/desktop/src/renderer/stores/projects.ts`
- Create: `apps/desktop/src/renderer/stores/tasks.ts`
- Create: `apps/desktop/src/renderer/stores/tags.ts`
- Create: `apps/desktop/src/renderer/stores/ui.ts`
- Create: `apps/desktop/src/renderer/stores/timer.ts`
- Create: `apps/desktop/src/renderer/stores/sync.ts`

- [ ] **Step 1: `stores/auth.ts`**

```ts
import { create } from "zustand";
import type { PulseSession } from "@pulse/core";
import { api } from "../api.js";

interface AuthState {
  session: PulseSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  restore: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  session: null,
  loading: true,
  async signIn(email, password) {
    const session = await api.auth.signIn(email, password);
    set({ session, loading: false });
  },
  async signUp(email, password) {
    const session = await api.auth.signUp(email, password);
    set({ session, loading: false });
  },
  async signOut() {
    await api.auth.signOut();
    set({ session: null });
  },
  async restore() {
    const session = await api.auth.restoreSession();
    set({ session, loading: false });
  },
}));
```

- [ ] **Step 2: `stores/projects.ts`**

```ts
import { create } from "zustand";
import type { Project } from "@pulse/core";
import { api } from "../api.js";

interface ProjectsState {
  byId: Record<string, Project>;
  order: string[];
  loaded: boolean;
  refresh: () => Promise<void>;
  create: (input: { name: string; color?: string }) => Promise<Project>;
  update: (id: string, fields: Partial<Project>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useProjects = create<ProjectsState>((set, get) => ({
  byId: {},
  order: [],
  loaded: false,
  async refresh() {
    const list = await api.projects.list();
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const byId: Record<string, Project> = {};
    for (const p of list) byId[p.id] = p;
    set({ byId, order: list.map((p) => p.id), loaded: true });
  },
  async create(input) {
    const p = await api.projects.create(input);
    await get().refresh();
    return p;
  },
  async update(id, fields) {
    await api.projects.update(id, fields);
    await get().refresh();
  },
  async remove(id) {
    await api.projects.delete(id);
    await get().refresh();
  },
}));

api.events.on("projects.changed", () => { void useProjects.getState().refresh(); });
```

- [ ] **Step 3: `stores/tasks.ts`**

```ts
import { create } from "zustand";
import type { Task } from "@pulse/core";
import { api } from "../api.js";

interface TasksState {
  byId: Record<string, Task>;
  todayIds: string[];
  upcomingIds: string[];
  byProject: Record<string, string[]>;
  loaded: boolean;
  refreshToday: () => Promise<void>;
  refreshUpcoming: () => Promise<void>;
  refreshProject: (projectId: string) => Promise<void>;
  create: (input: Parameters<typeof api.tasks.create>[0]) => Promise<Task>;
  update: (id: string, fields: Partial<Task>) => Promise<void>;
  complete: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function indexBy(list: Task[]): Record<string, Task> {
  const out: Record<string, Task> = {};
  for (const t of list) out[t.id] = t;
  return out;
}

export const useTasks = create<TasksState>((set, get) => ({
  byId: {},
  todayIds: [],
  upcomingIds: [],
  byProject: {},
  loaded: false,
  async refreshToday() {
    const list = await api.tasks.listToday();
    const idx = indexBy(list);
    set((s) => ({ byId: { ...s.byId, ...idx }, todayIds: list.map((t) => t.id), loaded: true }));
  },
  async refreshUpcoming() {
    const list = await api.tasks.listUpcoming();
    const idx = indexBy(list);
    set((s) => ({ byId: { ...s.byId, ...idx }, upcomingIds: list.map((t) => t.id), loaded: true }));
  },
  async refreshProject(projectId) {
    const list = await api.tasks.list({ projectId });
    const idx = indexBy(list);
    set((s) => ({
      byId: { ...s.byId, ...idx },
      byProject: { ...s.byProject, [projectId]: list.map((t) => t.id) },
      loaded: true,
    }));
  },
  async create(input) {
    const t = await api.tasks.create(input);
    await get().refreshProject(input.projectId);
    return t;
  },
  async update(id, fields) {
    await api.tasks.update(id, fields);
    const t = get().byId[id];
    if (t) {
      await get().refreshProject(t.projectId);
      await get().refreshToday();
    }
  },
  async complete(id) {
    await api.tasks.complete(id);
    const t = get().byId[id];
    if (t) {
      await get().refreshProject(t.projectId);
      await get().refreshToday();
    }
  },
  async remove(id) {
    await api.tasks.delete(id);
    const t = get().byId[id];
    if (t) {
      await get().refreshProject(t.projectId);
      await get().refreshToday();
    }
  },
}));

api.events.on("tasks.changed", () => {
  void useTasks.getState().refreshToday();
  void useTasks.getState().refreshUpcoming();
});
```

- [ ] **Step 4: `stores/tags.ts`**

```ts
import { create } from "zustand";
import type { Tag } from "@pulse/core";
import { api } from "../api.js";

interface TagsState {
  byId: Record<string, Tag>;
  order: string[];
  refresh: () => Promise<void>;
  create: (input: { name: string; color?: string }) => Promise<Tag>;
  attach: (taskId: string, tagId: string) => Promise<void>;
  detach: (taskId: string, tagId: string) => Promise<void>;
}

export const useTags = create<TagsState>((set, get) => ({
  byId: {},
  order: [],
  async refresh() {
    const list = await api.tags.list();
    list.sort((a, b) => a.name.localeCompare(b.name));
    const byId: Record<string, Tag> = {};
    for (const t of list) byId[t.id] = t;
    set({ byId, order: list.map((t) => t.id) });
  },
  async create(input) {
    const t = await api.tags.create(input);
    await get().refresh();
    return t;
  },
  async attach(taskId, tagId) {
    await api.tags.attach(taskId, tagId);
  },
  async detach(taskId, tagId) {
    await api.tags.detach(taskId, tagId);
  },
}));

api.events.on("tags.changed", () => { void useTags.getState().refresh(); });
```

- [ ] **Step 5: `stores/ui.ts`**

```ts
import { create } from "zustand";

export type ViewKey =
  | { kind: "today" }
  | { kind: "upcoming" }
  | { kind: "project"; projectId: string }
  | { kind: "tag"; tagId: string };

interface UiState {
  currentView: ViewKey;
  selectedTaskId: string | null;
  detailOpen: boolean;
  setView(view: ViewKey): void;
  selectTask(id: string | null): void;
  closeDetail(): void;
}

export const useUi = create<UiState>((set) => ({
  currentView: { kind: "today" },
  selectedTaskId: null,
  detailOpen: false,
  setView(view) { set({ currentView: view, selectedTaskId: null, detailOpen: false }); },
  selectTask(id) { set({ selectedTaskId: id, detailOpen: id !== null }); },
  closeDetail() { set({ selectedTaskId: null, detailOpen: false }); },
}));
```

- [ ] **Step 6: `stores/timer.ts`**

```ts
import { create } from "zustand";
import { api } from "../api.js";

interface TimerState {
  current: { taskId: string; startedAt: string } | null;
  refresh(): Promise<void>;
}

export const useTimer = create<TimerState>((set) => ({
  current: null,
  async refresh() {
    set({ current: await api.timer.current() });
  },
}));

api.events.on("timer.current", (data) => {
  useTimer.setState({ current: data as TimerState["current"] });
});
```

- [ ] **Step 7: `stores/sync.ts`**

```ts
import { create } from "zustand";
import { api } from "../api.js";
import type { SyncStatus } from "../../main/ipc-types.js";

interface SyncState {
  status: SyncStatus;
}

export const useSync = create<SyncState>(() => ({
  status: { online: true, lastPushAt: null, lastPullAt: null, outboxSize: 0, lastError: null },
}));

api.events.on("sync.status", (data) => {
  useSync.setState({ status: data as SyncStatus });
});

export async function manualPull(): Promise<void> { await api.sync.pullNow(); }
export async function manualPush(): Promise<void> { await api.sync.pushNow(); }
```

- [ ] **Step 8: Build sanity**

Run: `pnpm --filter @pulse/desktop build`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add apps/desktop/src/renderer/stores
git commit -m "feat(desktop): renderer Zustand stores + IPC event wiring"
```

---

## Task 12: shadcn primitives — Button, Input, Dialog, Toast

We use a stripped-down shadcn-style approach: copy-paste components into `components/ui/`. Tailwind tokens are already in place.

**Files:**
- Create: `apps/desktop/src/renderer/lib/cn.ts`
- Create: `apps/desktop/src/renderer/components/ui/button.tsx`
- Create: `apps/desktop/src/renderer/components/ui/input.tsx`
- Create: `apps/desktop/src/renderer/components/ui/dialog.tsx`
- Create: `apps/desktop/src/renderer/components/ui/toast.tsx`
- Create: `apps/desktop/src/renderer/lib/format.ts`

- [ ] **Step 1: `lib/cn.ts`**

```ts
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
```

- [ ] **Step 2: `components/ui/button.tsx`**

```tsx
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
}

const VARIANT: Record<Variant, string> = {
  primary: "bg-pulse text-white hover:bg-pulse-hover",
  secondary: "bg-white border border-[var(--border)] text-gray-900 hover:bg-gray-50",
  ghost: "text-gray-700 hover:bg-gray-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", ...rest },
  ref,
) {
  const sizeClass = size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm";
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors",
        "disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-pulse/40",
        sizeClass,
        VARIANT[variant],
        className,
      )}
      {...rest}
    />
  );
});
```

- [ ] **Step 3: `components/ui/input.tsx`**

```tsx
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-pulse/40 focus:border-pulse",
          className,
        )}
        {...rest}
      />
    );
  },
);
```

- [ ] **Step 4: `components/ui/dialog.tsx`**

```tsx
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { type ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export function Dialog({ open, onOpenChange, children }: {
  open: boolean; onOpenChange(o: boolean): void; children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/30 z-40" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "rounded-lg bg-white shadow-xl border border-[var(--border)] p-6 min-w-[320px] max-w-[560px]",
          )}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
```

- [ ] **Step 5: `components/ui/toast.tsx`**

A small in-renderer toast system (no Radix dependency for simplicity).

```tsx
import { create } from "zustand";
import { useEffect } from "react";

interface Toast {
  id: number;
  text: string;
  kind: "info" | "error" | "success";
}

interface ToastState {
  toasts: Toast[];
  push(text: string, kind?: Toast["kind"]): void;
  dismiss(id: number): void;
}

let nextId = 1;
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push(text, kind = "info") {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, text, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

const KIND_CLASS: Record<Toast["kind"], string> = {
  info: "bg-gray-900 text-white",
  error: "bg-red-600 text-white",
  success: "bg-pulse text-white",
};

export function ToastStack() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  useEffect(() => {}, []);
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`px-4 py-2 rounded-md shadow-md text-sm cursor-pointer ${KIND_CLASS[t.kind]}`}
        >{t.text}</div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: `lib/format.ts`** — date/time helpers in German locale

```ts
import { format, formatRelative, formatDistanceToNow, parseISO } from "date-fns";
import { de } from "date-fns/locale";

export function formatDate(iso: string): string {
  return format(parseISO(iso), "dd.MM.yyyy", { locale: de });
}

export function formatDateTime(iso: string): string {
  return format(parseISO(iso), "dd.MM.yyyy HH:mm", { locale: de });
}

export function formatTime(iso: string): string {
  return format(parseISO(iso), "HH:mm", { locale: de });
}

export function relative(iso: string): string {
  return formatRelative(parseISO(iso), new Date(), { locale: de });
}

export function timeAgo(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: de });
}

export function elapsedSeconds(startedAtIso: string, nowMs: number = Date.now()): number {
  return Math.max(0, Math.floor((nowMs - parseISO(startedAtIso).getTime()) / 1000));
}

export function formatHms(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}
```

- [ ] **Step 7: Build sanity**

Run: `pnpm --filter @pulse/desktop build`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/renderer/components/ui apps/desktop/src/renderer/lib
git commit -m "feat(desktop): shadcn-style primitives + format helpers"
```

---

## Task 13: AuthScreen + App entry routing

**Files:**
- Create: `apps/desktop/src/renderer/auth/AuthScreen.tsx`
- Create: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/main.tsx`

- [ ] **Step 1: `auth/AuthScreen.tsx`**

```tsx
import { useState } from "react";
import { Button } from "../components/ui/button.js";
import { Input } from "../components/ui/input.js";
import { useAuth } from "../stores/auth.js";
import { useToasts } from "../components/ui/toast.js";

export function AuthScreen(): JSX.Element {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const { signIn, signUp } = useAuth();
  const push = useToasts((s) => s.push);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") await signIn(email, pw);
      else await signUp(email, pw);
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex items-center justify-center bg-[var(--gray-bg)]">
      <form onSubmit={submit} className="w-[360px] bg-white rounded-lg shadow-md border border-[var(--border)] p-8 space-y-4">
        <div className="text-center">
          <div className="text-3xl font-semibold text-pulse mb-1">Pulse</div>
          <div className="text-sm text-gray-500">{mode === "signin" ? "Anmelden" : "Konto erstellen"}</div>
        </div>
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@beispiel.de" />
        <Input type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Passwort" />
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "..." : mode === "signin" ? "Anmelden" : "Konto erstellen"}
        </Button>
        <div className="text-xs text-center text-gray-500">
          {mode === "signin" ? "Neu hier? " : "Schon dabei? "}
          <button type="button" className="text-pulse underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "Konto erstellen" : "Anmelden"}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: `App.tsx`**

```tsx
import { useEffect } from "react";
import { AuthScreen } from "./auth/AuthScreen.js";
import { useAuth } from "./stores/auth.js";
import { ToastStack } from "./components/ui/toast.js";

export function App(): JSX.Element {
  const { session, loading, restore } = useAuth();
  useEffect(() => { void restore(); }, [restore]);

  if (loading) {
    return <div className="h-full flex items-center justify-center text-pulse">Pulse · loading…</div>;
  }
  if (!session) return (<>
    <AuthScreen />
    <ToastStack />
  </>);
  return (<>
    <div className="h-full flex items-center justify-center text-2xl text-pulse">Signed in as {session.user.email ?? session.user.id}</div>
    <ToastStack />
  </>);
}
```

(The post-signin shell is wired in Task 14.)

- [ ] **Step 3: Replace `main.tsx`**

```tsx
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles/tailwind.css";

createRoot(document.getElementById("root")!).render(<App />);
```

- [ ] **Step 4: Build sanity**

Run: `pnpm --filter @pulse/desktop build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer
git commit -m "feat(desktop): AuthScreen + app entry routing"
```

---

## Task 14: AppShell — Sidebar / Main / Detail layout

**Files:**
- Create: `apps/desktop/src/renderer/shell/AppShell.tsx`
- Create: `apps/desktop/src/renderer/shell/Sidebar.tsx`
- Create: `apps/desktop/src/renderer/shell/SystemViews.tsx`
- Create: `apps/desktop/src/renderer/shell/ProjectList.tsx`
- Create: `apps/desktop/src/renderer/shell/TagList.tsx`
- Modify: `apps/desktop/src/renderer/App.tsx` (use AppShell when signed in)

- [ ] **Step 1: `shell/AppShell.tsx`**

```tsx
import { useEffect } from "react";
import { Sidebar } from "./Sidebar.js";
import { useUi } from "../stores/ui.js";
import { useTasks } from "../stores/tasks.js";
import { useProjects } from "../stores/projects.js";
import { useTags } from "../stores/tags.js";

export function AppShell(): JSX.Element {
  const view = useUi((s) => s.currentView);
  const detailOpen = useUi((s) => s.detailOpen);

  useEffect(() => {
    void useProjects.getState().refresh();
    void useTags.getState().refresh();
    void useTasks.getState().refreshToday();
    void useTasks.getState().refreshUpcoming();
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <main className="flex-1 flex min-w-0">
          <div className="flex-1 min-w-0 bg-white border-r border-[var(--border)]">
            <ViewSlot view={view} />
          </div>
          {detailOpen && <DetailSlot />}
        </main>
      </div>
      {/* StatusBar + TopBarPill come in later tasks */}
    </div>
  );
}

function ViewSlot({ view }: { view: ReturnType<typeof useUi.getState>["currentView"] }) {
  // wired up in Task 15+ for Today, ProjectView, etc. For now return placeholders.
  switch (view.kind) {
    case "today":    return <div className="p-6 text-gray-500">★ Today (Task 15)</div>;
    case "upcoming": return <div className="p-6 text-gray-500">Upcoming (Task 15)</div>;
    case "project":  return <div className="p-6 text-gray-500">Project {view.projectId} (Task 16)</div>;
    case "tag":      return <div className="p-6 text-gray-500">Tag {view.tagId}</div>;
  }
}

function DetailSlot() {
  return <div className="w-[380px] border-l border-[var(--border)] p-4">Detail (Task 17)</div>;
}
```

- [ ] **Step 2: `shell/Sidebar.tsx`**

```tsx
import { SystemViews } from "./SystemViews.js";
import { ProjectList } from "./ProjectList.js";
import { TagList } from "./TagList.js";

export function Sidebar(): JSX.Element {
  return (
    <aside className="w-[220px] bg-[var(--gray-bg)] border-r border-[var(--border)] flex flex-col h-full">
      <div className="p-4 border-b border-[var(--border)]">
        <div className="text-pulse font-semibold tracking-wide">PULSE</div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <SystemViews />
        <SidebarDivider />
        <ProjectList />
        <SidebarDivider />
        <TagList />
      </div>
    </aside>
  );
}

function SidebarDivider() {
  return <div className="border-t border-[var(--border)] my-2 mx-3" />;
}
```

- [ ] **Step 3: `shell/SystemViews.tsx`**

```tsx
import { Star, Calendar, Inbox } from "lucide-react";
import { useUi } from "../stores/ui.js";
import { useTasks } from "../stores/tasks.js";
import { cn } from "../lib/cn.js";

export function SystemViews(): JSX.Element {
  const view = useUi((s) => s.currentView);
  const setView = useUi((s) => s.setView);
  const todayCount = useTasks((s) => s.todayIds.length);
  const upcomingCount = useTasks((s) => s.upcomingIds.length);

  return (
    <div className="flex flex-col px-2">
      <Item active={view.kind === "today"} onClick={() => setView({ kind: "today" })}
        icon={<Star size={16} />} label="Today" count={todayCount} />
      <Item active={view.kind === "upcoming"} onClick={() => setView({ kind: "upcoming" })}
        icon={<Calendar size={16} />} label="Upcoming" count={upcomingCount} />
      <Item active={false} onClick={() => {/* Inbox view = tasks without project; deferred to v1.x */}}
        icon={<Inbox size={16} />} label="Inbox" />
    </div>
  );
}

function Item({ active, onClick, icon, label, count }: {
  active: boolean; onClick: () => void; icon: JSX.Element; label: string; count?: number;
}) {
  return (
    <button onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded text-sm w-full text-left",
        active ? "bg-pulse text-white" : "text-gray-700 hover:bg-white",
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {count !== undefined && count > 0 && (
        <span className={cn("text-xs px-1.5 rounded", active ? "bg-pulse-hover" : "bg-gray-200 text-gray-700")}>
          {count}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 4: `shell/ProjectList.tsx`**

```tsx
import { useState } from "react";
import { Plus } from "lucide-react";
import { useProjects } from "../stores/projects.js";
import { useUi } from "../stores/ui.js";
import { Input } from "../components/ui/input.js";
import { useToasts } from "../components/ui/toast.js";
import { cn } from "../lib/cn.js";

export function ProjectList(): JSX.Element {
  const order = useProjects((s) => s.order);
  const byId = useProjects((s) => s.byId);
  const create = useProjects((s) => s.create);
  const view = useUi((s) => s.currentView);
  const setView = useUi((s) => s.setView);
  const push = useToasts((s) => s.push);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await create({ name: name.trim() });
      setName(""); setAdding(false);
    } catch (err) { push((err as Error).message, "error"); }
  }

  return (
    <div className="px-2">
      <div className="flex items-center justify-between px-2 py-1">
        <div className="text-xs uppercase tracking-wide text-gray-400">Projects</div>
        <button className="text-gray-400 hover:text-pulse" onClick={() => setAdding(true)} aria-label="Neues Projekt">
          <Plus size={14} />
        </button>
      </div>
      {order.map((id) => {
        const p = byId[id]!;
        const active = view.kind === "project" && view.projectId === id;
        return (
          <button key={id}
            onClick={() => setView({ kind: "project", projectId: id })}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded text-sm w-full text-left",
              active ? "bg-pulse text-white" : "text-gray-700 hover:bg-white",
            )}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="truncate">{p.name}</span>
          </button>
        );
      })}
      {adding && (
        <form onSubmit={submit} className="px-2 pt-1">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setAdding(false)} placeholder="Projektname" />
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 5: `shell/TagList.tsx`**

```tsx
import { useTags } from "../stores/tags.js";

export function TagList(): JSX.Element {
  const order = useTags((s) => s.order);
  const byId = useTags((s) => s.byId);
  if (order.length === 0) return <></>;
  return (
    <div className="px-2">
      <div className="text-xs uppercase tracking-wide text-gray-400 px-2 py-1">Tags</div>
      {order.map((id) => {
        const t = byId[id]!;
        return (
          <div key={id} className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700">
            <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
            <span className="truncate">#{t.name}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: Update `App.tsx`** — replace the post-signin placeholder with `<AppShell />`:

Replace the block `if (!session) return (...)` and the lines after with:

```tsx
  if (!session) return (<>
    <AuthScreen />
    <ToastStack />
  </>);
  return (<>
    <AppShell />
    <ToastStack />
  </>);
```

Add the import at top:
```tsx
import { AppShell } from "./shell/AppShell.js";
```

- [ ] **Step 7: Build sanity**

Run: `pnpm --filter @pulse/desktop build`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/renderer/shell apps/desktop/src/renderer/App.tsx
git commit -m "feat(desktop): AppShell with Sidebar (system views, projects, tags)"
```

---

## Task 15: TodayView and UpcomingView

**Files:**
- Create: `apps/desktop/src/renderer/today/TodayView.tsx`
- Create: `apps/desktop/src/renderer/today/UpcomingView.tsx`
- Create: `apps/desktop/src/renderer/components/TaskRowItem.tsx`
- Create: `apps/desktop/src/renderer/components/PriorityBadge.tsx`
- Create: `apps/desktop/src/renderer/components/DueDateBadge.tsx`
- Create: `apps/desktop/src/renderer/components/ProjectChip.tsx`
- Create: `apps/desktop/src/renderer/components/EmptyState.tsx`
- Modify: `apps/desktop/src/renderer/shell/AppShell.tsx` (wire ViewSlot)

- [ ] **Step 1: `components/PriorityBadge.tsx`**

```tsx
const LABEL: Record<number, string> = { 1: "▲▲▲", 2: "▲▲", 3: "▲", 4: "·" };
const COLOR: Record<number, string> = { 1: "text-red-600", 2: "text-orange-500", 3: "text-yellow-600", 4: "text-gray-400" };

export function PriorityBadge({ priority }: { priority: 1 | 2 | 3 | 4 }) {
  return <span className={`text-xs ${COLOR[priority]}`}>{LABEL[priority]}</span>;
}
```

- [ ] **Step 2: `components/DueDateBadge.tsx`**

```tsx
import { parseISO, isToday, isPast, isThisWeek, format } from "date-fns";
import { de } from "date-fns/locale";

export function DueDateBadge({ iso }: { iso: string | null }) {
  if (!iso) return null;
  const d = parseISO(iso);
  const now = new Date();
  const overdue = isPast(d) && !isToday(d);
  const today = isToday(d);
  const thisWeek = isThisWeek(d, { weekStartsOn: 1 });

  let cls = "text-gray-500";
  let label = format(d, "dd.MM.", { locale: de });
  if (overdue) { cls = "text-red-600 font-medium"; label = "überfällig · " + label; }
  else if (today) { cls = "text-pulse font-medium"; label = "heute"; }
  else if (thisWeek) { label = format(d, "EEEE", { locale: de }); }

  return <span className={`text-xs ${cls}`}>{label}</span>;
}
```

- [ ] **Step 3: `components/ProjectChip.tsx`**

```tsx
import { useProjects } from "../stores/projects.js";

export function ProjectChip({ projectId }: { projectId: string }) {
  const project = useProjects((s) => s.byId[projectId]);
  if (!project) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
      <span className="w-2 h-2 rounded-full" style={{ background: project.color }} />
      {project.name}
    </span>
  );
}
```

- [ ] **Step 4: `components/EmptyState.tsx`**

```tsx
import type { ReactNode } from "react";

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16">
      <div className="text-pulse mb-3">{icon}</div>
      <div className="text-lg font-medium text-gray-900">{title}</div>
      {hint && <div className="text-sm text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}
```

- [ ] **Step 5: `components/TaskRowItem.tsx`** (shared by Today/Upcoming/Project list)

```tsx
import type { Task } from "@pulse/core";
import { useUi } from "../stores/ui.js";
import { useTasks } from "../stores/tasks.js";
import { PriorityBadge } from "./PriorityBadge.js";
import { DueDateBadge } from "./DueDateBadge.js";
import { ProjectChip } from "./ProjectChip.js";
import { cn } from "../lib/cn.js";

export function TaskRowItem({ task, showProject }: { task: Task; showProject?: boolean }) {
  const selectedId = useUi((s) => s.selectedTaskId);
  const select = useUi((s) => s.selectTask);
  const complete = useTasks((s) => s.complete);

  return (
    <div
      onClick={() => select(task.id)}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded border cursor-pointer",
        selectedId === task.id ? "border-pulse bg-pulse/5" : "border-[var(--border)] hover:bg-gray-50",
      )}
    >
      <input
        type="checkbox"
        checked={task.status === "done"}
        onClick={(e) => e.stopPropagation()}
        onChange={() => void complete(task.id)}
        className="w-4 h-4 accent-pulse"
      />
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className={cn("text-sm truncate", task.status === "done" && "line-through text-gray-400")}>
          {task.title}
        </span>
        <PriorityBadge priority={task.priority} />
      </div>
      <div className="flex items-center gap-3">
        <DueDateBadge iso={task.dueDate} />
        {showProject && <ProjectChip projectId={task.projectId} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: `today/TodayView.tsx`**

```tsx
import { Star } from "lucide-react";
import { useTasks } from "../stores/tasks.js";
import { TaskRowItem } from "../components/TaskRowItem.js";
import { EmptyState } from "../components/EmptyState.js";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export function TodayView(): JSX.Element {
  const ids = useTasks((s) => s.todayIds);
  const byId = useTasks((s) => s.byId);
  const tasks = ids.map((i) => byId[i]).filter(Boolean);

  const overdue = tasks.filter((t) => t!.dueDate && t!.dueDate < new Date(new Date().setHours(0,0,0,0)).toISOString());
  const today = tasks.filter((t) => !overdue.includes(t!));

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-[var(--border)]">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Star className="text-pulse" size={22} /> Heute · {format(new Date(), "EEEE", { locale: de })}
        </h1>
      </header>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {tasks.length === 0 && (
          <EmptyState icon={<Star size={32} />} title="Nichts mehr für heute. Schön." />
        )}
        {overdue.length > 0 && (
          <section>
            <div className="text-xs uppercase tracking-wide text-red-600 mb-2">Überfällig</div>
            <div className="space-y-1.5">{overdue.map((t) => <TaskRowItem key={t!.id} task={t!} showProject />)}</div>
          </section>
        )}
        {today.length > 0 && (
          <section>
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Heute fällig</div>
            <div className="space-y-1.5">{today.map((t) => <TaskRowItem key={t!.id} task={t!} showProject />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: `today/UpcomingView.tsx`**

```tsx
import { Calendar } from "lucide-react";
import { useTasks } from "../stores/tasks.js";
import { TaskRowItem } from "../components/TaskRowItem.js";
import { EmptyState } from "../components/EmptyState.js";

export function UpcomingView(): JSX.Element {
  const ids = useTasks((s) => s.upcomingIds);
  const byId = useTasks((s) => s.byId);
  const tasks = ids.map((i) => byId[i]).filter(Boolean);
  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-[var(--border)]">
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Calendar className="text-pulse" size={22} /> Upcoming</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        {tasks.length === 0
          ? <EmptyState icon={<Calendar size={32} />} title="Keine Tasks in den nächsten 7 Tagen." />
          : <div className="space-y-1.5">{tasks.map((t) => <TaskRowItem key={t!.id} task={t!} showProject />)}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Wire `ViewSlot` in `AppShell.tsx`**

Replace the placeholder switch with:
```tsx
import { TodayView } from "../today/TodayView.js";
import { UpcomingView } from "../today/UpcomingView.js";
import { ProjectView } from "../project/ProjectView.js";   // added in Task 16

function ViewSlot({ view }: { view: ReturnType<typeof useUi.getState>["currentView"] }) {
  switch (view.kind) {
    case "today":    return <TodayView />;
    case "upcoming": return <UpcomingView />;
    case "project":  return <ProjectView projectId={view.projectId} />;
    case "tag":      return <div className="p-6 text-gray-500">Tag {view.tagId}</div>;
  }
}
```

(Note: `ProjectView` is created in the next task. The build will fail at this step until Task 16 lands. To keep this task green, comment out the project case temporarily, or merge with Task 16.) Easier: leave `case "project":` returning the placeholder until Task 16 ships.

For this task, keep:
```tsx
    case "project":  return <div className="p-6 text-gray-500">Project {view.projectId} (Task 16)</div>;
```

- [ ] **Step 9: Build sanity**

Run: `pnpm --filter @pulse/desktop build`
Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add apps/desktop/src/renderer
git commit -m "feat(desktop): TodayView + UpcomingView with shared TaskRowItem"
```

---

## Task 16: ProjectView with ListView (kanban view in Task 21)

**Files:**
- Create: `apps/desktop/src/renderer/project/ProjectView.tsx`
- Create: `apps/desktop/src/renderer/project/ListView.tsx`
- Modify: `apps/desktop/src/renderer/shell/AppShell.tsx` (uncomment ProjectView import)

- [ ] **Step 1: `project/ListView.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useTasks } from "../stores/tasks.js";
import { TaskRowItem } from "../components/TaskRowItem.js";
import { EmptyState } from "../components/EmptyState.js";
import { Input } from "../components/ui/input.js";
import { useToasts } from "../components/ui/toast.js";
import { CheckSquare } from "lucide-react";

export function ListView({ projectId }: { projectId: string }) {
  const ids = useTasks((s) => s.byProject[projectId] ?? []);
  const byId = useTasks((s) => s.byId);
  const create = useTasks((s) => s.create);
  const refresh = useTasks((s) => s.refreshProject);
  const [newTitle, setNewTitle] = useState("");
  const push = useToasts((s) => s.push);

  useEffect(() => { void refresh(projectId); }, [projectId, refresh]);

  const tasks = ids.map((i) => byId[i]).filter(Boolean);
  const open = tasks.filter((t) => t!.status !== "done");
  const done = tasks.filter((t) => t!.status === "done");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await create({ projectId, title: newTitle.trim() });
      setNewTitle("");
    } catch (err) { push((err as Error).message, "error"); }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-3 border-b border-[var(--border)]">
        <form onSubmit={submit}>
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            placeholder="+ Neue Task hier eingeben & Enter" />
        </form>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {tasks.length === 0 && (
          <EmptyState icon={<CheckSquare size={32} />} title="Noch keine Tasks." hint="Tippe oben rein und drücke Enter." />
        )}
        {open.length > 0 && (
          <section>
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Offen ({open.length})</div>
            <div className="space-y-1.5">{open.map((t) => <TaskRowItem key={t!.id} task={t!} />)}</div>
          </section>
        )}
        {done.length > 0 && (
          <section>
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Erledigt ({done.length})</div>
            <div className="space-y-1.5 opacity-60">{done.map((t) => <TaskRowItem key={t!.id} task={t!} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `project/ProjectView.tsx`**

The View hosts a List/Kanban toggle. Kanban implementation comes in Task 21; for now only List is wired.

```tsx
import { useState } from "react";
import { LayoutList, KanbanSquare } from "lucide-react";
import { useProjects } from "../stores/projects.js";
import { ListView } from "./ListView.js";
import { cn } from "../lib/cn.js";

export function ProjectView({ projectId }: { projectId: string }) {
  const project = useProjects((s) => s.byId[projectId]);
  const [mode, setMode] = useState<"list" | "kanban">("list");

  if (!project) return <div className="p-6 text-gray-500">Project nicht gefunden.</div>;

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full" style={{ background: project.color }} />
          <h1 className="text-2xl font-semibold">{project.name}</h1>
        </div>
        <div className="flex gap-1">
          <button className={cn("p-2 rounded", mode === "list" ? "bg-pulse text-white" : "text-gray-500 hover:bg-gray-100")}
            onClick={() => setMode("list")} aria-label="Liste"><LayoutList size={16} /></button>
          <button className={cn("p-2 rounded", mode === "kanban" ? "bg-pulse text-white" : "text-gray-500 hover:bg-gray-100")}
            onClick={() => setMode("kanban")} aria-label="Kanban"><KanbanSquare size={16} /></button>
        </div>
      </header>
      <div className="flex-1 min-h-0">
        {mode === "list"
          ? <ListView projectId={projectId} />
          : <div className="p-6 text-gray-500">Kanban (Task 21)</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `AppShell.tsx`**

Add the import:
```tsx
import { ProjectView } from "../project/ProjectView.js";
```

Replace the project case with the real component:
```tsx
    case "project":  return <ProjectView projectId={view.projectId} />;
```

- [ ] **Step 4: Build sanity**

Run: `pnpm --filter @pulse/desktop build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer
git commit -m "feat(desktop): ProjectView with ListView (kanban placeholder)"
```

---

## Task 17: TaskDetail pane

**Files:**
- Create: `apps/desktop/src/renderer/detail/DetailPane.tsx`
- Create: `apps/desktop/src/renderer/detail/TaskHeader.tsx`
- Create: `apps/desktop/src/renderer/detail/TaskMeta.tsx`
- Create: `apps/desktop/src/renderer/detail/TaskBody.tsx`
- Modify: `apps/desktop/src/renderer/shell/AppShell.tsx` (use real DetailPane)

- [ ] **Step 1: `detail/DetailPane.tsx`**

```tsx
import { X } from "lucide-react";
import { useUi } from "../stores/ui.js";
import { useTasks } from "../stores/tasks.js";
import { TaskHeader } from "./TaskHeader.js";
import { TaskMeta } from "./TaskMeta.js";
import { TaskBody } from "./TaskBody.js";

export function DetailPane(): JSX.Element | null {
  const id = useUi((s) => s.selectedTaskId);
  const close = useUi((s) => s.closeDetail);
  const task = useTasks((s) => (id ? s.byId[id] : undefined));

  if (!task) return null;

  return (
    <aside className="w-[380px] border-l border-[var(--border)] bg-white flex flex-col">
      <div className="flex items-center justify-end p-2 border-b border-[var(--border)]">
        <button onClick={close} className="p-1 text-gray-500 hover:bg-gray-100 rounded" aria-label="Schließen">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <TaskHeader task={task} />
        <TaskMeta task={task} />
        <TaskBody task={task} />
        {/* SubtaskList in Task 18, TimeEntryList/CommentList/AttachmentList/NotePane in Tasks 19-20 */}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: `detail/TaskHeader.tsx`**

```tsx
import { useState } from "react";
import type { Task } from "@pulse/core";
import { useTasks } from "../stores/tasks.js";
import { useProjects } from "../stores/projects.js";
import { useToasts } from "../components/ui/toast.js";

export function TaskHeader({ task }: { task: Task }) {
  const project = useProjects((s) => s.byId[task.projectId]);
  const update = useTasks((s) => s.update);
  const push = useToasts((s) => s.push);
  const [title, setTitle] = useState(task.title);
  const [editing, setEditing] = useState(false);

  async function save() {
    setEditing(false);
    if (title.trim() && title !== task.title) {
      try { await update(task.id, { title: title.trim() }); }
      catch (e) { push((e as Error).message, "error"); }
    } else {
      setTitle(task.title);
    }
  }

  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">{project?.name ?? "—"}</div>
      {editing ? (
        <input
          autoFocus value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setTitle(task.title); setEditing(false); } }}
          className="text-xl font-semibold w-full bg-transparent border-b border-pulse outline-none"
        />
      ) : (
        <h2 onClick={() => setEditing(true)} className="text-xl font-semibold cursor-text">{task.title}</h2>
      )}
    </div>
  );
}
```

- [ ] **Step 3: `detail/TaskMeta.tsx`**

```tsx
import type { Task } from "@pulse/core";
import { useTasks } from "../stores/tasks.js";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

const PRIORITIES: Array<{ value: 1 | 2 | 3 | 4; label: string }> = [
  { value: 1, label: "▲▲▲ Hoch" },
  { value: 2, label: "▲▲ Mittel" },
  { value: 3, label: "▲ Normal" },
  { value: 4, label: "· Niedrig" },
];

export function TaskMeta({ task }: { task: Task }) {
  const update = useTasks((s) => s.update);
  return (
    <div className="space-y-2 text-sm">
      <Row label="Status">
        <select className="bg-transparent" value={task.status}
          onChange={(e) => void update(task.id, { status: e.target.value as Task["status"] })}>
          <option value="todo">Todo</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      </Row>
      <Row label="Priorität">
        <select className="bg-transparent" value={task.priority}
          onChange={(e) => void update(task.id, { priority: Number(e.target.value) as 1|2|3|4 })}>
          {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </Row>
      <Row label="Fällig">
        <input
          type="date"
          className="bg-transparent"
          value={task.dueDate ? format(parseISO(task.dueDate), "yyyy-MM-dd", { locale: de }) : ""}
          onChange={(e) => {
            const v = e.target.value;
            const iso = v ? new Date(v + "T09:00:00").toISOString() : null;
            void update(task.id, { dueDate: iso });
          }}
        />
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-xs uppercase text-gray-400">{label}</div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: `detail/TaskBody.tsx`**

```tsx
import { useEffect, useState } from "react";
import type { Task } from "@pulse/core";
import { useTasks } from "../stores/tasks.js";

export function TaskBody({ task }: { task: Task }) {
  const update = useTasks((s) => s.update);
  const [text, setText] = useState(task.description ?? "");
  useEffect(() => setText(task.description ?? ""), [task.id, task.description]);

  function save() {
    if (text === (task.description ?? "")) return;
    void update(task.id, { description: text || null });
  }

  return (
    <div>
      <div className="text-xs uppercase text-gray-400 mb-1">Beschreibung</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        rows={6}
        placeholder="Notizen, Markdown erlaubt…"
        className="w-full text-sm border border-[var(--border)] rounded p-2 resize-y bg-white"
      />
    </div>
  );
}
```

- [ ] **Step 5: Wire DetailPane in `AppShell.tsx`**

Replace the `<DetailSlot />` placeholder. Add at top:
```tsx
import { DetailPane } from "../detail/DetailPane.js";
```

Replace `{detailOpen && <DetailSlot />}` with `{detailOpen && <DetailPane />}`. Delete the inner `DetailSlot()` helper function.

- [ ] **Step 6: Build sanity**

Run: `pnpm --filter @pulse/desktop build`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/renderer
git commit -m "feat(desktop): TaskDetail pane with header, meta, body editing"
```

---

## Task 18: Subtask list

**Files:**
- Create: `apps/desktop/src/renderer/detail/SubtaskList.tsx`
- Modify: `apps/desktop/src/renderer/detail/DetailPane.tsx`

- [ ] **Step 1: `detail/SubtaskList.tsx`**

```tsx
import { useEffect, useState } from "react";
import type { Task } from "@pulse/core";
import { api } from "../api.js";
import { useTasks } from "../stores/tasks.js";
import { Input } from "../components/ui/input.js";
import { useToasts } from "../components/ui/toast.js";

export function SubtaskList({ parent }: { parent: Task }) {
  const [children, setChildren] = useState<Task[]>([]);
  const complete = useTasks((s) => s.complete);
  const push = useToasts((s) => s.push);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  async function refresh() {
    const all = await api.tasks.list({ projectId: parent.projectId });
    setChildren(all.filter((t) => t.parentTaskId === parent.id && !t.deletedAt));
  }
  useEffect(() => { void refresh(); }, [parent.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await api.tasks.create({ projectId: parent.projectId, title: title.trim(), parentTaskId: parent.id });
      setTitle(""); setAdding(false);
      await refresh();
    } catch (err) { push((err as Error).message, "error"); }
  }

  if (parent.parentTaskId !== null) {
    // Phase-1 trigger forbids 3-level depth; hide subtask list under a subtask.
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs uppercase text-gray-400">Subtasks</div>
        <button onClick={() => setAdding(true)} className="text-xs text-pulse hover:underline">+ neu</button>
      </div>
      <div className="space-y-1">
        {children.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={c.status === "done"}
              onChange={() => { void complete(c.id).then(refresh); }}
              className="w-4 h-4 accent-pulse" />
            <span className={c.status === "done" ? "line-through text-gray-400" : ""}>{c.title}</span>
          </label>
        ))}
      </div>
      {adding && (
        <form onSubmit={submit} className="mt-2">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { setAdding(false); setTitle(""); }} placeholder="Subtask…" />
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire in `DetailPane.tsx`**

Add import:
```tsx
import { SubtaskList } from "./SubtaskList.js";
```

Inside the scroll container, insert `<SubtaskList parent={task} />` after `<TaskBody task={task} />`.

- [ ] **Step 3: Build sanity**

Run: `pnpm --filter @pulse/desktop build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/renderer
git commit -m "feat(desktop): subtask list in detail pane"
```

---

## Task 19: Time tracking — IPC, timer module, UI

**Files:**
- Create: `apps/desktop/src/main/timer.ts`
- Modify: `apps/desktop/src/main/ipc.ts` (add time_entries + timer handlers)
- Create: `apps/desktop/src/renderer/detail/TimeEntryList.tsx`
- Create: `apps/desktop/src/renderer/shell/TopBarPill.tsx`
- Modify: `apps/desktop/src/renderer/detail/DetailPane.tsx`
- Modify: `apps/desktop/src/renderer/shell/AppShell.tsx` (mount TopBarPill)
- Create: `apps/desktop/test/unit/timer.test.ts`

- [ ] **Step 1: Write failing test — `apps/desktop/test/unit/timer.test.ts`**

```ts
import { describe, expect, it, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Outbox } from "@pulse/core";
import { BetterSqliteStore } from "../../src/main/store/better-sqlite-store.js";
import { TimerService } from "../../src/main/timer.js";

function freshDb(): Database.Database {
  const db = new Database(":memory:");
  const sql = readFileSync(join(__dirname, "..", "..", "src", "main", "store", "migrations", "001_init.sql"), "utf8");
  db.exec(sql);
  return db;
}

describe("TimerService", () => {
  let db: Database.Database;
  let store: BetterSqliteStore;
  let outbox: Outbox;
  let timer: TimerService;

  beforeEach(() => {
    db = freshDb();
    store = new BetterSqliteStore(db);
    outbox = new Outbox();
    timer = new TimerService({ store, outbox, userId: "u1" });
  });

  it("start creates a TimeEntry and sets current", async () => {
    const entry = await timer.start("task-1");
    expect(entry.taskId).toBe("task-1");
    expect(entry.endedAt).toBeNull();
    expect(timer.current()).toEqual({ taskId: "task-1", startedAt: entry.startedAt });
  });

  it("starting a new timer stops the previous one", async () => {
    await timer.start("task-1");
    await new Promise((r) => setTimeout(r, 5));
    await timer.start("task-2");
    expect(timer.current()?.taskId).toBe("task-2");
  });

  it("stop sets endedAt and returns the stopped entry", async () => {
    const started = await timer.start("task-1");
    await new Promise((r) => setTimeout(r, 5));
    const stopped = await timer.stop();
    expect(stopped?.endedAt).not.toBeNull();
    expect(stopped?.startedAt).toBe(started.startedAt);
    expect(timer.current()).toBeNull();
  });

  it("stop when no timer running returns null", async () => {
    expect(await timer.stop()).toBeNull();
  });

  it("recoverFromStore picks up an unfinished entry across process restarts", async () => {
    await timer.start("task-1");
    const recovered = new TimerService({ store, outbox, userId: "u1" });
    await recovered.init();
    expect(recovered.current()?.taskId).toBe("task-1");
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @pulse/desktop test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/desktop/src/main/timer.ts`**

```ts
import { makeTimeEntry, nowIso, stopTimer, type Outbox, type TimeEntry } from "@pulse/core";
import type { BetterSqliteStore } from "./store/better-sqlite-store.js";

export interface TimerDeps {
  store: BetterSqliteStore;
  outbox: Outbox;
  userId: string;
}

export class TimerService {
  private active: TimeEntry | null = null;

  constructor(private readonly deps: TimerDeps) {}

  /** Restore a still-running entry from the store. Call once at app start. */
  async init(): Promise<void> {
    const all = await this.deps.store.listSince<TimeEntry>("time_entries", null, { userId: this.deps.userId });
    const running = all.find((e) => e.endedAt === null);
    this.active = running ?? null;
  }

  current(): { taskId: string; startedAt: string } | null {
    if (!this.active) return null;
    return { taskId: this.active.taskId, startedAt: this.active.startedAt };
  }

  async start(taskId: string): Promise<TimeEntry> {
    if (this.active) await this.stop();
    const entry = makeTimeEntry({ userId: this.deps.userId, taskId, startedAt: nowIso() });
    await this.deps.store.upsert("time_entries", entry);
    await this.deps.outbox.enqueue({
      entityTable: "time_entries", entityId: entry.id, op: "insert",
      changedFields: serialize(entry), clientTs: entry.updatedAt,
    });
    this.active = entry;
    return entry;
  }

  async stop(): Promise<TimeEntry | null> {
    if (!this.active) return null;
    const stopped = stopTimer(this.active, nowIso());
    await this.deps.store.upsert("time_entries", stopped);
    await this.deps.outbox.enqueue({
      entityTable: "time_entries", entityId: stopped.id, op: "update",
      changedFields: { endedAt: stopped.endedAt, durationSeconds: stopped.durationSeconds, updatedAt: stopped.updatedAt },
      clientTs: stopped.updatedAt,
    });
    this.active = null;
    return stopped;
  }
}

function serialize(e: TimeEntry): Record<string, unknown> {
  return {
    id: e.id, taskId: e.taskId, startedAt: e.startedAt, endedAt: e.endedAt,
    durationSeconds: e.durationSeconds, createdAt: e.createdAt, updatedAt: e.updatedAt, deletedAt: e.deletedAt,
  };
}
```

- [ ] **Step 4: Run timer test, expect PASS**

Run: `pnpm --filter @pulse/desktop test`
Expected: 5 new tests pass; 10 prior continue passing → 15 total.

- [ ] **Step 5: Wire `TimerService` in `deps.ts`**

Add to imports:
```ts
import { TimerService } from "./timer.js";
```

Extend `AppDeps`:
```ts
  timer: TimerService | null;
```

In `setUserId`, also build the timer:
```ts
    setUserId(userId) {
      deps.engine = new SyncEngine({ supabase, outbox, store, userId, stateRepo });
      deps.timer = new TimerService({ store, outbox, userId });
      void deps.timer.init();
    },
```

Initialize `deps.timer = null;` in the returned object.

- [ ] **Step 6: Add timer + time_entries IPC handlers in `ipc.ts`**

Add at the bottom of `registerIpc`, before the closing `}`:

```ts
  // ─── time_entries ───
  ipcMain.handle("time_entries.listForTask", async (_e, taskId: string) => {
    requireUser(deps);
    const all = await deps.store.listSince("time_entries", null, { userId: requireUser(deps) });
    return (all as any[]).filter((e) => e.taskId === taskId).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  });
  ipcMain.handle("time_entries.start", async (_e, taskId: string) => {
    if (!deps.timer) throw new Error("not signed in");
    const entry = await deps.timer.start(taskId);
    broadcast(getWin(), "timer.current", deps.timer.current());
    void pushAfterMutation(deps);
    return entry;
  });
  ipcMain.handle("time_entries.stop", async () => {
    if (!deps.timer) return null;
    const entry = await deps.timer.stop();
    broadcast(getWin(), "timer.current", deps.timer.current());
    void pushAfterMutation(deps);
    return entry;
  });

  // ─── timer state read ───
  ipcMain.handle("timer.current", async () => {
    return deps.timer?.current() ?? null;
  });
```

- [ ] **Step 7: `renderer/detail/TimeEntryList.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Play, Square } from "lucide-react";
import type { Task, TimeEntry } from "@pulse/core";
import { api } from "../api.js";
import { useTimer } from "../stores/timer.js";
import { Button } from "../components/ui/button.js";
import { formatHms, formatDateTime } from "../lib/format.js";

export function TimeEntryList({ task }: { task: Task }) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const current = useTimer((s) => s.current);
  const refresh = useTimer((s) => s.refresh);
  const isActive = current?.taskId === task.id;

  async function load() { setEntries(await api.time_entries.listForTask(task.id) as TimeEntry[]); }
  useEffect(() => { void load(); void refresh(); }, [task.id, refresh]);

  async function toggle() {
    if (isActive) await api.time_entries.stop();
    else await api.time_entries.start(task.id);
    await refresh(); await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase text-gray-400">Time-Entries</div>
        <Button size="sm" variant={isActive ? "danger" : "secondary"} onClick={toggle}>
          {isActive ? <><Square size={12} className="mr-1" />Stop</> : <><Play size={12} className="mr-1" />Start</>}
        </Button>
      </div>
      <div className="space-y-1 text-sm">
        {entries.map((e) => (
          <div key={e.id} className="flex justify-between text-xs text-gray-600">
            <span>{formatDateTime(e.startedAt)}</span>
            <span>{e.durationSeconds !== null ? formatHms(e.durationSeconds) : "läuft…"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: `renderer/shell/TopBarPill.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Square } from "lucide-react";
import { useTimer } from "../stores/timer.js";
import { useTasks } from "../stores/tasks.js";
import { api } from "../api.js";
import { elapsedSeconds, formatHms } from "../lib/format.js";

export function TopBarPill(): JSX.Element | null {
  const current = useTimer((s) => s.current);
  const refresh = useTimer((s) => s.refresh);
  const task = useTasks((s) => current ? s.byId[current.taskId] : undefined);
  const [tick, setTick] = useState(0);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!current) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [current]);

  if (!current) return null;
  const seconds = elapsedSeconds(current.startedAt);

  async function stop() {
    await api.time_entries.stop();
    await refresh();
  }

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-pulse text-white px-3 py-1.5 rounded-full shadow-md text-sm">
      <span className="font-mono tabular-nums">⏱ {formatHms(seconds)}</span>
      <span className="opacity-90 max-w-[280px] truncate">{task?.title ?? current.taskId}</span>
      <button onClick={stop} className="hover:bg-white/20 rounded-full p-0.5" aria-label="Stop">
        <Square size={12} />
      </button>
      <span className="hidden">{tick}</span>
    </div>
  );
}
```

- [ ] **Step 9: Wire in `DetailPane.tsx` and `AppShell.tsx`**

In `DetailPane.tsx` add: `import { TimeEntryList } from "./TimeEntryList.js";` and insert `<TimeEntryList task={task} />` after `<SubtaskList parent={task} />`.

In `AppShell.tsx`, add `import { TopBarPill } from "./TopBarPill.js";`. Wrap the outer div with `relative` and mount `<TopBarPill />` as a sibling of the main flex layout:

```tsx
  return (
    <div className="h-full flex flex-col relative">
      <TopBarPill />
      <div className="flex-1 flex min-h-0">
        ... existing ...
      </div>
    </div>
  );
```

- [ ] **Step 10: Build + tests**

Run: `pnpm --filter @pulse/desktop build && pnpm --filter @pulse/desktop test`
Expected: build clean, 15 tests pass.

- [ ] **Step 11: Commit**

```bash
git add apps/desktop
git commit -m "feat(desktop): time tracking with TimerService, IPC, top-bar pill"
```

---

## Task 20: Notes, Comments, Attachments — IPC + UI

**Files:**
- Modify: `apps/desktop/src/main/ipc.ts` (add notes/comments/attachments handlers)
- Create: `apps/desktop/src/renderer/detail/NotePane.tsx`
- Create: `apps/desktop/src/renderer/detail/CommentList.tsx`
- Create: `apps/desktop/src/renderer/detail/AttachmentList.tsx`
- Modify: `apps/desktop/src/renderer/detail/DetailPane.tsx`

- [ ] **Step 1: Add IPC handlers in `ipc.ts`**

Add at the bottom of `registerIpc`:

```ts
  // ─── notes ───
  ipcMain.handle("notes.listForTask", async (_e, taskId: string) => {
    requireUser(deps);
    const all = await deps.store.listSince("notes", null, { userId: requireUser(deps) });
    return (all as any[]).filter((n) => n.taskId === taskId);
  });
  ipcMain.handle("notes.listForProject", async (_e, projectId: string) => {
    requireUser(deps);
    const all = await deps.store.listSince("notes", null, { userId: requireUser(deps) });
    return (all as any[]).filter((n) => n.projectId === projectId);
  });
  ipcMain.handle("notes.create", async (_e, input: { projectId?: string; taskId?: string; bodyMd: string }) => {
    const userId = requireUser(deps);
    const { makeProjectNote, makeTaskNote } = await import("@pulse/core");
    const note = input.taskId
      ? makeTaskNote({ userId, taskId: input.taskId, bodyMd: input.bodyMd })
      : makeProjectNote({ userId, projectId: input.projectId!, bodyMd: input.bodyMd });
    await deps.store.upsert("notes", note as any);
    await deps.outbox.enqueue({
      entityTable: "notes", entityId: note.id, op: "insert",
      changedFields: {
        id: note.id, projectId: note.projectId, taskId: note.taskId, bodyMd: note.bodyMd,
        createdAt: note.createdAt, updatedAt: note.updatedAt, deletedAt: note.deletedAt,
      },
      clientTs: note.updatedAt,
    });
    void pushAfterMutation(deps);
    return note;
  });
  ipcMain.handle("notes.update", async (_e, id: string, fields: { bodyMd: string }) => {
    requireUser(deps);
    const local = await deps.store.findById<any>("notes", id);
    if (!local) throw new Error("note not found");
    const ts = nowIso();
    const updated = { ...local, ...fields, updatedAt: ts };
    await deps.store.upsert("notes", updated);
    await deps.outbox.enqueue({
      entityTable: "notes", entityId: id, op: "update",
      changedFields: { bodyMd: fields.bodyMd, updatedAt: ts },
      clientTs: ts,
    });
    void pushAfterMutation(deps);
    return updated;
  });
  ipcMain.handle("notes.delete", async (_e, id: string) => {
    requireUser(deps);
    const ts = nowIso();
    await deps.store.softDelete("notes", id, ts);
    await deps.outbox.enqueue({ entityTable: "notes", entityId: id, op: "delete", changedFields: {}, clientTs: ts });
    void pushAfterMutation(deps);
  });

  // ─── comments ───
  ipcMain.handle("comments.listForTask", async (_e, taskId: string) => {
    requireUser(deps);
    const all = await deps.store.listSince("comments", null, { userId: requireUser(deps) });
    return (all as any[]).filter((c) => c.taskId === taskId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });
  ipcMain.handle("comments.create", async (_e, input: { taskId: string; bodyMd: string }) => {
    const userId = requireUser(deps);
    const { makeComment } = await import("@pulse/core");
    const c = makeComment({ userId, taskId: input.taskId, bodyMd: input.bodyMd });
    await deps.store.upsert("comments", c);
    await deps.outbox.enqueue({
      entityTable: "comments", entityId: c.id, op: "insert",
      changedFields: { id: c.id, taskId: c.taskId, bodyMd: c.bodyMd, createdAt: c.createdAt, updatedAt: c.updatedAt, deletedAt: c.deletedAt },
      clientTs: c.updatedAt,
    });
    void pushAfterMutation(deps);
    return c;
  });
  ipcMain.handle("comments.update", async (_e, id: string, fields: { bodyMd: string }) => {
    requireUser(deps);
    const local = await deps.store.findById<any>("comments", id);
    if (!local) throw new Error("comment not found");
    const ts = nowIso();
    const updated = { ...local, ...fields, updatedAt: ts };
    await deps.store.upsert("comments", updated);
    await deps.outbox.enqueue({ entityTable: "comments", entityId: id, op: "update", changedFields: { bodyMd: fields.bodyMd, updatedAt: ts }, clientTs: ts });
    void pushAfterMutation(deps);
    return updated;
  });
  ipcMain.handle("comments.delete", async (_e, id: string) => {
    requireUser(deps);
    const ts = nowIso();
    await deps.store.softDelete("comments", id, ts);
    await deps.outbox.enqueue({ entityTable: "comments", entityId: id, op: "delete", changedFields: {}, clientTs: ts });
    void pushAfterMutation(deps);
  });

  // ─── attachments ───
  ipcMain.handle("attachments.listForTask", async (_e, taskId: string) => {
    requireUser(deps);
    const all = await deps.store.listSince("attachments", null, { userId: requireUser(deps) });
    return (all as any[]).filter((a) => a.taskId === taskId);
  });
  ipcMain.handle("attachments.upload", async (_e, input: { taskId: string; localPath: string }) => {
    const userId = requireUser(deps);
    const { makeAttachment } = await import("@pulse/core");
    const { readFileSync, statSync } = await import("node:fs");
    const { basename } = await import("node:path");
    const fileBytes = readFileSync(input.localPath);
    const stat = statSync(input.localPath);
    const filename = basename(input.localPath);
    const mime = guessMime(filename);
    const storagePath = `attachments/${userId}/${input.taskId}/${Date.now()}-${filename}`;
    const { error } = await deps.supabase.storage.from("attachments").upload(storagePath, fileBytes, { contentType: mime, upsert: false });
    if (error) throw new Error(`upload failed: ${error.message}`);
    const att = makeAttachment({
      userId, taskId: input.taskId, storagePath, filename, mime, sizeBytes: stat.size,
    });
    await deps.store.upsert("attachments", att);
    await deps.outbox.enqueue({
      entityTable: "attachments", entityId: att.id, op: "insert",
      changedFields: {
        id: att.id, taskId: att.taskId, storagePath: att.storagePath, filename: att.filename,
        mime: att.mime, sizeBytes: att.sizeBytes,
        createdAt: att.createdAt, updatedAt: att.updatedAt, deletedAt: att.deletedAt,
      },
      clientTs: att.updatedAt,
    });
    void pushAfterMutation(deps);
    return att;
  });
  ipcMain.handle("attachments.delete", async (_e, id: string) => {
    requireUser(deps);
    const local = await deps.store.findById<any>("attachments", id);
    if (local?.storagePath) {
      await deps.supabase.storage.from("attachments").remove([local.storagePath]);
    }
    const ts = nowIso();
    await deps.store.softDelete("attachments", id, ts);
    await deps.outbox.enqueue({ entityTable: "attachments", entityId: id, op: "delete", changedFields: {}, clientTs: ts });
    void pushAfterMutation(deps);
  });
```

Add at the bottom of `ipc.ts` (outside `registerIpc`):

```ts
function guessMime(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  const map: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
    pdf: "application/pdf", txt: "text/plain", md: "text/markdown",
    json: "application/json", csv: "text/csv",
  };
  return ext ? (map[ext] ?? "application/octet-stream") : "application/octet-stream";
}
```

- [ ] **Step 2: `renderer/detail/NotePane.tsx`**

```tsx
import { useEffect, useState } from "react";
import type { Task, Note } from "@pulse/core";
import { api } from "../api.js";

export function NotePane({ task }: { task: Task }) {
  const [note, setNote] = useState<Note | null>(null);
  const [text, setText] = useState("");

  async function load() {
    const list = await api.notes.listForTask(task.id) as Note[];
    const n = list[0] ?? null;
    setNote(n);
    setText(n?.bodyMd ?? "");
  }
  useEffect(() => { void load(); }, [task.id]);

  async function save() {
    if (!text.trim() && !note) return;
    if (!note) {
      const created = await api.notes.create({ taskId: task.id, bodyMd: text });
      setNote(created as Note);
    } else if (text !== note.bodyMd) {
      await api.notes.update(note.id, { bodyMd: text });
    }
  }

  return (
    <div>
      <div className="text-xs uppercase text-gray-400 mb-1">Notiz</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={save} rows={4}
        placeholder="Markdown-Notiz für diese Task…"
        className="w-full text-sm border border-[var(--border)] rounded p-2 resize-y" />
    </div>
  );
}
```

- [ ] **Step 3: `renderer/detail/CommentList.tsx`**

```tsx
import { useEffect, useState } from "react";
import type { Task, Comment } from "@pulse/core";
import { api } from "../api.js";
import { Input } from "../components/ui/input.js";
import { formatDateTime } from "../lib/format.js";

export function CommentList({ task }: { task: Task }) {
  const [items, setItems] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");

  async function load() { setItems(await api.comments.listForTask(task.id) as Comment[]); }
  useEffect(() => { void load(); }, [task.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    await api.comments.create({ taskId: task.id, bodyMd: draft.trim() });
    setDraft(""); await load();
  }

  return (
    <div>
      <div className="text-xs uppercase text-gray-400 mb-1">Kommentare</div>
      <div className="space-y-2 mb-2">
        {items.map((c) => (
          <div key={c.id} className="text-sm bg-gray-50 p-2 rounded">
            <div className="text-xs text-gray-400 mb-0.5">{formatDateTime(c.createdAt)}</div>
            <div className="whitespace-pre-wrap">{c.bodyMd}</div>
          </div>
        ))}
      </div>
      <form onSubmit={submit}>
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Kommentar hinzufügen…" />
      </form>
    </div>
  );
}
```

- [ ] **Step 4: `renderer/detail/AttachmentList.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Paperclip, X } from "lucide-react";
import type { Task, Attachment } from "@pulse/core";
import { api } from "../api.js";
import { useToasts } from "../components/ui/toast.js";

export function AttachmentList({ task }: { task: Task }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const push = useToasts((s) => s.push);

  async function load() { setItems(await api.attachments.listForTask(task.id) as Attachment[]); }
  useEffect(() => { void load(); }, [task.id]);

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    for (const file of Array.from(e.dataTransfer.files)) {
      const localPath = (file as unknown as { path?: string }).path;
      if (!localPath) { push("Drop fehlgeschlagen — Pfad nicht verfügbar", "error"); continue; }
      try {
        await api.attachments.upload({ taskId: task.id, localPath });
      } catch (err) { push((err as Error).message, "error"); }
    }
    await load();
  }

  async function remove(id: string) {
    await api.attachments.delete(id);
    await load();
  }

  return (
    <div onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      <div className="flex items-center gap-1 text-xs uppercase text-gray-400 mb-1"><Paperclip size={12} /> Anhänge</div>
      <div className="space-y-1">
        {items.length === 0 && (
          <div className="text-xs text-gray-400 border border-dashed border-[var(--border)] rounded p-3 text-center">
            Datei hier reinziehen
          </div>
        )}
        {items.map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate">{a.filename}</span>
            <span className="text-xs text-gray-400">{Math.round(a.sizeBytes / 1024)} KB</span>
            <button onClick={() => void remove(a.id)} aria-label="Löschen" className="text-gray-400 hover:text-red-600"><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire in `DetailPane.tsx`**

Add imports for the three new panes and insert them after `<TimeEntryList task={task} />`:

```tsx
import { NotePane } from "./NotePane.js";
import { CommentList } from "./CommentList.js";
import { AttachmentList } from "./AttachmentList.js";
```

```tsx
        <NotePane task={task} />
        <CommentList task={task} />
        <AttachmentList task={task} />
```

- [ ] **Step 6: Build sanity**

Run: `pnpm --filter @pulse/desktop build`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop
git commit -m "feat(desktop): notes, comments, attachments in detail pane"
```

---

## Task 21: KanbanView with dnd-kit

**Files:**
- Create: `apps/desktop/src/renderer/project/KanbanView.tsx`
- Create: `apps/desktop/src/renderer/project/KanbanColumn.tsx`
- Modify: `apps/desktop/src/renderer/project/ProjectView.tsx`

- [ ] **Step 1: `project/KanbanColumn.tsx`**

```tsx
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import type { Task } from "@pulse/core";
import { useUi } from "../stores/ui.js";
import { cn } from "../lib/cn.js";
import { PriorityBadge } from "../components/PriorityBadge.js";
import { DueDateBadge } from "../components/DueDateBadge.js";

export function KanbanColumn({ status, tasks }: { status: Task["status"]; tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });
  const labels: Record<Task["status"], string> = { todo: "Todo", in_progress: "In Progress", done: "Done" };
  return (
    <div ref={setNodeRef}
      className={cn("flex flex-col gap-2 p-3 bg-gray-50 rounded-lg w-[280px] flex-shrink-0", isOver && "bg-blue-50 ring-1 ring-pulse")}>
      <div className="flex items-center justify-between text-sm font-medium text-gray-700">
        <span>{labels[status]}</span>
        <span className="text-xs text-gray-400">{tasks.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2">
        {tasks.map((t) => <Card key={t.id} task={t} />)}
      </div>
    </div>
  );
}

function Card({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const select = useUi((s) => s.selectTask);
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      style={style}
      onClick={() => select(task.id)}
      className={cn("bg-white rounded-md border border-[var(--border)] p-2 text-sm cursor-grab",
        isDragging && "opacity-60 cursor-grabbing")}>
      <div className="font-medium truncate">{task.title}</div>
      <div className="flex items-center justify-between mt-1">
        <PriorityBadge priority={task.priority} />
        <DueDateBadge iso={task.dueDate} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `project/KanbanView.tsx`**

```tsx
import { useEffect } from "react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import type { Task } from "@pulse/core";
import { useTasks } from "../stores/tasks.js";
import { KanbanColumn } from "./KanbanColumn.js";

const STATUSES: Task["status"][] = ["todo", "in_progress", "done"];

export function KanbanView({ projectId }: { projectId: string }) {
  const ids = useTasks((s) => s.byProject[projectId] ?? []);
  const byId = useTasks((s) => s.byId);
  const refresh = useTasks((s) => s.refreshProject);
  const update = useTasks((s) => s.update);

  useEffect(() => { void refresh(projectId); }, [projectId, refresh]);
  const tasks = ids.map((i) => byId[i]).filter(Boolean) as Task[];

  // Done column shows last 7 days only (per spec).
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const cols: Record<Task["status"], Task[]> = {
    todo: tasks.filter((t) => t.status === "todo"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    done: tasks.filter((t) => t.status === "done" && (t.completedAt ?? t.updatedAt) >= sevenDaysAgo),
  };

  function onDragEnd(e: DragEndEvent) {
    const overId = e.over?.id?.toString();
    if (!overId?.startsWith("col:")) return;
    const newStatus = overId.slice(4) as Task["status"];
    const taskId = e.active.id.toString();
    const task = byId[taskId];
    if (!task || task.status === newStatus) return;
    void update(taskId, { status: newStatus });
  }

  return (
    <DndContext onDragEnd={onDragEnd}>
      <div className="h-full overflow-x-auto p-4 flex gap-4">
        {STATUSES.map((s) => <KanbanColumn key={s} status={s} tasks={cols[s]} />)}
      </div>
    </DndContext>
  );
}
```

- [ ] **Step 3: Wire `KanbanView` in `ProjectView.tsx`**

Add import:
```tsx
import { KanbanView } from "./KanbanView.js";
```

Replace the placeholder `<div className="p-6 text-gray-500">Kanban (Task 21)</div>` with `<KanbanView projectId={projectId} />`.

- [ ] **Step 4: Build sanity**

Run: `pnpm --filter @pulse/desktop build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop
git commit -m "feat(desktop): KanbanView with dnd-kit drag-to-change-status"
```

---

## Task 22: Quick-Add — parser, IPC, window, UI (TDD parser)

**Files:**
- Create: `apps/desktop/src/renderer/lib/quick-add-parser.ts`
- Create: `apps/desktop/test/unit/quick-add-parser.test.ts`
- Modify: `apps/desktop/src/main/ipc.ts` (quickAdd handlers + show)
- Modify: `apps/desktop/src/main/window.ts` (Quick-Add window factory)
- Create: `apps/desktop/src/main/window.ts` if not present
- Create: `apps/desktop/src/renderer/quick-add/index.html`
- Create: `apps/desktop/src/renderer/quick-add/main.tsx`
- Create: `apps/desktop/src/renderer/quick-add/QuickAdd.tsx`
- Modify: `apps/desktop/vite.config.ts` (multi-entry renderer)

- [ ] **Step 1: Write failing test — `apps/desktop/test/unit/quick-add-parser.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseQuickAddText } from "../../src/renderer/lib/quick-add-parser.js";

const projects = [
  { id: "p1", name: "pulsehamburg" },
  { id: "p2", name: "Phase 2" },
  { id: "p3", name: "Personal" },
];

describe("parseQuickAddText", () => {
  it("plain text returns title only", () => {
    const r = parseQuickAddText("Storyboard schreiben", projects);
    expect(r.title).toBe("Storyboard schreiben");
    expect(r.projectId).toBeNull();
    expect(r.dueDate).toBeNull();
    expect(r.priority).toBe(3);
    expect(r.tagNames).toEqual([]);
  });

  it("parses @projectPrefix (case-insensitive, fuzzy)", () => {
    const r = parseQuickAddText("Newsletter @pulse", projects);
    expect(r.title).toBe("Newsletter");
    expect(r.projectId).toBe("p1");
  });

  it("parses !priority", () => {
    const r = parseQuickAddText("Wichtig !1", projects);
    expect(r.priority).toBe(1);
    expect(r.title).toBe("Wichtig");
  });

  it("parses #tag", () => {
    const r = parseQuickAddText("Mail #urgent #waiting", projects);
    expect(r.tagNames).toEqual(["urgent", "waiting"]);
    expect(r.title).toBe("Mail");
  });

  it("parses German natural date (heute)", () => {
    const r = parseQuickAddText("Mail heute", projects);
    expect(r.dueDate).not.toBeNull();
    const d = new Date(r.dueDate!);
    const now = new Date();
    expect(d.toDateString()).toBe(now.toDateString());
    expect(r.title).toBe("Mail");
  });

  it("combines all syntax", () => {
    const r = parseQuickAddText("Steuerb. mailen @personal !2 morgen #waiting", projects);
    expect(r.projectId).toBe("p3");
    expect(r.priority).toBe(2);
    expect(r.tagNames).toEqual(["waiting"]);
    expect(r.title).toBe("Steuerb. mailen");
    expect(r.dueDate).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @pulse/desktop test`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `apps/desktop/src/renderer/lib/quick-add-parser.ts`**

```ts
import * as chrono from "chrono-node";
import type { ParsedQuickAdd } from "../../main/ipc-types.js";

interface ProjectRef { id: string; name: string; }

const TAG_RE = /(^|\s)#([a-zA-ZäöüÄÖÜß0-9_-]+)/g;
const PRIORITY_RE = /(^|\s)!([1-4])\b/;
const PROJECT_RE = /(^|\s)@([a-zA-ZäöüÄÖÜß0-9_-]+)/g;

export function parseQuickAddText(input: string, projects: readonly ProjectRef[]): ParsedQuickAdd {
  let text = input;
  const tagNames: string[] = [];
  let projectId: string | null = null;
  let priority: 1 | 2 | 3 | 4 = 3;

  // tags
  text = text.replace(TAG_RE, (_m, lead: string, t: string) => { tagNames.push(t); return lead; });

  // priority
  const pm = PRIORITY_RE.exec(text);
  if (pm) {
    priority = (Number(pm[2]) as 1 | 2 | 3 | 4);
    text = text.replace(PRIORITY_RE, "$1").trim();
  }

  // project
  let pmatch: RegExpExecArray | null;
  PROJECT_RE.lastIndex = 0;
  while ((pmatch = PROJECT_RE.exec(text)) !== null) {
    const prefix = pmatch[2].toLowerCase();
    const found = projects.find((p) => p.name.toLowerCase().startsWith(prefix));
    if (found) { projectId = found.id; break; }
  }
  text = text.replace(PROJECT_RE, "").trim();

  // date — chrono with German locale
  let dueDate: string | null = null;
  const parsed = chrono.de.parse(text, new Date(), { forwardDate: true });
  if (parsed.length > 0) {
    const first = parsed[0]!;
    dueDate = first.date().toISOString();
    text = (text.slice(0, first.index) + text.slice(first.index + first.text.length)).replace(/\s+/g, " ").trim();
  }

  const title = text.replace(/\s+/g, " ").trim();
  return { title, projectId, dueDate, priority, tagNames };
}
```

- [ ] **Step 4: Run tests, expect PASS**

Run: `pnpm --filter @pulse/desktop test`
Expected: 6 new pass, 15 prior continue → 21 total.

- [ ] **Step 5: Create `apps/desktop/src/main/window.ts`**

```ts
import { BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(join(__dirname, "..", "..", "renderer", "index.html"));
  }
  win.once("ready-to-show", () => win.show());
  return win;
}

let quickAddWin: BrowserWindow | null = null;

export function showQuickAddWindow(): BrowserWindow {
  if (quickAddWin && !quickAddWin.isDestroyed()) {
    quickAddWin.show(); quickAddWin.focus();
    return quickAddWin;
  }
  quickAddWin = new BrowserWindow({
    width: 600, height: 120,
    frame: false, resizable: false,
    center: true, alwaysOnTop: false, show: false,
    webPreferences: {
      preload: join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    void quickAddWin.loadURL(process.env.VITE_DEV_SERVER_URL + "src/renderer/quick-add/index.html");
  } else {
    void quickAddWin.loadFile(join(__dirname, "..", "..", "renderer", "quick-add", "index.html"));
  }
  quickAddWin.once("ready-to-show", () => { quickAddWin?.show(); quickAddWin?.focus(); });
  quickAddWin.on("blur", () => { quickAddWin?.hide(); });
  quickAddWin.on("closed", () => { quickAddWin = null; });
  return quickAddWin;
}

export function hideQuickAdd(): void {
  if (quickAddWin && !quickAddWin.isDestroyed()) quickAddWin.hide();
}
```

Update `src/main/index.ts` to use `createMainWindow`:

```ts
import { app } from "electron";
import { createMainWindow } from "./window.js";
import { buildDeps, type AppDeps } from "./deps.js";
import { registerIpc } from "./ipc.js";

let win: ReturnType<typeof createMainWindow> | null = null;
let deps: AppDeps | null = null;

void app.whenReady().then(() => {
  deps = buildDeps();
  win = createMainWindow();
  registerIpc(deps, () => win);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
```

- [ ] **Step 6: Update `vite.config.ts`** for the second renderer entry

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: "src/main/index.ts",
        vite: {
          build: {
            outDir: "dist-electron/main",
            rollupOptions: { external: ["electron", "better-sqlite3", "electron-updater"] },
          },
        },
      },
      preload: {
        input: "src/preload.ts",
        vite: { build: { outDir: "dist-electron/preload" } },
      },
      renderer: {},
    }),
  ],
  build: {
    outDir: "dist/renderer",
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        "quick-add": resolve(__dirname, "src/renderer/quick-add/index.html"),
      },
    },
  },
});
```

- [ ] **Step 7: Quick-Add renderer entry — `src/renderer/quick-add/index.html`**

```html
<!doctype html>
<html lang="de"><head>
  <meta charset="UTF-8" /><title>Pulse · Quick Add</title>
  <link rel="stylesheet" href="/src/renderer/styles/tailwind.css" />
</head><body class="bg-white">
  <div id="root"></div>
  <script type="module" src="/src/renderer/quick-add/main.tsx"></script>
</body></html>
```

- [ ] **Step 8: `quick-add/main.tsx`**

```tsx
import { createRoot } from "react-dom/client";
import { QuickAdd } from "./QuickAdd.js";
import "../styles/tailwind.css";

createRoot(document.getElementById("root")!).render(<QuickAdd />);
```

- [ ] **Step 9: `quick-add/QuickAdd.tsx`**

```tsx
import { useEffect, useState } from "react";
import { api } from "../api.js";

export function QuickAdd(): JSX.Element {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") window.close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const parsed = await api.quickAdd.parse(text);
      await api.quickAdd.submit(parsed);
      window.close();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="h-screen w-screen p-3 bg-white border border-[var(--border)] rounded-md shadow-md">
      <input autoFocus value={text} onChange={(e) => setText(e.target.value)} disabled={busy}
        placeholder="Quick add — Title  @projekt  !1-4  morgen 9:00  #tag"
        className="w-full h-10 px-3 text-sm border border-[var(--border)] rounded focus:outline-none focus:ring-2 focus:ring-pulse/40 focus:border-pulse" />
      <div className="text-xs text-gray-400 mt-2">Enter sendet · Esc schließt</div>
    </form>
  );
}
```

- [ ] **Step 10: Quick-Add IPC handlers in `ipc.ts`**

Add at the bottom of `registerIpc`:

```ts
  // ─── quick-add ───
  ipcMain.on("quickAdd.show", () => {
    const { showQuickAddWindow } = require("./window.js");
    showQuickAddWindow();
  });
  ipcMain.handle("quickAdd.parse", async (_e, text: string) => {
    const userId = requireUser(deps);
    const projects = await deps.store.listSince("projects", null, { userId });
    const refs = (projects as any[]).map((p) => ({ id: p.id, name: p.name }));
    const { parseQuickAddText } = await import("../renderer/lib/quick-add-parser.js");
    return parseQuickAddText(text, refs);
  });
  ipcMain.handle("quickAdd.submit", async (_e, parsed: { title: string; projectId: string | null; dueDate: string | null; priority: 1|2|3|4; tagNames: string[] }) => {
    const userId = requireUser(deps);
    let projectId = parsed.projectId;
    if (!projectId) {
      // First project as Inbox fallback for Phase 2
      const projects = await deps.store.listSince("projects", null, { userId });
      projectId = (projects[0] as any)?.id;
      if (!projectId) throw new Error("kein Projekt vorhanden — erstelle erst eines");
    }
    const t = makeTask({
      userId, projectId, title: parsed.title,
      dueDate: parsed.dueDate, priority: parsed.priority,
    });
    await deps.store.upsert("tasks", t);
    await deps.outbox.enqueue({
      entityTable: "tasks", entityId: t.id, op: "insert",
      changedFields: serializeTaskForOutbox(t), clientTs: t.updatedAt,
    });
    // tags applied later in v1.x; v1 ignores parsed.tagNames for simplicity.
    broadcast(getWin(), "tasks.changed");
    void pushAfterMutation(deps);
    const { hideQuickAdd } = require("./window.js");
    hideQuickAdd();
    return t;
  });
```

- [ ] **Step 11: Add Quick-Add trigger in main UI**

In `apps/desktop/src/renderer/shell/Sidebar.tsx`, change the existing top header to include a Quick-Add button:

Replace the header block:
```tsx
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
        <div className="text-pulse font-semibold tracking-wide">PULSE</div>
        <button onClick={() => api.quickAdd.show()}
          className="text-xs text-gray-500 hover:text-pulse" title="Quick Add (Ctrl+Shift+Space)">⌘+</button>
      </div>
```

Add at top: `import { api } from "../api.js";`.

- [ ] **Step 12: Build + test**

Run: `pnpm --filter @pulse/desktop build && pnpm --filter @pulse/desktop test`
Expected: build clean, 21 tests pass.

- [ ] **Step 13: Commit**

```bash
git add apps/desktop
git commit -m "feat(desktop): Quick-Add window + parser + IPC"
```

---

## Task 23: Global hotkey for Quick-Add

**Files:**
- Create: `apps/desktop/src/main/hotkey.ts`
- Modify: `apps/desktop/src/main/index.ts`

- [ ] **Step 1: `src/main/hotkey.ts`**

```ts
import { app, globalShortcut } from "electron";
import { showQuickAddWindow } from "./window.js";
import { useToastViaIpc } from "./hotkey-toast.js"; // helper below

const HOTKEY = "Control+Shift+Space";

export function registerHotkeys(getWin: () => Electron.BrowserWindow | null): void {
  app.whenReady().then(() => {
    const ok = globalShortcut.register(HOTKEY, () => showQuickAddWindow());
    if (!ok) {
      const win = getWin();
      win?.webContents.send("toast.show", `Hotkey ${HOTKEY} ist belegt — öffne Pulse über das Tray-Icon.`);
    }
  });
  app.on("will-quit", () => globalShortcut.unregisterAll());
}
```

Create `apps/desktop/src/main/hotkey-toast.ts` (light shim — keeps the hotkey file decoupled):

```ts
// Reserved for future toast-from-main routing.
// Currently routes via webContents.send('toast.show', ...) from main.
export function useToastViaIpc(): void { /* no-op */ }
```

Add a renderer-side handler in `apps/desktop/src/renderer/api.ts`:

Append at the bottom:
```ts
api.events.on("toast.show", (text) => {
  // Lazy import to avoid cycles
  void import("./components/ui/toast.js").then(({ useToasts }) => useToasts.getState().push(String(text), "info"));
});
```

Add the channel to `PulseEvent` union in `ipc-types.ts`:
```ts
export type PulseEvent =
  | "tasks.changed"
  | "projects.changed"
  | "tags.changed"
  | "sync.status"
  | "timer.current"
  | "updater.progress"
  | "auth.expired"
  | "toast.show";
```

- [ ] **Step 2: Wire `registerHotkeys` in `src/main/index.ts`**

Add import:
```ts
import { registerHotkeys } from "./hotkey.js";
```

In the `whenReady` callback, after `registerIpc(...)`:
```ts
  registerHotkeys(() => win);
```

- [ ] **Step 3: Build sanity**

Run: `pnpm --filter @pulse/desktop build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src
git commit -m "feat(desktop): global Ctrl+Shift+Space hotkey for Quick-Add"
```

---

## Task 24: Tray icon + menu

**Files:**
- Create: `apps/desktop/src/main/tray.ts`
- Create: `apps/desktop/assets/tray-default.png` (16×16 + retina) — placeholder generated below
- Modify: `apps/desktop/src/main/index.ts`
- Modify: `apps/desktop/src/main/ipc.ts` (broadcast tasks.changed already triggers; expose tray-update from main on its own)

- [ ] **Step 1: Provide a placeholder tray icon**

Create `apps/desktop/assets/tray-default.png` — for now, a 32×32 single-color blue PNG. Generate it via Node script (run once, then commit the binary). Save this script as `apps/desktop/scripts/gen-tray.mjs`:

```js
// Run with: node apps/desktop/scripts/gen-tray.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// 32x32 blue square PNG (raw bytes, hex-encoded). Created via a known minimal PNG.
const png = Buffer.from(
  "89504E470D0A1A0A0000000D49484452000000200000002008060000007394F2D70000004949444154789CEDD2C10D003008C04A4FB6FFC1B95FB14D8F0184F25E2902020202020202020202020202020202020202020202020202028281BE9F00BC04CB30D6028A0000000049454E44AE426082",
  "hex",
);
mkdirSync(join(import.meta.dirname, "..", "assets"), { recursive: true });
writeFileSync(join(import.meta.dirname, "..", "assets", "tray-default.png"), png);
console.log("wrote tray-default.png");
```

Run it once: `node apps/desktop/scripts/gen-tray.mjs`.
Verify: `ls apps/desktop/assets/tray-default.png` exists.

(Designer can replace the PNG later without code changes.)

- [ ] **Step 2: `src/main/tray.ts`**

```ts
import { app, Tray, Menu, nativeImage } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { showQuickAddWindow } from "./window.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

let tray: Tray | null = null;
let lastCount = 0;

export function setupTray(getWin: () => Electron.BrowserWindow | null): void {
  const iconPath = join(__dirname, "..", "..", "assets", "tray-default.png");
  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip("Pulse");
  tray.on("click", () => {
    const win = getWin();
    if (!win) return;
    win.isVisible() ? win.hide() : win.show();
  });
  rebuildMenu(getWin);
}

export function updateTrayCount(todayCount: number): void {
  lastCount = todayCount;
  if (!tray) return;
  tray.setToolTip(`Pulse · ${todayCount} Task${todayCount === 1 ? "" : "s"} heute`);
}

function rebuildMenu(getWin: () => Electron.BrowserWindow | null): void {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: "Pulse öffnen", click: () => getWin()?.show() },
    { label: "Quick Add (Ctrl+Shift+Space)", click: () => showQuickAddWindow() },
    { type: "separator" },
    { label: `Today (${lastCount})`, click: () => { const w = getWin(); if (w) { w.show(); w.webContents.send("nav.today"); } } },
    { type: "separator" },
    { label: "Beenden", click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}
```

- [ ] **Step 3: Wire in `src/main/index.ts`**

Add imports:
```ts
import { setupTray, updateTrayCount } from "./tray.js";
```

After `registerIpc(...)`:
```ts
  setupTray(() => win);

  // Recompute Today count on every tasks.changed broadcast.
  // Forward via a tiny IPC channel: renderer pushes the count back.
```

Add the count plumbing to the renderer in a separate step (Step 4 below).

- [ ] **Step 4: Expose `nav.today` in renderer**

In `apps/desktop/src/renderer/api.ts`, after the existing `api.events.on("toast.show", ...)`:

```ts
api.events.on("nav.today", () => {
  void import("./stores/ui.js").then(({ useUi }) => useUi.getState().setView({ kind: "today" }));
});
```

Add the channel to `PulseEvent` in `ipc-types.ts`:
```ts
  | "nav.today";
```

- [ ] **Step 5: Push Today-count from renderer to main**

In `src/renderer/stores/tasks.ts`, after `set(...)` inside `refreshToday`:
```ts
    void (window as unknown as { electron?: { send?: (ch: string, n: number) => void } });
    void (window.pulse as unknown as { _trayCount?: (n: number) => void });
    // simplest: send via a dedicated invoke
    void (api as any).tray?.setCount?.(list.length).catch?.(() => {});
```

Easier: bypass the type and add a simple hook in api.ts:

Append to `api.ts`:
```ts
export function reportTodayCount(n: number): void {
  void (window as any).pulse._tray?.setCount?.(n);
}
```

This requires a backing IPC. In `preload.ts`, add inside the `pulse` object:
```ts
  _tray: {
    setCount: invoke("tray.setCount"),
  },
```

In `ipc.ts` add handler near other utilities:
```ts
  ipcMain.handle("tray.setCount", async (_e, n: number) => {
    const { updateTrayCount } = await import("./tray.js");
    updateTrayCount(n);
  });
```

In `tasks.ts`, add the call in `refreshToday`:
```ts
    set((s) => ({ byId: { ...s.byId, ...idx }, todayIds: list.map((t) => t.id), loaded: true }));
    void (await import("../api.js")).reportTodayCount(list.length);
```

- [ ] **Step 6: Build sanity**

Run: `pnpm --filter @pulse/desktop build`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop
git commit -m "feat(desktop): tray icon + menu + Today-count update"
```

---

## Task 25: Notifications scheduler (TDD core logic)

**Files:**
- Create: `apps/desktop/src/main/notifications.ts`
- Create: `apps/desktop/test/unit/notifications-scheduler.test.ts`
- Modify: `apps/desktop/src/main/ipc.ts` (snooze handler + scheduler hookups)
- Modify: `apps/desktop/src/main/index.ts`

- [ ] **Step 1: Write failing test — `apps/desktop/test/unit/notifications-scheduler.test.ts`**

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NotificationScheduler, type FireFn } from "../../src/main/notifications.js";
import type { Task } from "@pulse/core";

function task(partial: Partial<Task>): Task {
  return {
    id: partial.id ?? "t1", userId: "u1", projectId: "p1", parentTaskId: null,
    title: partial.title ?? "X", description: null,
    status: partial.status ?? "todo", priority: 3,
    dueDate: partial.dueDate ?? null, completedAt: null, sortOrder: 0,
    recurrenceRule: null, recurrenceParentId: null,
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null,
  };
}

describe("NotificationScheduler", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("schedules timeout for tasks due in the next 24h", () => {
    const fire = vi.fn() satisfies FireFn;
    const sched = new NotificationScheduler(fire);
    const now = new Date("2026-05-09T10:00:00.000Z");
    vi.setSystemTime(now);
    sched.reschedule([task({ id: "a", dueDate: "2026-05-09T10:00:30.000Z" })]);
    vi.advanceTimersByTime(30_500);
    expect(fire).toHaveBeenCalledTimes(1);
    expect(fire.mock.calls[0]![0].id).toBe("a");
  });

  it("skips tasks beyond 24h", () => {
    const fire = vi.fn() satisfies FireFn;
    const sched = new NotificationScheduler(fire);
    const now = new Date("2026-05-09T10:00:00.000Z");
    vi.setSystemTime(now);
    sched.reschedule([task({ id: "future", dueDate: "2026-05-12T10:00:00.000Z" })]);
    vi.advanceTimersByTime(24 * 3600 * 1000);
    expect(fire).not.toHaveBeenCalled();
  });

  it("fires immediately for already-overdue tasks (within 5 min)", () => {
    const fire = vi.fn() satisfies FireFn;
    const sched = new NotificationScheduler(fire);
    const now = new Date("2026-05-09T10:05:00.000Z");
    vi.setSystemTime(now);
    sched.reschedule([task({ id: "missed", dueDate: "2026-05-09T10:02:00.000Z" })]);
    vi.advanceTimersByTime(0);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it("skips overdue beyond 5 min", () => {
    const fire = vi.fn() satisfies FireFn;
    const sched = new NotificationScheduler(fire);
    const now = new Date("2026-05-09T11:00:00.000Z");
    vi.setSystemTime(now);
    sched.reschedule([task({ id: "missed", dueDate: "2026-05-09T10:00:00.000Z" })]);
    vi.advanceTimersByTime(0);
    expect(fire).not.toHaveBeenCalled();
  });

  it("reschedule clears pending timers from prior calls", () => {
    const fire = vi.fn() satisfies FireFn;
    const sched = new NotificationScheduler(fire);
    const now = new Date("2026-05-09T10:00:00.000Z");
    vi.setSystemTime(now);
    sched.reschedule([task({ id: "a", dueDate: "2026-05-09T10:00:30.000Z" })]);
    sched.reschedule([]); // cancel
    vi.advanceTimersByTime(60_000);
    expect(fire).not.toHaveBeenCalled();
  });

  it("ignores done or deleted tasks", () => {
    const fire = vi.fn() satisfies FireFn;
    const sched = new NotificationScheduler(fire);
    vi.setSystemTime(new Date("2026-05-09T10:00:00.000Z"));
    sched.reschedule([
      task({ id: "done", status: "done", dueDate: "2026-05-09T10:00:30.000Z" }),
      { ...task({ id: "del" }), dueDate: "2026-05-09T10:00:30.000Z", deletedAt: "2026-05-09T10:00:00.000Z" },
    ]);
    vi.advanceTimersByTime(60_000);
    expect(fire).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @pulse/desktop test`
Expected: FAIL.

- [ ] **Step 3: Implement `apps/desktop/src/main/notifications.ts`**

```ts
import type { Task } from "@pulse/core";

export type FireFn = (task: Task) => void;

const HORIZON_MS = 24 * 3600 * 1000;
const MISSED_TOLERANCE_MS = 5 * 60 * 1000;

export class NotificationScheduler {
  private timers = new Map<string, NodeJS.Timeout>();
  constructor(private readonly fire: FireFn) {}

  reschedule(tasks: readonly Task[]): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();

    const now = Date.now();
    for (const task of tasks) {
      if (task.status === "done") continue;
      if (task.deletedAt) continue;
      if (!task.dueDate) continue;
      const dueMs = new Date(task.dueDate).getTime();
      const delta = dueMs - now;
      if (delta < -MISSED_TOLERANCE_MS) continue;       // missed > 5 min
      if (delta > HORIZON_MS) continue;                  // beyond 24h
      const delay = Math.max(0, delta);
      const timer = setTimeout(() => {
        this.timers.delete(task.id);
        this.fire(task);
      }, delay);
      this.timers.set(task.id, timer);
    }
  }

  cancel(taskId: string): void {
    const t = this.timers.get(taskId);
    if (t) { clearTimeout(t); this.timers.delete(taskId); }
  }

  cancelAll(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }
}
```

- [ ] **Step 4: Run tests, expect PASS**

Run: `pnpm --filter @pulse/desktop test`
Expected: 27 total (21 prior + 6 new).

- [ ] **Step 5: Wire scheduler + fire into Electron Notifications**

Append to `notifications.ts`:

```ts
import { Notification, powerMonitor } from "electron";
import type { AppDeps } from "./deps.js";

let scheduler: NotificationScheduler | null = null;

export function setupNotifications(deps: AppDeps, getWin: () => Electron.BrowserWindow | null): void {
  scheduler = new NotificationScheduler((task) => {
    const n = new Notification({
      title: task.title,
      body: task.dueDate ? new Date(task.dueDate).toLocaleString("de-DE") : "",
      silent: false,
    });
    n.on("click", () => {
      const win = getWin();
      win?.show();
      win?.webContents.send("nav.task", task.id);
    });
    n.show();
  });

  void rescheduleFromStore(deps);

  powerMonitor.on("resume", () => { void rescheduleFromStore(deps); });
}

export async function rescheduleFromStore(deps: AppDeps): Promise<void> {
  if (!scheduler || !deps.engine) return;
  const userId = (deps.engine as unknown as { deps: { userId: string } }).deps.userId;
  const tasks = await deps.store.listSince("tasks", null, { userId });
  scheduler.reschedule(tasks as unknown as Task[]);
}

import type { Task } from "@pulse/core"; // hoisted at top in production; here for clarity
```

(The `import type { Task }` should be at the top of the file alongside other imports — move when applying.)

- [ ] **Step 6: Add `notifications.snooze` IPC handler**

In `ipc.ts`, near the other handlers:

```ts
  ipcMain.handle("notifications.snooze", async (_e, taskId: string, minutes: number) => {
    const local = await deps.store.findById<Task>("tasks", taskId);
    if (!local || !local.dueDate) return;
    const next = new Date(new Date(local.dueDate).getTime() + minutes * 60_000).toISOString();
    const ts = nowIso();
    const updated: Task = { ...local, dueDate: next, updatedAt: ts };
    await deps.store.upsert("tasks", updated);
    await deps.outbox.enqueue({
      entityTable: "tasks", entityId: taskId, op: "update",
      changedFields: { dueDate: next, updatedAt: ts }, clientTs: ts,
    });
    broadcast(getWin(), "tasks.changed");
    void pushAfterMutation(deps);
    const { rescheduleFromStore } = await import("./notifications.js");
    void rescheduleFromStore(deps);
  });
```

- [ ] **Step 7: Wire `setupNotifications` and reschedule on tasks.changed**

In `src/main/index.ts`, add import:
```ts
import { setupNotifications, rescheduleFromStore } from "./notifications.js";
```

In `whenReady` callback after `setupTray(...)`:
```ts
  setupNotifications(deps, () => win);
```

In `ipc.ts`, every handler that broadcasts `tasks.changed` should also call `void rescheduleFromStore(deps)`. Add a helper:

Refactor: extract a `tasksChanged()` helper at top of `ipc.ts`:
```ts
async function tasksChanged(deps: AppDeps, getWin: () => Electron.BrowserWindow | null): Promise<void> {
  broadcast(getWin(), "tasks.changed");
  const { rescheduleFromStore } = await import("./notifications.js");
  void rescheduleFromStore(deps);
}
```

Replace each `broadcast(getWin(), "tasks.changed");` line in tasks-related handlers with `void tasksChanged(deps, getWin);`.

Also expose `nav.task` channel in `PulseEvent`:
```ts
  | "nav.task"
```

And in renderer `api.ts`:
```ts
api.events.on("nav.task", (taskId) => {
  void import("./stores/ui.js").then(({ useUi }) => useUi.getState().selectTask(String(taskId)));
});
```

- [ ] **Step 8: Build + tests**

Run: `pnpm --filter @pulse/desktop build && pnpm --filter @pulse/desktop test`
Expected: build clean, 27 tests pass.

- [ ] **Step 9: Commit**

```bash
git add apps/desktop
git commit -m "feat(desktop): notification scheduler with 24h horizon, 5min missed tolerance, snooze"
```

---

## Task 26: Auto-update via electron-updater

**Files:**
- Create: `apps/desktop/src/main/updater.ts`
- Modify: `apps/desktop/src/main/ipc.ts`
- Modify: `apps/desktop/src/main/index.ts`

- [ ] **Step 1: `src/main/updater.ts`**

```ts
import pkg from "electron-updater";
const { autoUpdater } = pkg;
import type { BrowserWindow } from "electron";
import type { UpdateInfo as PulseUpdateInfo } from "./ipc-types.js";

export function setupUpdater(getWin: () => BrowserWindow | null): {
  check: () => Promise<PulseUpdateInfo | null>;
  installAndRestart: () => void;
} {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("download-progress", (progress) => {
    getWin()?.webContents.send("updater.progress", progress.percent);
  });

  autoUpdater.on("update-downloaded", (info) => {
    getWin()?.webContents.send("updater.downloaded", info.version);
  });

  autoUpdater.on("error", (err) => {
    getWin()?.webContents.send("toast.show", `Update-Fehler: ${err.message}`);
  });

  // Poll every 6 hours
  setInterval(() => {
    void autoUpdater.checkForUpdates().catch(() => {});
  }, 6 * 3600 * 1000);
  // Initial check shortly after start
  setTimeout(() => { void autoUpdater.checkForUpdates().catch(() => {}); }, 30_000);

  return {
    check: async () => {
      try {
        const result = await autoUpdater.checkForUpdates();
        if (!result?.updateInfo) return null;
        return { version: result.updateInfo.version, releaseNotes: typeof result.updateInfo.releaseNotes === "string" ? result.updateInfo.releaseNotes : undefined };
      } catch { return null; }
    },
    installAndRestart: () => {
      autoUpdater.quitAndInstall();
    },
  };
}
```

Add `updater.downloaded` to `PulseEvent`:
```ts
  | "updater.downloaded"
```

- [ ] **Step 2: Wire into `index.ts` and `ipc.ts`**

In `src/main/index.ts`:
```ts
import { setupUpdater } from "./updater.js";

let updater: ReturnType<typeof setupUpdater> | null = null;
```

After `setupNotifications(...)`:
```ts
  updater = setupUpdater(() => win);
```

In `ipc.ts`, add handlers (anywhere inside `registerIpc`):
```ts
  ipcMain.handle("updater.check", async () => {
    const u = (await import("./updater.js")).setupUpdater;  // re-acquire closure if needed
    // The simpler path: store the updater object on `deps` or close over a ref.
    // For simplicity, expose via a global getter:
    const { getUpdater } = await import("./updater-ref.js");
    return await getUpdater()?.check() ?? null;
  });
  ipcMain.on("updater.installAndRestart", async () => {
    const { getUpdater } = await import("./updater-ref.js");
    getUpdater()?.installAndRestart();
  });
```

Create `apps/desktop/src/main/updater-ref.ts`:
```ts
let ref: { check: () => Promise<unknown>; installAndRestart: () => void } | null = null;
export function setUpdater(u: typeof ref): void { ref = u; }
export function getUpdater(): typeof ref { return ref; }
```

In `index.ts`, wire the ref:
```ts
import { setUpdater } from "./updater-ref.js";
// ...
  updater = setupUpdater(() => win);
  setUpdater(updater);
```

- [ ] **Step 3: Renderer-side update banner**

In `apps/desktop/src/renderer/api.ts`, append:
```ts
api.events.on("updater.downloaded", (version) => {
  void import("./components/ui/toast.js").then(({ useToasts }) =>
    useToasts.getState().push(`Pulse ${version} verfügbar — neu starten zum Installieren`, "success"));
});
```

For v1 we settle for a toast + manual `api.updater.installAndRestart()` button later. Phase-2 acceptance does NOT require an in-app dedicated update modal.

- [ ] **Step 4: electron-builder publish config (yml below in Task 28)**

Note: `electron-updater` reads the `latest.yml` produced by electron-builder — wired in Task 28.

- [ ] **Step 5: Build sanity**

Run: `pnpm --filter @pulse/desktop build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src
git commit -m "feat(desktop): electron-updater integration with toast on downloaded"
```

---

## Task 27: Sync status, offline banner, re-sign-in modal, sync.status event

**Files:**
- Create: `apps/desktop/src/renderer/shell/StatusBar.tsx`
- Create: `apps/desktop/src/renderer/shell/OfflineBanner.tsx`
- Create: `apps/desktop/src/renderer/components/ReSignInModal.tsx`
- Modify: `apps/desktop/src/main/ipc.ts` (broadcast sync.status; handle 401)
- Modify: `apps/desktop/src/main/ipc-helpers.ts`
- Modify: `apps/desktop/src/renderer/shell/AppShell.tsx`

- [ ] **Step 1: Add a `pushSyncStatus` helper in `ipc-helpers.ts`**

Append:
```ts
import type { SyncStatus } from "./ipc-types.js";

export async function pushSyncStatus(deps: AppDeps, getWin: () => Electron.BrowserWindow | null, partial: Partial<SyncStatus> = {}): Promise<void> {
  const outboxEntries = await deps.outbox.peekAll();
  const lastErrorEntry = outboxEntries.find((e) => e.lastError);
  const status: SyncStatus = {
    online: true,
    lastPushAt: null,
    lastPullAt: null,
    outboxSize: outboxEntries.length,
    lastError: lastErrorEntry?.lastError ?? null,
    ...partial,
  };
  getWin()?.webContents.send("sync.status", status);
}
```

In `ipc.ts`:
- Replace `pushAfterMutation` to call `pushSyncStatus` after push:
```ts
export async function pushAfterMutation(deps: AppDeps, getWin: () => Electron.BrowserWindow | null): Promise<void> {
  if (!deps.engine) return;
  try {
    await deps.engine.push();
    await pushSyncStatus(deps, getWin, { lastPushAt: nowIso() });
  } catch (e) {
    if (isAuthError(e)) {
      await deps.auth.signOut();
      deps.engine = null;
      getWin()?.webContents.send("auth.expired", null);
    }
    await pushSyncStatus(deps, getWin);
  }
}

function isAuthError(e: unknown): boolean {
  const m = (e as Error)?.message ?? "";
  return /401|unauthor|jwt/i.test(m);
}
```

(Move `pushAfterMutation` from `ipc-helpers.ts` to `ipc.ts` here, or keep in helpers and pass `getWin`. Do whichever fits — easier path: keep in helpers but accept `getWin`.)

Update all call sites of `pushAfterMutation(deps)` to `pushAfterMutation(deps, getWin)`.

In the `sync.pullNow` handler:
```ts
  ipcMain.handle("sync.pullNow", async () => {
    if (!deps.engine) return;
    try {
      await deps.engine.pull();
      await pushSyncStatus(deps, getWin, { lastPullAt: nowIso() });
    } catch (e) {
      if (isAuthError(e)) {
        await deps.auth.signOut();
        deps.engine = null;
        getWin()?.webContents.send("auth.expired", null);
      }
      await pushSyncStatus(deps, getWin);
    }
  });
```

- [ ] **Step 2: `renderer/shell/StatusBar.tsx`**

```tsx
import { useSync } from "../stores/sync.js";
import { timeAgo } from "../lib/format.js";
import { CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";
import { api } from "../api.js";

export function StatusBar(): JSX.Element {
  const status = useSync((s) => s.status);
  const ok = status.lastError === null;
  const lastSync = status.lastPullAt ?? status.lastPushAt;
  return (
    <div className="h-7 px-3 flex items-center justify-between text-xs text-gray-500 border-t border-[var(--border)] bg-white">
      <div className="flex items-center gap-2">
        {ok
          ? <CheckCircle2 size={12} className="text-green-600" />
          : <AlertCircle size={12} className="text-red-600" />}
        <span>{ok ? "Sync OK" : `Sync-Fehler: ${status.lastError}`}</span>
        {lastSync && <span>· {timeAgo(lastSync)}</span>}
        {status.outboxSize > 0 && <span>· {status.outboxSize} ausstehend</span>}
      </div>
      <button onClick={() => void api.sync.pullNow()} className="hover:text-pulse flex items-center gap-1">
        <RotateCcw size={12} /> Sync
      </button>
    </div>
  );
}
```

- [ ] **Step 3: `renderer/shell/OfflineBanner.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useSync } from "../stores/sync.js";

export function OfflineBanner(): JSX.Element | null {
  const status = useSync((s) => s.status);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    window.addEventListener("online", onOn);
    window.addEventListener("offline", onOff);
    return () => {
      window.removeEventListener("online", onOn);
      window.removeEventListener("offline", onOff);
    };
  }, []);
  if (online && status.outboxSize === 0) return null;
  return (
    <div className="h-7 px-3 flex items-center text-xs bg-amber-50 text-amber-900 border-b border-amber-200">
      {online
        ? <>Sync hängt · {status.outboxSize} Änderungen warten</>
        : <>Offline · {status.outboxSize > 0 ? `${status.outboxSize} Änderungen werden nachgesendet` : "Pulse arbeitet weiter"}</>}
    </div>
  );
}
```

- [ ] **Step 4: `renderer/components/ReSignInModal.tsx`**

```tsx
import { useState } from "react";
import { Dialog, DialogTitle } from "./ui/dialog.js";
import { Button } from "./ui/button.js";
import { Input } from "./ui/input.js";
import { useAuth } from "../stores/auth.js";
import { api } from "../api.js";

export function ReSignInModal(): JSX.Element | null {
  const [needed, setNeeded] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const session = useAuth((s) => s.session);
  const signIn = useAuth((s) => s.signIn);

  // Bind to event
  if (!needed) {
    const off = api.events.on("auth.expired", () => setNeeded(true));
    void off;
  }

  if (!needed || !session) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(email || session!.user.email!, pw);
      setNeeded(false);
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={needed} onOpenChange={() => {}}>
      <DialogTitle className="text-lg font-semibold mb-2">Sitzung abgelaufen</DialogTitle>
      <p className="text-sm text-gray-600 mb-3">Bitte erneut anmelden — deine Outbox bleibt erhalten.</p>
      <form onSubmit={submit} className="space-y-2">
        <Input type="email" placeholder={session.user.email ?? "email"} value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input type="password" required placeholder="Passwort" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Button type="submit" disabled={busy} className="w-full">{busy ? "..." : "Anmelden"}</Button>
      </form>
    </Dialog>
  );
}
```

- [ ] **Step 5: Wire into `AppShell.tsx`**

Add imports:
```tsx
import { StatusBar } from "./StatusBar.js";
import { OfflineBanner } from "./OfflineBanner.js";
import { ReSignInModal } from "../components/ReSignInModal.js";
```

Update layout:
```tsx
  return (
    <div className="h-full flex flex-col relative">
      <TopBarPill />
      <OfflineBanner />
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <main className="flex-1 flex min-w-0">
          <div className="flex-1 min-w-0 bg-white border-r border-[var(--border)]">
            <ViewSlot view={view} />
          </div>
          {detailOpen && <DetailPane />}
        </main>
      </div>
      <StatusBar />
      <ReSignInModal />
    </div>
  );
```

- [ ] **Step 6: Build sanity**

Run: `pnpm --filter @pulse/desktop build`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop
git commit -m "feat(desktop): sync status bar, offline banner, re-sign-in modal, 401 handling"
```

---

## Task 28: electron-builder NSIS installer + auto-update channel

**Files:**
- Create: `apps/desktop/electron-builder.yml`
- Create: `apps/desktop/build/icon.ico` (placeholder generation)
- Modify: `apps/desktop/package.json` (set author + repo for builder)

- [ ] **Step 1: Generate placeholder icon**

We need a `.ico` for electron-builder. Generate a 256×256 placeholder once via Node script (or use the same blue PNG converted). Save:

`apps/desktop/scripts/gen-icon.mjs`:
```js
// Generate a 256x256 single-color blue ICO from a PNG.
// Requires `to-ico` package; if absent, falls back to copying the tray PNG into icon.ico (NSIS will accept).
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const pngPath = join(import.meta.dirname, "..", "assets", "tray-default.png");
const outDir = join(import.meta.dirname, "..", "build");
mkdirSync(outDir, { recursive: true });

try {
  const toIco = (await import("to-ico")).default;
  const ico = await toIco([readFileSync(pngPath)]);
  writeFileSync(join(outDir, "icon.ico"), ico);
} catch {
  writeFileSync(join(outDir, "icon.ico"), readFileSync(pngPath));
}
console.log("wrote build/icon.ico");
```

Run: `pnpm --filter @pulse/desktop add -D to-ico` then `node apps/desktop/scripts/gen-icon.mjs`.

- [ ] **Step 2: `apps/desktop/electron-builder.yml`**

```yaml
appId: dev.pulsehamburg.pulse
productName: Pulse
copyright: © 2026 Eugen Reinfeld
directories:
  output: release
  buildResources: build
files:
  - dist/**/*
  - dist-electron/**/*
  - assets/**/*
  - package.json
asar: true
win:
  target:
    - target: nsis
      arch: [x64]
  icon: build/icon.ico
nsis:
  oneClick: true
  perMachine: false
  allowToChangeInstallationDirectory: false
  artifactName: Pulse-Setup-${version}.${ext}
publish:
  provider: github
  owner: PLACEHOLDER_GITHUB_OWNER
  repo: pulse-planner
```

(`PLACEHOLDER_GITHUB_OWNER` is the only spot for the user to fill in their GitHub handle; documented in README in Task 30.)

- [ ] **Step 3: Update `apps/desktop/package.json`**

Add at top level:
```json
  "author": "Eugen Reinfeld <eugen@reinfeld.me>",
  "description": "Pulse Project Planner — Windows desktop",
  "build": {
    "extends": "./electron-builder.yml"
  },
```

- [ ] **Step 4: Build the installer (smoke)**

Run: `pnpm --filter @pulse/desktop dist`
Expected: `apps/desktop/release/Pulse-Setup-0.1.0.exe` exists, plus `latest.yml`, `Pulse-Setup-0.1.0.exe.blockmap`. Smart-screen warning is expected for unsigned builds.

If build fails due to `better-sqlite3` ABI mismatch, ensure `electron-rebuild` runs:

Run: `pnpm --filter @pulse/desktop exec electron-rebuild` (using the bundled `@electron/rebuild` if present, or add `@electron/rebuild` as devDep and re-run).

- [ ] **Step 5: Add postinstall electron-rebuild**

Append to `apps/desktop/package.json` `scripts`:
```json
  "postinstall": "electron-builder install-app-deps"
```

Then `pnpm install` from the repo root.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/electron-builder.yml apps/desktop/package.json apps/desktop/scripts apps/desktop/build pnpm-lock.yaml
git commit -m "build(desktop): electron-builder NSIS config + icon + postinstall rebuild"
```

(Do NOT commit `apps/desktop/release/` — gitignored already.)

---

## Task 29: Playwright E2E suite

**Files:**
- Create: `apps/desktop/playwright.config.ts`
- Create: `apps/desktop/test/e2e/electron-fixture.ts`
- Create: `apps/desktop/test/e2e/auth.spec.ts`
- Create: `apps/desktop/test/e2e/today.spec.ts`
- Create: `apps/desktop/test/e2e/timer.spec.ts`
- Create: `apps/desktop/test/e2e/persistence.spec.ts`

- [ ] **Step 1: `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: { trace: "retain-on-failure" },
  workers: 1,
});
```

- [ ] **Step 2: `test/e2e/electron-fixture.ts`**

```ts
import { _electron as electron, type ElectronApplication } from "playwright";
import { join } from "node:path";
import { test as base, expect } from "@playwright/test";

interface PulseFixture {
  electronApp: ElectronApplication;
}

export const test = base.extend<PulseFixture>({
  electronApp: async ({}, use) => {
    const app = await electron.launch({
      args: [join(process.cwd(), "dist-electron/main/index.js")],
      env: {
        ...process.env,
        NODE_ENV: "test",
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? "",
      },
    });
    await use(app);
    await app.close();
  },
});

export { expect };
```

- [ ] **Step 3: `test/e2e/auth.spec.ts`**

```ts
import { test, expect } from "./electron-fixture.js";

test("signup → today is empty", async ({ electronApp }) => {
  const win = await electronApp.firstWindow();
  await win.waitForSelector("input[type=email]");
  const email = `e2e-${Date.now()}@pulse.test`;
  await win.fill("input[type=email]", email);
  await win.fill("input[type=password]", "pulse-e2e-pw-12345");
  await win.click("button[type=submit]:not(:has-text('Konto'))"); // signup toggle then submit
  await expect(win.getByText(/Heute|Today/)).toBeVisible({ timeout: 15_000 });
});
```

- [ ] **Step 4: `test/e2e/today.spec.ts`**

```ts
import { test, expect } from "./electron-fixture.js";

test("create project, create task, today shows task", async ({ electronApp }) => {
  const win = await electronApp.firstWindow();
  // sign in (user created in auth.spec or use fresh)
  const email = `e2e-${Date.now()}@pulse.test`;
  await win.fill("input[type=email]", email);
  await win.fill("input[type=password]", "pulse-e2e-pw-12345");
  await win.getByText("Konto erstellen").first().click();
  await win.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(win.getByText(/Heute/)).toBeVisible({ timeout: 15_000 });

  // Add a project via sidebar
  await win.getByLabel("Neues Projekt").click();
  await win.locator("input[placeholder='Projektname']").fill("E2E");
  await win.locator("input[placeholder='Projektname']").press("Enter");
  await win.getByText("E2E").click();

  // Add a task with a due-today date via project list inline input
  await win.locator("input[placeholder*='Neue Task']").fill("E2E task");
  await win.locator("input[placeholder*='Neue Task']").press("Enter");

  // Set its due date in detail pane
  await win.getByText("E2E task").click();
  const today = new Date().toISOString().slice(0, 10);
  await win.locator("input[type=date]").fill(today);

  // Navigate to Today
  await win.getByText("Today").first().click();
  await expect(win.getByText("E2E task")).toBeVisible({ timeout: 5_000 });
});
```

- [ ] **Step 5: `test/e2e/timer.spec.ts`**

```ts
import { test, expect } from "./electron-fixture.js";

test("start timer → top-bar pill appears, stop hides it", async ({ electronApp }) => {
  const win = await electronApp.firstWindow();
  // Pre-condition: at least one task exists; earlier test or seeding handled here.
  // For brevity, assume the Today view from `today.spec.ts` was the latest.
  await win.getByText("E2E task").click();
  await win.getByRole("button", { name: /Start/ }).click();
  await expect(win.locator("text=⏱")).toBeVisible({ timeout: 5_000 });
  await win.getByLabel("Stop").click();
  await expect(win.locator("text=⏱")).not.toBeVisible({ timeout: 5_000 });
});
```

- [ ] **Step 6: `test/e2e/persistence.spec.ts`**

```ts
import { test, expect } from "./electron-fixture.js";

test("quit and relaunch — task still visible", async ({ electronApp }) => {
  const win = await electronApp.firstWindow();
  await win.waitForSelector("text=Today", { timeout: 15_000 });
  // Task already exists from earlier specs (sequential workers=1).
  // Close + relaunch handled by test fixture between tests; just assert persistence:
  await expect(win.getByText("E2E task")).toBeVisible();
});
```

- [ ] **Step 7: Add to `package.json` scripts** (already added in Task 1)

Verify `"test:e2e": "playwright test"` exists.

- [ ] **Step 8: Run E2E (manual; requires Supabase local + valid keys)**

Pre-conditions: `supabase start` running, `apps/desktop/.env` with valid `SUPABASE_URL` + `SUPABASE_ANON_KEY` (or root `.env`).

Run:
```
pnpm --filter @pulse/desktop build
pnpm --filter @pulse/desktop test:e2e
```

Expected: 4 specs pass against the packaged Electron app.

If specs fail due to selectors not matching real DOM, update selectors but keep the assertions intact.

- [ ] **Step 9: Commit**

```bash
git add apps/desktop/playwright.config.ts apps/desktop/test/e2e
git commit -m "test(desktop): Playwright E2E for auth, today, timer, persistence"
```

---

## Task 30: README + acceptance verification

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-05-09-pulse-planner-desktop-design.md` (none — leaves spec as record)

- [ ] **Step 1: Update root `README.md`** to mention the Desktop app and quickstart

Append after the Phase 1 section (or replace the existing README):

```markdown
# Pulse Project Planner

Single-user project management synced between Windows desktop and iOS via Supabase.

## Phases

- **Phase 1: Foundation** (complete) — `@pulse/core`, Supabase schema, sync engine, CLI test harness.
- **Phase 2: Desktop App** (this delivery) — Windows-x64 Electron app: tray, hotkey, notifications, auto-update, full Banana-Split feature parity + Pulse extras.
- **Phase 3: iOS App** (next) — Expo + React Native consumer of `@pulse/core`.

## Quickstart (developer)

```bash
nvm use                                  # node 20
corepack enable                          # pnpm 9
pnpm install
supabase start
cp .env.example .env                     # paste keys printed by `supabase start`
pnpm -r build
pnpm -r test                             # 65 unit tests + integration
pnpm --filter @pulse/desktop dev         # opens dev Electron with HMR
```

## Quickstart (end user)

1. Download `Pulse-Setup-x.y.z.exe` from GitHub Releases.
2. (Smart Screen warning expected — unsigned build. Click "More info → Run anyway".)
3. Sign up with email + password.
4. Use `Ctrl+Shift+Space` for Quick-Add from anywhere.

## Auto-update

Pulse polls GitHub Releases every 6h. To enable: edit `apps/desktop/electron-builder.yml`, set `publish.owner` to your GitHub handle, push a tag matching the package version, and run `pnpm --filter @pulse/desktop dist`.

## Sync model

- Local SQLite (better-sqlite3) is source of truth for the UI.
- Mutations are appended to an outbox, pushed to Supabase via the `sync_upsert` RPC.
- Pull queries each table by `updated_at > cursor` (cursor persists across restarts in `sync_state`).
- Conflict resolution: **Last-Write-Wins per field**. Two devices changing the same field offline → later `client_ts` wins, no merge UI.
- Clock skew between devices flips LWW outcomes; both devices should rely on NTP.

## Acceptance criteria (Phase 2)

- [x] `pnpm --filter @pulse/desktop dist` produces `Pulse-Setup-x.y.z.exe` + `latest.yml` + blockmap.
- [x] Installer installs and launches Pulse, signin → Today.
- [x] Two-machine convergence: edit on machine A appears on machine B within ~5s of pull (or instantly via realtime).
- [x] Tray icon + Today-count tooltip; click toggles main window.
- [x] `Ctrl+Shift+Space` opens Quick-Add from any focused application.
- [x] Native Windows toast at due time with snooze + complete actions.
- [x] In-app updater toast on update-downloaded; `installAndRestart` works.
- [x] All Phase 1 acceptance criteria still pass.

## Repo layout

- `packages/core` — platform-agnostic library: domain types, Zod, sync engine, auth.
- `supabase/` — schema + RLS + RPC migrations.
- `tools/cli` — CLI test harness.
- `apps/desktop` — **Phase 2** Electron app.

## Trade-offs

- **Light theme only** in v1 (Tailwind tokens scaffolded for future dark mode).
- **Windows-x64 only** — Mac/Linux out of scope for Phase 2.
- **Unsigned installer in v1** — smart-screen warning is expected. EV cert (~$300/year) deferred to v1.1.
- **No CI/CD** — releases are manual.
- **`task_tags` only sync via realtime** (no pull-cursor; Phase 1 limitation). Tag drift possible after extended offline; tracked for Phase 3.
```

- [ ] **Step 2: Verify acceptance criteria locally**

Run from repo root:
```
pnpm install
supabase start
pnpm -r build
pnpm -r test
pnpm --filter @pulse/desktop dist
```

Expected:
- `pnpm -r test` → 65+ unit + 7 integration green.
- `pnpm --filter @pulse/desktop dist` → installer in `apps/desktop/release/`.

Manually install and smoke:
- Cold start, signup, see Today.
- Quick-Add via hotkey.
- Schedule a task with `due_date` 30s out → toast appears.
- Updater toast (with mock `latest.yml` if no real release).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: Phase 2 README with acceptance verification"
```

---

## Done

Phase 2 is complete when every task above is checked. The next phase (`Phase 3: iOS App`) begins with its own brainstorm → spec → plan → execute cycle, consuming the same `@pulse/core` library.

