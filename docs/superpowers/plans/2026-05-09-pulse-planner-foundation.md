# Pulse Project Planner — Foundation (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the platform-agnostic foundation of Pulse Project Planner: a TypeScript core library, a Supabase backend with schema and RLS, an offline-first sync engine with per-field LWW conflict resolution, an auth wrapper, and a CLI test harness that proves two clients converge correctly.

**Architecture:** pnpm monorepo. `packages/core` is platform-agnostic — it owns domain types, Zod validators, the LocalStore interface, the SyncEngine, and AuthService. Persistence (SQLite) is injected via the LocalStore interface so desktop (better-sqlite3) and mobile (expo-sqlite) can plug in their own adapters in later phases. A `tools/cli` test harness uses an in-memory store to drive integration tests against a local Supabase via the Supabase CLI.

**Tech Stack:** TypeScript 5.x (strict), pnpm workspaces, Vitest, Zod 3.x, Supabase JS v2, Supabase CLI, ESLint, Prettier, uuidv7, RRule (`rrule` npm package).

**Spec:** `docs/superpowers/specs/2026-05-09-pulse-planner-foundation-design.md`

---

## File Map

```
pulse-project-planner/
├── package.json                          # workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
├── .nvmrc                                # node 20
├── README.md
├── packages/
│   └── core/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       ├── src/
│       │   ├── index.ts                  # public exports
│       │   ├── domain/
│       │   │   ├── ids.ts                # uuidv7 wrapper
│       │   │   ├── timestamps.ts         # ISO timestamp helpers
│       │   │   ├── project.ts            # type + Zod
│       │   │   ├── task.ts               # type + Zod, recurrence
│       │   │   ├── tag.ts
│       │   │   ├── task-tag.ts
│       │   │   ├── attachment.ts
│       │   │   ├── time-entry.ts
│       │   │   ├── comment.ts
│       │   │   ├── note.ts
│       │   │   ├── activity.ts
│       │   │   └── index.ts
│       │   ├── store/
│       │   │   ├── local-store.ts        # interface
│       │   │   ├── in-memory-store.ts
│       │   │   └── index.ts
│       │   ├── sync/
│       │   │   ├── outbox.ts             # in-memory outbox queue
│       │   │   ├── conflict.ts           # per-field LWW pure logic
│       │   │   ├── sync-engine.ts        # push/pull/realtime orchestration
│       │   │   └── index.ts
│       │   ├── auth/
│       │   │   ├── token-storage.ts      # interface
│       │   │   ├── auth-service.ts
│       │   │   └── index.ts
│       │   └── supabase/
│       │       ├── client.ts             # typed factory
│       │       ├── types.ts              # generated DB types (manual stub initially)
│       │       └── index.ts
│       └── test/
│           ├── unit/
│           │   ├── ids.test.ts
│           │   ├── timestamps.test.ts
│           │   ├── domain.test.ts
│           │   ├── conflict.test.ts
│           │   ├── outbox.test.ts
│           │   └── in-memory-store.test.ts
│           └── integration/
│               ├── helpers/
│               │   ├── supabase-test.ts  # local Supabase URL/anon key, signup helper
│               │   └── client.ts         # builds a SyncEngine + InMemoryStore
│               ├── two-clients.test.ts
│               ├── conflict-scenarios.test.ts
│               ├── failure-scenarios.test.ts
│               └── rls.test.ts
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 20260509000001_init_schema.sql
│       ├── 20260509000002_rls.sql
│       ├── 20260509000003_triggers.sql
│       └── 20260509000004_sync_upsert.sql
└── tools/
    └── cli/
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── index.ts                  # commander setup
            └── commands/
                ├── signin.ts
                ├── signup.ts
                ├── project.ts
                ├── task.ts
                └── sync.ts
```

---

## Task 1: Workspace Skeleton

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.env.example`, `.nvmrc`, `README.md`
- Already exists: `.gitignore`

- [ ] **Step 1: Create `.nvmrc`**

```
20
```

- [ ] **Step 2: Create `package.json` at repo root**

```json
{
  "name": "pulse-project-planner",
  "private": true,
  "version": "0.1.0",
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "supabase:start": "supabase start",
    "supabase:reset": "supabase db reset",
    "supabase:stop": "supabase stop"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^20.12.0",
    "prettier": "^3.3.0",
    "eslint": "^9.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0"
  }
}
```

- [ ] **Step 3: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
  - "tools/*"
```

- [ ] **Step 4: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 5: Create `.env.example`**

```
# Local Supabase (provided by `supabase start`)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJhbGciOi...REPLACE_AFTER_supabase_start
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...REPLACE_AFTER_supabase_start

# Test user used by integration tests
TEST_USER_EMAIL=test@pulse.local
TEST_USER_PASSWORD=changeme-please
```

- [ ] **Step 6: Create stub `README.md`**

```markdown
# Pulse Project Planner

Single-user project management synced between Windows desktop and iOS.

This repo is the **Phase 1 (Foundation)**: monorepo, Supabase backend,
sync engine, CLI test harness. UI apps come in Phase 2 (Desktop) and
Phase 3 (iOS).

## Setup

1. Install Node 20 (`nvm use`) and pnpm 9 (`corepack enable`).
2. Install Supabase CLI: https://supabase.com/docs/guides/cli
3. `pnpm install`
4. `supabase start` and copy the printed `anon key` into a `.env` file
   based on `.env.example`.
5. `pnpm test`

## Trade-offs

- **Conflict resolution** is per-field Last-Write-Wins. Two devices
  changing the *same field* offline → the later `client_ts` wins, no
  merge UI. Acceptable for single-user use.
- **Clock skew** between devices may cause surprising LWW outcomes if
  one device's clock is wildly off. Both devices should rely on NTP.
- **Local SQLite is unencrypted at rest** in the desktop adapter
  (planned for Phase 2). iOS app sandbox provides OS-level protection.

See `docs/superpowers/specs/2026-05-09-pulse-planner-foundation-design.md`.
```

- [ ] **Step 7: Install root dev deps**

Run: `pnpm install`
Expected: `node_modules` created, `pnpm-lock.yaml` written, no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .env.example .nvmrc README.md pnpm-lock.yaml
git commit -m "chore: workspace skeleton"
```

---

## Task 2: `packages/core` Skeleton

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`, `packages/core/src/index.ts`, `packages/core/test/unit/.gitkeep`

- [ ] **Step 1: Create `packages/core/package.json`**

```json
{
  "name": "@pulse/core",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src test"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "uuidv7": "^1.0.2",
    "zod": "^3.23.0",
    "rrule": "^2.8.1"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Create `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `packages/core/vitest.config.ts`**

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

- [ ] **Step 4: Create stub `packages/core/src/index.ts`**

```ts
export const PULSE_CORE_VERSION = "0.1.0";
```

- [ ] **Step 5: Install workspace deps**

Run: `pnpm install`
Expected: `@pulse/core` resolved, no errors.

- [ ] **Step 6: Verify build + (empty) test**

Run: `pnpm --filter @pulse/core build && pnpm --filter @pulse/core test`
Expected: build emits `dist/index.js`; test reports "No test files found" (acceptable; we add tests next).

- [ ] **Step 7: Commit**

```bash
git add packages/core
git commit -m "chore(core): package skeleton"
```

---

## Task 3: ID and Timestamp Helpers (TDD)

**Files:**
- Create: `packages/core/src/domain/ids.ts`, `packages/core/src/domain/timestamps.ts`
- Test: `packages/core/test/unit/ids.test.ts`, `packages/core/test/unit/timestamps.test.ts`

- [ ] **Step 1: Write failing tests for `ids.ts`**

Create `packages/core/test/unit/ids.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { newId, isValidId } from "../../src/domain/ids.js";

describe("ids", () => {
  it("newId returns a 36-char uuid string", () => {
    const id = newId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("newId values are sortable by creation time", async () => {
    const a = newId();
    await new Promise((r) => setTimeout(r, 5));
    const b = newId();
    expect(a < b).toBe(true);
  });

  it("isValidId accepts uuidv7", () => {
    expect(isValidId(newId())).toBe(true);
  });

  it("isValidId rejects garbage", () => {
    expect(isValidId("not-a-uuid")).toBe(false);
    expect(isValidId("")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `pnpm --filter @pulse/core test`
Expected: FAIL — module `../../src/domain/ids.js` not found.

- [ ] **Step 3: Implement `packages/core/src/domain/ids.ts`**

```ts
import { uuidv7 } from "uuidv7";

const UUID_V7_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function newId(): string {
  return uuidv7();
}

export function isValidId(s: string): boolean {
  return UUID_V7_RE.test(s);
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `pnpm --filter @pulse/core test`
Expected: 4 passing.

- [ ] **Step 5: Write failing tests for `timestamps.ts`**

Create `packages/core/test/unit/timestamps.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nowIso, parseIso, isValidIso, maxIso } from "../../src/domain/timestamps.js";

describe("timestamps", () => {
  it("nowIso returns parseable ISO 8601 with Z suffix", () => {
    const s = nowIso();
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(isNaN(Date.parse(s))).toBe(false);
  });

  it("parseIso round-trips", () => {
    const s = "2026-05-09T12:34:56.789Z";
    expect(parseIso(s).toISOString()).toBe(s);
  });

  it("isValidIso accepts/rejects", () => {
    expect(isValidIso("2026-05-09T00:00:00.000Z")).toBe(true);
    expect(isValidIso("not a date")).toBe(false);
    expect(isValidIso("")).toBe(false);
  });

  it("maxIso returns the later of two ISO strings", () => {
    const a = "2026-05-09T00:00:00.000Z";
    const b = "2026-05-10T00:00:00.000Z";
    expect(maxIso(a, b)).toBe(b);
    expect(maxIso(b, a)).toBe(b);
    expect(maxIso(a, a)).toBe(a);
  });
});
```

- [ ] **Step 6: Implement `packages/core/src/domain/timestamps.ts`**

```ts
export type IsoTimestamp = string;

export function nowIso(): IsoTimestamp {
  return new Date().toISOString();
}

export function parseIso(s: IsoTimestamp): Date {
  const d = new Date(s);
  if (isNaN(d.getTime())) {
    throw new Error(`invalid ISO timestamp: ${s}`);
  }
  return d;
}

export function isValidIso(s: unknown): s is IsoTimestamp {
  return typeof s === "string" && !isNaN(Date.parse(s));
}

export function maxIso(a: IsoTimestamp, b: IsoTimestamp): IsoTimestamp {
  return parseIso(a).getTime() >= parseIso(b).getTime() ? a : b;
}
```

- [ ] **Step 7: Run tests, expect all pass**

Run: `pnpm --filter @pulse/core test`
Expected: 8 passing.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/domain packages/core/test/unit
git commit -m "feat(core): id and timestamp helpers"
```

---

## Task 4: Domain Types — Project (TDD)

**Files:**
- Create: `packages/core/src/domain/project.ts`, `packages/core/src/domain/index.ts`
- Test: extend `packages/core/test/unit/domain.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/core/test/unit/domain.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ProjectSchema, makeProject } from "../../src/domain/project.js";

describe("Project", () => {
  it("makeProject populates defaults", () => {
    const p = makeProject({ userId: "user-uuid", name: "Website" });
    expect(p.id).toBeTypeOf("string");
    expect(p.userId).toBe("user-uuid");
    expect(p.name).toBe("Website");
    expect(p.color).toBe("#2563eb");
    expect(p.archived).toBe(false);
    expect(p.sortOrder).toBe(0);
    expect(p.createdAt).toBe(p.updatedAt);
    expect(p.deletedAt).toBeNull();
  });

  it("ProjectSchema rejects empty name", () => {
    const r = ProjectSchema.safeParse({
      id: "00000000-0000-7000-8000-000000000000",
      userId: "00000000-0000-7000-8000-000000000001",
      name: "",
      color: "#2563eb",
      archived: false,
      sortOrder: 0,
      createdAt: "2026-05-09T00:00:00.000Z",
      updatedAt: "2026-05-09T00:00:00.000Z",
      deletedAt: null,
    });
    expect(r.success).toBe(false);
  });

  it("ProjectSchema accepts a valid project", () => {
    const r = ProjectSchema.safeParse(
      makeProject({ userId: "00000000-0000-7000-8000-000000000001", name: "X" }),
    );
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `pnpm --filter @pulse/core test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/core/src/domain/project.ts`**

```ts
import { z } from "zod";
import { newId } from "./ids.js";
import { nowIso } from "./timestamps.js";

export const ProjectSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1).max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  archived: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export type Project = z.infer<typeof ProjectSchema>;

export interface MakeProjectInput {
  userId: string;
  name: string;
  color?: string;
  sortOrder?: number;
}

export function makeProject(input: MakeProjectInput): Project {
  const ts = nowIso();
  return {
    id: newId(),
    userId: input.userId,
    name: input.name,
    color: input.color ?? "#2563eb",
    archived: false,
    sortOrder: input.sortOrder ?? 0,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
}
```

- [ ] **Step 4: Create `packages/core/src/domain/index.ts`**

```ts
export * from "./ids.js";
export * from "./timestamps.js";
export * from "./project.js";
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @pulse/core test`
Expected: 11 passing.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/domain packages/core/test/unit
git commit -m "feat(core): Project domain type and Zod schema"
```

---

## Task 5: Domain Types — Task (TDD)

**Files:**
- Create: `packages/core/src/domain/task.ts`
- Modify: `packages/core/src/domain/index.ts`
- Test: extend `packages/core/test/unit/domain.test.ts`

- [ ] **Step 1: Append failing tests to `domain.test.ts`**

```ts
import {
  TaskSchema,
  makeTask,
  TaskStatus,
} from "../../src/domain/task.js";

describe("Task", () => {
  it("makeTask defaults", () => {
    const t = makeTask({
      userId: "user",
      projectId: "proj",
      title: "Do thing",
    });
    expect(t.id).toBeTypeOf("string");
    expect(t.status).toBe<TaskStatus>("todo");
    expect(t.priority).toBe(3);
    expect(t.parentTaskId).toBeNull();
    expect(t.dueDate).toBeNull();
    expect(t.completedAt).toBeNull();
    expect(t.recurrenceRule).toBeNull();
    expect(t.recurrenceParentId).toBeNull();
  });

  it("TaskSchema rejects priority out of range", () => {
    const t = makeTask({ userId: "u", projectId: "p", title: "x" });
    const r = TaskSchema.safeParse({ ...t, priority: 5 });
    expect(r.success).toBe(false);
  });

  it("TaskSchema rejects unknown status", () => {
    const t = makeTask({ userId: "u", projectId: "p", title: "x" });
    const r = TaskSchema.safeParse({ ...t, status: "blocked" });
    expect(r.success).toBe(false);
  });

  it("makeTask accepts due date and recurrence", () => {
    const t = makeTask({
      userId: "u",
      projectId: "p",
      title: "x",
      dueDate: "2026-06-01T09:00:00.000Z",
      recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
    });
    expect(t.dueDate).toBe("2026-06-01T09:00:00.000Z");
    expect(t.recurrenceRule).toBe("FREQ=WEEKLY;BYDAY=MO");
  });

  it("TaskSchema rejects invalid RRULE", () => {
    const t = makeTask({ userId: "u", projectId: "p", title: "x" });
    const r = TaskSchema.safeParse({ ...t, recurrenceRule: "garbage" });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `pnpm --filter @pulse/core test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/core/src/domain/task.ts`**

```ts
import { RRule } from "rrule";
import { z } from "zod";
import { newId } from "./ids.js";
import { nowIso } from "./timestamps.js";

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

const RRuleString = z.string().refine(
  (s) => {
    try {
      RRule.fromString(`RRULE:${s}`);
      return true;
    } catch {
      return false;
    }
  },
  { message: "invalid RRULE" },
);

export const TaskSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  projectId: z.string().min(1),
  parentTaskId: z.string().nullable(),
  title: z.string().min(1).max(500),
  description: z.string().nullable(),
  status: z.enum(TASK_STATUSES),
  priority: z.number().int().min(1).max(4),
  dueDate: z.string().nullable(),
  completedAt: z.string().nullable(),
  sortOrder: z.number().int(),
  recurrenceRule: RRuleString.nullable(),
  recurrenceParentId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export type Task = z.infer<typeof TaskSchema>;

export interface MakeTaskInput {
  userId: string;
  projectId: string;
  title: string;
  description?: string | null;
  parentTaskId?: string | null;
  status?: TaskStatus;
  priority?: 1 | 2 | 3 | 4;
  dueDate?: string | null;
  sortOrder?: number;
  recurrenceRule?: string | null;
  recurrenceParentId?: string | null;
}

export function makeTask(input: MakeTaskInput): Task {
  const ts = nowIso();
  return {
    id: newId(),
    userId: input.userId,
    projectId: input.projectId,
    parentTaskId: input.parentTaskId ?? null,
    title: input.title,
    description: input.description ?? null,
    status: input.status ?? "todo",
    priority: input.priority ?? 3,
    dueDate: input.dueDate ?? null,
    completedAt: null,
    sortOrder: input.sortOrder ?? 0,
    recurrenceRule: input.recurrenceRule ?? null,
    recurrenceParentId: input.recurrenceParentId ?? null,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
}
```

- [ ] **Step 4: Update `packages/core/src/domain/index.ts`**

```ts
export * from "./ids.js";
export * from "./timestamps.js";
export * from "./project.js";
export * from "./task.js";
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @pulse/core test`
Expected: 16 passing.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/domain packages/core/test/unit
git commit -m "feat(core): Task domain type with RRULE validation"
```

---

## Task 6: Remaining Domain Types

**Files:**
- Create: `packages/core/src/domain/{tag,task-tag,attachment,time-entry,comment,note,activity}.ts`
- Modify: `packages/core/src/domain/index.ts`
- Test: extend `packages/core/test/unit/domain.test.ts`

- [ ] **Step 1: Append failing tests for all remaining entities**

Append to `domain.test.ts`:

```ts
import { TagSchema, makeTag } from "../../src/domain/tag.js";
import { TaskTagSchema, makeTaskTag } from "../../src/domain/task-tag.js";
import { AttachmentSchema, makeAttachment } from "../../src/domain/attachment.js";
import { TimeEntrySchema, makeTimeEntry, stopTimer } from "../../src/domain/time-entry.js";
import { CommentSchema, makeComment } from "../../src/domain/comment.js";
import { NoteSchema, makeProjectNote, makeTaskNote } from "../../src/domain/note.js";
import { ActivitySchema, makeActivity } from "../../src/domain/activity.js";

describe("Tag", () => {
  it("defaults color and validates", () => {
    const t = makeTag({ userId: "u", name: "urgent" });
    expect(TagSchema.safeParse(t).success).toBe(true);
    expect(t.color).toBe("#71717a");
  });
});

describe("TaskTag", () => {
  it("makes a junction row", () => {
    const tt = makeTaskTag({ userId: "u", taskId: "t", tagId: "g" });
    expect(TaskTagSchema.safeParse(tt).success).toBe(true);
  });
});

describe("Attachment", () => {
  it("validates", () => {
    const a = makeAttachment({
      userId: "u",
      taskId: "t",
      storagePath: "attachments/u/t/file.png",
      filename: "file.png",
      mime: "image/png",
      sizeBytes: 1024,
    });
    expect(AttachmentSchema.safeParse(a).success).toBe(true);
  });

  it("rejects non-positive size", () => {
    const a = makeAttachment({
      userId: "u", taskId: "t", storagePath: "p", filename: "f", mime: "x/y", sizeBytes: 1,
    });
    expect(AttachmentSchema.safeParse({ ...a, sizeBytes: 0 }).success).toBe(false);
  });
});

describe("TimeEntry", () => {
  it("makeTimeEntry has running state", () => {
    const te = makeTimeEntry({ userId: "u", taskId: "t", startedAt: "2026-05-09T10:00:00.000Z" });
    expect(te.endedAt).toBeNull();
    expect(te.durationSeconds).toBeNull();
  });

  it("stopTimer sets endedAt and computes duration", () => {
    const te = makeTimeEntry({ userId: "u", taskId: "t", startedAt: "2026-05-09T10:00:00.000Z" });
    const stopped = stopTimer(te, "2026-05-09T10:01:30.000Z");
    expect(stopped.endedAt).toBe("2026-05-09T10:01:30.000Z");
    expect(stopped.durationSeconds).toBe(90);
  });

  it("rejects negative duration", () => {
    const te = makeTimeEntry({ userId: "u", taskId: "t", startedAt: "2026-05-09T10:00:00.000Z" });
    expect(() =>
      stopTimer(te, "2026-05-09T09:59:00.000Z"),
    ).toThrowError(/end before start/);
  });
});

describe("Comment", () => {
  it("validates", () => {
    const c = makeComment({ userId: "u", taskId: "t", bodyMd: "looks good" });
    expect(CommentSchema.safeParse(c).success).toBe(true);
  });
});

describe("Note", () => {
  it("project note has projectId only", () => {
    const n = makeProjectNote({ userId: "u", projectId: "p", bodyMd: "hi" });
    expect(n.projectId).toBe("p");
    expect(n.taskId).toBeNull();
    expect(NoteSchema.safeParse(n).success).toBe(true);
  });

  it("task note has taskId only", () => {
    const n = makeTaskNote({ userId: "u", taskId: "t", bodyMd: "hi" });
    expect(n.projectId).toBeNull();
    expect(n.taskId).toBe("t");
    expect(NoteSchema.safeParse(n).success).toBe(true);
  });

  it("rejects when both ids set or both null", () => {
    const n = makeTaskNote({ userId: "u", taskId: "t", bodyMd: "x" });
    expect(NoteSchema.safeParse({ ...n, projectId: "p" }).success).toBe(false);
    expect(NoteSchema.safeParse({ ...n, taskId: null }).success).toBe(false);
  });
});

describe("Activity", () => {
  it("validates", () => {
    const a = makeActivity({
      userId: "u",
      entityType: "task",
      entityId: "t",
      action: "status_changed",
      payload: { from: "todo", to: "done" },
    });
    expect(ActivitySchema.safeParse(a).success).toBe(true);
  });
});
```

- [ ] **Step 2: Implement `packages/core/src/domain/tag.ts`**

```ts
import { z } from "zod";
import { newId } from "./ids.js";
import { nowIso } from "./timestamps.js";

export const TagSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1).max(64),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export type Tag = z.infer<typeof TagSchema>;

export function makeTag(input: { userId: string; name: string; color?: string }): Tag {
  const ts = nowIso();
  return {
    id: newId(),
    userId: input.userId,
    name: input.name,
    color: input.color ?? "#71717a",
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
}
```

- [ ] **Step 3: Implement `packages/core/src/domain/task-tag.ts`**

```ts
import { z } from "zod";
import { nowIso } from "./timestamps.js";

export const TaskTagSchema = z.object({
  taskId: z.string().min(1),
  tagId: z.string().min(1),
  userId: z.string().min(1),
  createdAt: z.string(),
});

export type TaskTag = z.infer<typeof TaskTagSchema>;

export function makeTaskTag(input: {
  userId: string;
  taskId: string;
  tagId: string;
}): TaskTag {
  return { ...input, createdAt: nowIso() };
}
```

- [ ] **Step 4: Implement `packages/core/src/domain/attachment.ts`**

```ts
import { z } from "zod";
import { newId } from "./ids.js";
import { nowIso } from "./timestamps.js";

export const AttachmentSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  taskId: z.string().min(1),
  storagePath: z.string().min(1),
  filename: z.string().min(1),
  mime: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export type Attachment = z.infer<typeof AttachmentSchema>;

export function makeAttachment(input: {
  userId: string;
  taskId: string;
  storagePath: string;
  filename: string;
  mime: string;
  sizeBytes: number;
}): Attachment {
  const ts = nowIso();
  return {
    id: newId(),
    ...input,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
}
```

- [ ] **Step 5: Implement `packages/core/src/domain/time-entry.ts`**

```ts
import { z } from "zod";
import { newId } from "./ids.js";
import { nowIso, parseIso } from "./timestamps.js";

export const TimeEntrySchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  taskId: z.string().min(1),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export type TimeEntry = z.infer<typeof TimeEntrySchema>;

export function makeTimeEntry(input: {
  userId: string;
  taskId: string;
  startedAt: string;
}): TimeEntry {
  const ts = nowIso();
  return {
    id: newId(),
    userId: input.userId,
    taskId: input.taskId,
    startedAt: input.startedAt,
    endedAt: null,
    durationSeconds: null,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
}

export function stopTimer(entry: TimeEntry, endedAt: string): TimeEntry {
  const start = parseIso(entry.startedAt).getTime();
  const end = parseIso(endedAt).getTime();
  if (end < start) {
    throw new Error("end before start");
  }
  return {
    ...entry,
    endedAt,
    durationSeconds: Math.floor((end - start) / 1000),
    updatedAt: nowIso(),
  };
}
```

- [ ] **Step 6: Implement `packages/core/src/domain/comment.ts`**

```ts
import { z } from "zod";
import { newId } from "./ids.js";
import { nowIso } from "./timestamps.js";

export const CommentSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  taskId: z.string().min(1),
  bodyMd: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export type Comment = z.infer<typeof CommentSchema>;

export function makeComment(input: {
  userId: string;
  taskId: string;
  bodyMd: string;
}): Comment {
  const ts = nowIso();
  return {
    id: newId(),
    ...input,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
}
```

- [ ] **Step 7: Implement `packages/core/src/domain/note.ts`**

```ts
import { z } from "zod";
import { newId } from "./ids.js";
import { nowIso } from "./timestamps.js";

export const NoteSchema = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1),
    projectId: z.string().nullable(),
    taskId: z.string().nullable(),
    bodyMd: z.string().min(1),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().nullable(),
  })
  .refine((n) => (n.projectId === null) !== (n.taskId === null), {
    message: "exactly one of projectId or taskId must be set",
  });

export type Note = z.infer<typeof NoteSchema>;

export function makeProjectNote(input: {
  userId: string;
  projectId: string;
  bodyMd: string;
}): Note {
  const ts = nowIso();
  return {
    id: newId(),
    userId: input.userId,
    projectId: input.projectId,
    taskId: null,
    bodyMd: input.bodyMd,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
}

export function makeTaskNote(input: {
  userId: string;
  taskId: string;
  bodyMd: string;
}): Note {
  const ts = nowIso();
  return {
    id: newId(),
    userId: input.userId,
    projectId: null,
    taskId: input.taskId,
    bodyMd: input.bodyMd,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
}
```

- [ ] **Step 8: Implement `packages/core/src/domain/activity.ts`**

```ts
import { z } from "zod";
import { newId } from "./ids.js";
import { nowIso } from "./timestamps.js";

export const ACTIVITY_ACTIONS = [
  "created",
  "updated",
  "deleted",
  "status_changed",
] as const;

export const ActivitySchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  action: z.enum(ACTIVITY_ACTIONS),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

export type Activity = z.infer<typeof ActivitySchema>;

export function makeActivity(input: {
  userId: string;
  entityType: string;
  entityId: string;
  action: (typeof ACTIVITY_ACTIONS)[number];
  payload: Record<string, unknown>;
}): Activity {
  return { id: newId(), ...input, createdAt: nowIso() };
}
```

- [ ] **Step 9: Update `packages/core/src/domain/index.ts`**

```ts
export * from "./ids.js";
export * from "./timestamps.js";
export * from "./project.js";
export * from "./task.js";
export * from "./tag.js";
export * from "./task-tag.js";
export * from "./attachment.js";
export * from "./time-entry.js";
export * from "./comment.js";
export * from "./note.js";
export * from "./activity.js";
```

- [ ] **Step 10: Run tests**

Run: `pnpm --filter @pulse/core test`
Expected: all tests passing (~30 total).

- [ ] **Step 11: Commit**

```bash
git add packages/core/src/domain packages/core/test/unit
git commit -m "feat(core): remaining domain types and validators"
```

---

## Task 7: Supabase — Init and Schema Migration

**Files:**
- Create: `supabase/config.toml`, `supabase/migrations/20260509000001_init_schema.sql`

- [ ] **Step 1: Init Supabase config**

Run from repo root: `supabase init`
Expected: writes `supabase/config.toml` and `supabase/migrations/` directory.

- [ ] **Step 2: Edit `supabase/config.toml`** — set project ref to `pulse-local`

Find the `[api]` section and confirm `port = 54321`. Find the `[db]` section and confirm `port = 54322`. No edits required if defaults match. If `project_id` exists at top, set:

```toml
project_id = "pulse-local"
```

- [ ] **Step 3: Create `supabase/migrations/20260509000001_init_schema.sql`**

```sql
-- Pulse Project Planner — Phase 1 schema
-- All entity tables share: id (uuid), user_id (uuid), created_at,
-- updated_at, deleted_at (soft delete for sync).

create extension if not exists "uuid-ossp";

create table public.projects (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  color text not null default '#2563eb' check (color ~ '^#[0-9a-fA-F]{6}$'),
  archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.tasks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_task_id uuid references public.tasks(id) on delete cascade,
  title text not null check (length(title) between 1 and 500),
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  priority integer not null default 3 check (priority between 1 and 4),
  due_date timestamptz,
  completed_at timestamptz,
  sort_order integer not null default 0,
  recurrence_rule text,
  recurrence_parent_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.tags (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 64),
  color text not null default '#71717a' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, name)
);

create table public.task_tags (
  task_id uuid not null references public.tasks(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, tag_id)
);

create table public.attachments (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  mime text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.time_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.comments (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  body_md text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.notes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  body_md text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((project_id is null) <> (task_id is null))
);

create table public.activity_log (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('created','updated','deleted','status_changed')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Indexes (sync-critical)
create index projects_user_updated on public.projects (user_id, updated_at);
create index tasks_user_project    on public.tasks    (user_id, project_id) where deleted_at is null;
create index tasks_user_due        on public.tasks    (user_id, due_date)   where deleted_at is null;
create index tasks_user_updated    on public.tasks    (user_id, updated_at);
create index tags_user_updated     on public.tags     (user_id, updated_at);
create index task_tags_task        on public.task_tags (task_id);
create index attachments_user_updated on public.attachments (user_id, updated_at);
create index time_entries_user_updated on public.time_entries (user_id, updated_at);
create index time_entries_user_task on public.time_entries (user_id, task_id);
create index comments_user_updated on public.comments (user_id, updated_at);
create index comments_task         on public.comments (task_id);
create index notes_user_updated    on public.notes    (user_id, updated_at);
create index activity_user_created on public.activity_log (user_id, created_at desc);
```

- [ ] **Step 4: Start Supabase locally and apply**

Run: `supabase start`
Expected: prints API URL `http://127.0.0.1:54321` and an `anon key`. Copy the anon key into `.env`.

Then: `supabase db reset`
Expected: applies the migration with no errors. Final line: `Finished supabase db reset`.

- [ ] **Step 5: Verify schema**

Open Supabase Studio at `http://127.0.0.1:54323` → Table Editor → `public` schema. Expected: 9 tables visible.

Or, if `psql` is installed:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\dt public.*"
```
Expected: lists all 9 tables.

- [ ] **Step 6: Commit**

```bash
git add supabase/config.toml supabase/migrations
git commit -m "feat(db): initial schema for projects/tasks/tags/etc"
```

---

## Task 8: Supabase — RLS Policies

**Files:**
- Create: `supabase/migrations/20260509000002_rls.sql`

- [ ] **Step 1: Create the RLS migration**

```sql
-- Enable RLS on all tables. Owner-only policies.

alter table public.projects     enable row level security;
alter table public.tasks        enable row level security;
alter table public.tags         enable row level security;
alter table public.task_tags    enable row level security;
alter table public.attachments  enable row level security;
alter table public.time_entries enable row level security;
alter table public.comments     enable row level security;
alter table public.notes        enable row level security;
alter table public.activity_log enable row level security;

-- Projects
create policy "owner all" on public.projects
  for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Tasks
create policy "owner all" on public.tasks
  for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Tags
create policy "owner all" on public.tags
  for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Task-Tags
create policy "owner all" on public.task_tags
  for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Attachments
create policy "owner all" on public.attachments
  for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Time entries
create policy "owner all" on public.time_entries
  for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Comments
create policy "owner all" on public.comments
  for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Notes
create policy "owner all" on public.notes
  for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Activity (insert + read; no update/delete by client)
create policy "owner read"   on public.activity_log
  for select to authenticated using (user_id = auth.uid());
create policy "owner insert" on public.activity_log
  for insert to authenticated with check (user_id = auth.uid());
```

- [ ] **Step 2: Apply migration**

Run: `supabase db reset`
Expected: applies cleanly.

- [ ] **Step 3: Verify policies exist**

Supabase Studio → `Authentication → Policies` should list policies for every public table. Or via psql:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "select tablename, policyname from pg_policies where schemaname='public' order by tablename, policyname;"
```
Expected: 10 rows (one policy per entity table + 2 for activity_log).

- [ ] **Step 4: Provision the attachments storage bucket**

Append to `supabase/migrations/20260509000002_rls.sql`:

```sql
-- Storage bucket for task attachments (used by Phase 2/3 UIs).
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Owner-only access to objects under attachments/{user_id}/...
create policy "owner read attachments" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner insert attachments" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner delete attachments" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
```

Run: `supabase db reset`
Expected: clean apply.

Verify in Supabase Studio → Storage → `attachments` bucket exists.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260509000002_rls.sql
git commit -m "feat(db): RLS policies and attachments storage bucket"
```

---

## Task 9: Supabase — Triggers

**Files:**
- Create: `supabase/migrations/20260509000003_triggers.sql`

- [ ] **Step 1: Create the triggers migration**

```sql
-- updated_at on every entity table
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger projects_updated_at     before update on public.projects     for each row execute function public.set_updated_at();
create trigger tasks_updated_at        before update on public.tasks        for each row execute function public.set_updated_at();
create trigger tags_updated_at         before update on public.tags         for each row execute function public.set_updated_at();
create trigger attachments_updated_at  before update on public.attachments  for each row execute function public.set_updated_at();
create trigger time_entries_updated_at before update on public.time_entries for each row execute function public.set_updated_at();
create trigger comments_updated_at     before update on public.comments     for each row execute function public.set_updated_at();
create trigger notes_updated_at        before update on public.notes        for each row execute function public.set_updated_at();

-- Subtask depth: parent_task_id must reference a task with NULL parent
create or replace function public.enforce_subtask_depth()
returns trigger language plpgsql as $$
declare
  parent_parent uuid;
begin
  if new.parent_task_id is null then
    return new;
  end if;
  select parent_task_id into parent_parent
    from public.tasks where id = new.parent_task_id;
  if parent_parent is not null then
    raise exception 'subtask depth exceeded: parent task already has a parent';
  end if;
  return new;
end $$;

create trigger tasks_subtask_depth
  before insert or update of parent_task_id on public.tasks
  for each row execute function public.enforce_subtask_depth();
```

- [ ] **Step 2: Apply and verify**

Run: `supabase db reset`
Expected: applies cleanly.

If `psql` is installed:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "select tgname from pg_trigger where tgrelid::regclass::text like 'public.%' and not tgisinternal order by tgname;"
```
Expected: 8 trigger rows. (Otherwise verify via Supabase Studio → Database → Triggers.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260509000003_triggers.sql
git commit -m "feat(db): updated_at and subtask-depth triggers"
```

---

## Task 10: Supabase — `sync_upsert` RPC

**Files:**
- Create: `supabase/migrations/20260509000004_sync_upsert.sql`

This single RPC implements per-field LWW for inserts, updates, and soft-deletes. The client passes a JSON object of changed fields plus a client timestamp; the RPC applies each field only if `client_ts >= row.updated_at`.

- [ ] **Step 1: Create the RPC migration**

```sql
-- Per-field Last-Write-Wins upsert.
-- Returns the resulting row's updated_at.

create or replace function public.sync_upsert(
  p_table     text,
  p_id        uuid,
  p_op        text,         -- 'insert' | 'update' | 'delete'
  p_changes   jsonb,         -- {field: value} (snake_case columns)
  p_client_ts timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_tables constant text[] := array[
    'projects','tasks','tags','task_tags','attachments',
    'time_entries','comments','notes'
  ];
  current_uid uuid := auth.uid();
  existing_updated_at timestamptz;
  existing_user_id uuid;
  set_clauses text := '';
  k text;
  result_ts timestamptz;
begin
  if current_uid is null then
    raise exception 'not authenticated';
  end if;
  if not (p_table = any(allowed_tables)) then
    raise exception 'table not allowed: %', p_table;
  end if;
  if p_op not in ('insert','update','delete') then
    raise exception 'invalid op: %', p_op;
  end if;

  -- All allowed tables have user_id and id columns. Fetch ownership + ts.
  execute format(
    'select user_id, updated_at from public.%I where id = $1',
    p_table
  ) into existing_user_id, existing_updated_at using p_id;

  if existing_user_id is not null and existing_user_id <> current_uid then
    raise exception 'forbidden';
  end if;

  if p_op = 'delete' then
    execute format(
      'update public.%I set deleted_at = $1, updated_at = $1
         where id = $2 and user_id = $3
           and (deleted_at is null or deleted_at > $1)',
      p_table
    ) using p_client_ts, p_id, current_uid;
    return p_client_ts;
  end if;

  if existing_user_id is null then
    -- INSERT path: build full row from p_changes (caller must provide all
    -- non-null required fields). user_id forced to current_uid.
    declare
      cols text := 'id, user_id';
      vals text := format('%L, %L', p_id, current_uid);
    begin
      for k in select jsonb_object_keys(p_changes) loop
        if k in ('id', 'user_id') then continue; end if;
        cols := cols || ', ' || quote_ident(k);
        vals := vals || ', ' ||
          coalesce(quote_nullable(p_changes ->> k), 'null');
      end loop;
      execute format(
        'insert into public.%I (%s) values (%s)
         on conflict (id) do nothing',
        p_table, cols, vals
      );
    end;
    return p_client_ts;
  end if;

  -- UPDATE path: per-field LWW.
  if p_client_ts < existing_updated_at then
    -- Whole payload is older than current row: still allow per-field
    -- updates only where p_client_ts >= per-field ts. We don't track
    -- per-field timestamps, so a simpler rule: skip the update entirely.
    return existing_updated_at;
  end if;

  for k in select jsonb_object_keys(p_changes) loop
    if k in ('id','user_id','created_at','updated_at') then continue; end if;
    if set_clauses <> '' then set_clauses := set_clauses || ', '; end if;
    set_clauses := set_clauses || quote_ident(k) || ' = ' ||
      coalesce(quote_nullable(p_changes ->> k), 'null');
  end loop;

  if set_clauses = '' then
    return existing_updated_at;
  end if;

  execute format(
    'update public.%I set %s, updated_at = $1
       where id = $2 and user_id = $3',
    p_table, set_clauses
  ) using p_client_ts, p_id, current_uid;

  return p_client_ts;
end $$;

revoke all on function public.sync_upsert(text,uuid,text,jsonb,timestamptz) from public;
grant execute on function public.sync_upsert(text,uuid,text,jsonb,timestamptz) to authenticated;
```

- [ ] **Step 2: Apply and verify**

Run: `supabase db reset`
Expected: clean apply.

If `psql` is installed:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "select proname from pg_proc where proname = 'sync_upsert';"
```
Expected: 1 row. (Otherwise verify via Supabase Studio → Database → Functions.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260509000004_sync_upsert.sql
git commit -m "feat(db): sync_upsert RPC for per-field LWW"
```

---

## Task 11: LocalStore Interface and InMemoryStore (TDD)

**Files:**
- Create: `packages/core/src/store/local-store.ts`, `packages/core/src/store/in-memory-store.ts`, `packages/core/src/store/index.ts`
- Test: `packages/core/test/unit/in-memory-store.test.ts`

The LocalStore is the abstraction over SQLite. The desktop and mobile apps will provide their own SQLite-backed implementations later. For Phase 1 we ship an InMemoryStore for tests.

- [ ] **Step 1: Write failing tests**

Create `packages/core/test/unit/in-memory-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { InMemoryStore } from "../../src/store/in-memory-store.js";
import { makeProject } from "../../src/domain/project.js";
import { makeTask } from "../../src/domain/task.js";

describe("InMemoryStore", () => {
  it("upserts and reads back rows by id", async () => {
    const store = new InMemoryStore();
    const p = makeProject({ userId: "u1", name: "P1" });
    await store.upsert("projects", p);
    expect(await store.findById("projects", p.id)).toEqual(p);
  });

  it("listSince returns rows updated after the cutoff", async () => {
    const store = new InMemoryStore();
    const a = makeProject({ userId: "u1", name: "a" });
    a.updatedAt = "2026-05-01T00:00:00.000Z";
    const b = makeProject({ userId: "u1", name: "b" });
    b.updatedAt = "2026-05-09T00:00:00.000Z";
    await store.upsert("projects", a);
    await store.upsert("projects", b);
    const rows = await store.listSince("projects", "2026-05-05T00:00:00.000Z");
    expect(rows.map((r) => r.id)).toEqual([b.id]);
  });

  it("listSince filters by user_id", async () => {
    const store = new InMemoryStore();
    const a = makeProject({ userId: "u1", name: "a" });
    const b = makeProject({ userId: "u2", name: "b" });
    await store.upsert("projects", a);
    await store.upsert("projects", b);
    const rows = await store.listSince("projects", null, { userId: "u1" });
    expect(rows.map((r) => r.id)).toEqual([a.id]);
  });

  it("delete sets deleted_at without removing the row", async () => {
    const store = new InMemoryStore();
    const t = makeTask({ userId: "u1", projectId: "p", title: "x" });
    await store.upsert("tasks", t);
    await store.softDelete("tasks", t.id, "2026-05-09T12:00:00.000Z");
    const found = await store.findById("tasks", t.id);
    expect(found?.deletedAt).toBe("2026-05-09T12:00:00.000Z");
  });

  it("transaction rolls back on throw", async () => {
    const store = new InMemoryStore();
    const a = makeProject({ userId: "u1", name: "a" });
    await store.upsert("projects", a);
    await expect(
      store.transaction(async (tx) => {
        await tx.upsert("projects", { ...a, name: "changed" });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const after = await store.findById("projects", a.id);
    expect(after?.name).toBe("a");
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm --filter @pulse/core test`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `packages/core/src/store/local-store.ts`**

```ts
export type SyncTable =
  | "projects"
  | "tasks"
  | "tags"
  | "task_tags"
  | "attachments"
  | "time_entries"
  | "comments"
  | "notes";

export interface BaseRow {
  id: string;
  userId: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ListSinceOptions {
  userId?: string;
  includeDeleted?: boolean;
}

export interface LocalStore {
  upsert<T extends BaseRow>(table: SyncTable, row: T): Promise<void>;
  findById<T extends BaseRow>(table: SyncTable, id: string): Promise<T | null>;
  listSince<T extends BaseRow>(
    table: SyncTable,
    sinceIso: string | null,
    opts?: ListSinceOptions,
  ): Promise<T[]>;
  softDelete(table: SyncTable, id: string, atIso: string): Promise<void>;
  transaction<R>(fn: (tx: LocalStore) => Promise<R>): Promise<R>;
}
```

- [ ] **Step 4: Implement `packages/core/src/store/in-memory-store.ts`**

```ts
import type {
  BaseRow,
  ListSinceOptions,
  LocalStore,
  SyncTable,
} from "./local-store.js";

type TableMap = Map<string, BaseRow>;

export class InMemoryStore implements LocalStore {
  private tables = new Map<SyncTable, TableMap>();

  private getTable(name: SyncTable): TableMap {
    let t = this.tables.get(name);
    if (!t) {
      t = new Map();
      this.tables.set(name, t);
    }
    return t;
  }

  async upsert<T extends BaseRow>(table: SyncTable, row: T): Promise<void> {
    this.getTable(table).set(row.id, structuredClone(row));
  }

  async findById<T extends BaseRow>(
    table: SyncTable,
    id: string,
  ): Promise<T | null> {
    const r = this.getTable(table).get(id);
    return (r ? (structuredClone(r) as T) : null);
  }

  async listSince<T extends BaseRow>(
    table: SyncTable,
    sinceIso: string | null,
    opts: ListSinceOptions = {},
  ): Promise<T[]> {
    const out: T[] = [];
    for (const r of this.getTable(table).values()) {
      if (opts.userId && r.userId !== opts.userId) continue;
      if (!opts.includeDeleted && r.deletedAt !== null) continue;
      if (sinceIso !== null && r.updatedAt <= sinceIso) continue;
      out.push(structuredClone(r) as T);
    }
    out.sort((a, b) => (a.updatedAt < b.updatedAt ? -1 : 1));
    return out;
  }

  async softDelete(table: SyncTable, id: string, atIso: string): Promise<void> {
    const r = this.getTable(table).get(id);
    if (!r) return;
    r.deletedAt = atIso;
    r.updatedAt = atIso;
  }

  async transaction<R>(fn: (tx: LocalStore) => Promise<R>): Promise<R> {
    const snapshot = new Map<SyncTable, TableMap>();
    for (const [name, tbl] of this.tables) {
      snapshot.set(name, new Map(tbl));
    }
    try {
      return await fn(this);
    } catch (e) {
      this.tables = snapshot;
      throw e;
    }
  }
}
```

- [ ] **Step 5: Create `packages/core/src/store/index.ts`**

```ts
export * from "./local-store.js";
export * from "./in-memory-store.js";
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @pulse/core test`
Expected: 5 new + previous all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/store packages/core/test/unit
git commit -m "feat(core): LocalStore interface and InMemoryStore"
```

---

## Task 12: Outbox Queue (TDD)

**Files:**
- Create: `packages/core/src/sync/outbox.ts`, `packages/core/src/sync/index.ts`
- Test: `packages/core/test/unit/outbox.test.ts`

The outbox holds pending mutations to push to Supabase. It's an in-memory FIFO with retry tracking. Persistent storage (per-platform SQLite) wraps this in later phases.

- [ ] **Step 1: Write failing tests**

Create `packages/core/test/unit/outbox.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Outbox, type OutboxEntry } from "../../src/sync/outbox.js";

const entry = (id: string, table = "tasks"): Omit<OutboxEntry, "queuedAt" | "attempts"> => ({
  entityTable: table as OutboxEntry["entityTable"],
  entityId: id,
  op: "update",
  changedFields: { title: "x" },
  clientTs: "2026-05-09T00:00:00.000Z",
});

describe("Outbox", () => {
  it("enqueues and drains in FIFO order", async () => {
    const ob = new Outbox();
    await ob.enqueue(entry("a"));
    await ob.enqueue(entry("b"));
    expect((await ob.peekAll()).map((e) => e.entityId)).toEqual(["a", "b"]);
  });

  it("ack removes the entry", async () => {
    const ob = new Outbox();
    await ob.enqueue(entry("a"));
    const all = await ob.peekAll();
    await ob.ack(all[0]!.queuedAt);
    expect(await ob.peekAll()).toEqual([]);
  });

  it("nack increments attempts and stores last error", async () => {
    const ob = new Outbox();
    await ob.enqueue(entry("a"));
    const [first] = await ob.peekAll();
    await ob.nack(first!.queuedAt, "network error");
    const [retry] = await ob.peekAll();
    expect(retry!.attempts).toBe(1);
    expect(retry!.lastError).toBe("network error");
  });

  it("backoffMs grows exponentially capped at 5 minutes", () => {
    expect(Outbox.backoffMs(0)).toBe(0);
    expect(Outbox.backoffMs(1)).toBe(1_000);
    expect(Outbox.backoffMs(2)).toBe(2_000);
    expect(Outbox.backoffMs(8)).toBe(256_000);
    expect(Outbox.backoffMs(20)).toBe(300_000);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm --filter @pulse/core test`
Expected: FAIL.

- [ ] **Step 3: Implement `packages/core/src/sync/outbox.ts`**

```ts
import type { SyncTable } from "../store/local-store.js";
import { nowIso } from "../domain/timestamps.js";

export interface OutboxEntry {
  queuedAt: string;
  entityTable: SyncTable;
  entityId: string;
  op: "insert" | "update" | "delete";
  changedFields: Record<string, unknown>;
  clientTs: string;
  attempts: number;
  lastError?: string;
}

export class Outbox {
  private q: OutboxEntry[] = [];

  async enqueue(
    e: Omit<OutboxEntry, "queuedAt" | "attempts">,
  ): Promise<void> {
    this.q.push({ ...e, queuedAt: nowIso(), attempts: 0 });
  }

  async peekAll(): Promise<OutboxEntry[]> {
    return [...this.q];
  }

  async ack(queuedAt: string): Promise<void> {
    this.q = this.q.filter((e) => e.queuedAt !== queuedAt);
  }

  async nack(queuedAt: string, error: string): Promise<void> {
    const e = this.q.find((x) => x.queuedAt === queuedAt);
    if (!e) return;
    e.attempts += 1;
    e.lastError = error;
  }

  static backoffMs(attempts: number): number {
    if (attempts <= 0) return 0;
    return Math.min(2 ** (attempts - 1) * 1_000, 300_000);
  }
}
```

- [ ] **Step 4: Create `packages/core/src/sync/index.ts`**

```ts
export * from "./outbox.js";
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @pulse/core test`
Expected: 4 new pass, previous all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/sync packages/core/test/unit
git commit -m "feat(core): Outbox queue with exponential backoff"
```

---

## Task 13: Conflict Resolution — Per-Field LWW (TDD)

**Files:**
- Create: `packages/core/src/sync/conflict.ts`
- Modify: `packages/core/src/sync/index.ts`
- Test: `packages/core/test/unit/conflict.test.ts`

Pure logic for the case where a remote pull arrives but the local row has outstanding outbox entries. The outbox-changed fields must win locally (they will be re-pushed); other fields take the remote value.

- [ ] **Step 1: Write failing tests**

Create `packages/core/test/unit/conflict.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { collectOutstandingFields, mergeRemoteWithOutbox } from "../../src/sync/conflict.js";

describe("mergeRemoteWithOutbox", () => {
  it("returns remote unchanged when no outstanding outbox fields", () => {
    const local = { id: "1", title: "old", status: "todo" };
    const remote = { id: "1", title: "new", status: "in_progress" };
    const merged = mergeRemoteWithOutbox(local, remote, []);
    expect(merged).toEqual(remote);
  });

  it("preserves locally-changed field over remote value", () => {
    const local = { id: "1", title: "local edit", status: "todo" };
    const remote = { id: "1", title: "remote edit", status: "done" };
    const merged = mergeRemoteWithOutbox(local, remote, ["title"]);
    expect(merged.title).toBe("local edit");
    expect(merged.status).toBe("done");
  });

  it("multiple outstanding fields all preserved", () => {
    const local = { a: 1, b: 2, c: 3 };
    const remote = { a: 10, b: 20, c: 30 };
    const merged = mergeRemoteWithOutbox(local, remote, ["a", "c"]);
    expect(merged).toEqual({ a: 1, b: 20, c: 3 });
  });

  it("outstandingFields collects field names across multiple outbox entries for the same row", () => {
    const fields = collectOutstandingFields([
      { entityTable: "tasks", entityId: "1", changedFields: { title: "x" } },
      { entityTable: "tasks", entityId: "1", changedFields: { status: "done" } },
      { entityTable: "tasks", entityId: "2", changedFields: { title: "y" } },
    ], "tasks", "1");
    expect(fields.sort()).toEqual(["status", "title"]);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm --filter @pulse/core test`
Expected: FAIL.

- [ ] **Step 3: Implement `packages/core/src/sync/conflict.ts`**

```ts
import type { OutboxEntry } from "./outbox.js";

export function mergeRemoteWithOutbox<T extends Record<string, unknown>>(
  local: T,
  remote: T,
  outstandingFields: readonly string[],
): T {
  if (outstandingFields.length === 0) {
    return { ...remote };
  }
  const out = { ...remote };
  for (const k of outstandingFields) {
    if (k in local) {
      (out as Record<string, unknown>)[k] = local[k];
    }
  }
  return out;
}

export function collectOutstandingFields(
  outbox: readonly { entityTable: string; entityId: string; changedFields: Record<string, unknown> }[],
  table: string,
  id: string,
): string[] {
  const fields = new Set<string>();
  for (const e of outbox) {
    if (e.entityTable !== table || e.entityId !== id) continue;
    for (const k of Object.keys(e.changedFields)) {
      fields.add(k);
    }
  }
  return [...fields];
}
```

- [ ] **Step 4: Update `packages/core/src/sync/index.ts`**

```ts
export * from "./outbox.js";
export * from "./conflict.js";
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @pulse/core test`
Expected: 4 new pass, all previous pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/sync packages/core/test/unit
git commit -m "feat(core): per-field LWW conflict merge"
```

---

## Task 14: Supabase Client Factory and DB Types

**Files:**
- Create: `packages/core/src/supabase/client.ts`, `packages/core/src/supabase/types.ts`, `packages/core/src/supabase/index.ts`

- [ ] **Step 1: Create `packages/core/src/supabase/types.ts`** (manual stub; can be regenerated via `supabase gen types typescript` later)

```ts
// Minimal hand-written type for sync_upsert RPC. Full Database type
// is generated later via `supabase gen types typescript`.

export type SyncOp = "insert" | "update" | "delete";

export interface SyncUpsertArgs {
  p_table: string;
  p_id: string;
  p_op: SyncOp;
  p_changes: Record<string, unknown>;
  p_client_ts: string;
}
```

- [ ] **Step 2: Create `packages/core/src/supabase/client.ts`**

```ts
import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from "@supabase/supabase-js";

export interface CreateSupabaseInput {
  url: string;
  anonKey: string;
  options?: SupabaseClientOptions<"public">;
}

export function createPulseSupabaseClient(
  input: CreateSupabaseInput,
): SupabaseClient {
  return createClient(input.url, input.anonKey, {
    auth: {
      persistSession: false,           // host injects token storage
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: { params: { eventsPerSecond: 5 } },
    ...input.options,
  });
}

export type { SupabaseClient };
```

- [ ] **Step 3: Create `packages/core/src/supabase/index.ts`**

```ts
export * from "./client.js";
export * from "./types.js";
```

- [ ] **Step 4: Build to verify**

Run: `pnpm --filter @pulse/core build`
Expected: emits `dist/` with no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/supabase
git commit -m "feat(core): Supabase client factory"
```

---

## Task 15: AuthService and TokenStorage Interface

**Files:**
- Create: `packages/core/src/auth/token-storage.ts`, `packages/core/src/auth/auth-service.ts`, `packages/core/src/auth/index.ts`
- Test: `packages/core/test/unit/auth.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/core/test/unit/auth.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { AuthService } from "../../src/auth/auth-service.js";
import type { TokenStorage } from "../../src/auth/token-storage.js";

class InMemoryTokenStorage implements TokenStorage {
  store = new Map<string, string>();
  async get(k: string) { return this.store.get(k) ?? null; }
  async set(k: string, v: string) { this.store.set(k, v); }
  async clear() { this.store.clear(); }
}

const FAKE_SESSION = {
  access_token: "at",
  refresh_token: "rt",
  user: { id: "u1", email: "x@y" },
  expires_at: Math.floor(Date.now() / 1000) + 3600,
};

function makeFakeSupabase(behavior: {
  signIn?: any;
  signUp?: any;
  signOut?: any;
  getSession?: any;
  setSession?: any;
}) {
  const cbs: any[] = [];
  return {
    auth: {
      signInWithPassword: async () => behavior.signIn ?? { data: { session: FAKE_SESSION }, error: null },
      signUp: async () => behavior.signUp ?? { data: { session: FAKE_SESSION }, error: null },
      signOut: async () => behavior.signOut ?? { error: null },
      getSession: async () => behavior.getSession ?? { data: { session: FAKE_SESSION }, error: null },
      setSession: async () => behavior.setSession ?? { data: { session: FAKE_SESSION }, error: null },
      onAuthStateChange: (cb: any) => {
        cbs.push(cb);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
    _cbs: cbs,
  } as any;
}

describe("AuthService", () => {
  let storage: InMemoryTokenStorage;
  beforeEach(() => { storage = new InMemoryTokenStorage(); });

  it("signIn persists refresh token", async () => {
    const supa = makeFakeSupabase({});
    const auth = new AuthService(supa, storage);
    const session = await auth.signIn("x@y", "pw");
    expect(session.user.id).toBe("u1");
    expect(await storage.get("pulse.refresh_token")).toBe("rt");
  });

  it("signOut clears storage", async () => {
    const supa = makeFakeSupabase({});
    const auth = new AuthService(supa, storage);
    await auth.signIn("x@y", "pw");
    await auth.signOut();
    expect(await storage.get("pulse.refresh_token")).toBeNull();
  });

  it("restoreSession uses stored refresh token", async () => {
    await storage.set("pulse.refresh_token", "rt-stored");
    const supa = makeFakeSupabase({});
    const auth = new AuthService(supa, storage);
    const restored = await auth.restoreSession();
    expect(restored?.user.id).toBe("u1");
  });

  it("restoreSession returns null when no token stored", async () => {
    const supa = makeFakeSupabase({});
    const auth = new AuthService(supa, storage);
    expect(await auth.restoreSession()).toBeNull();
  });

  it("signIn surfaces error", async () => {
    const supa = makeFakeSupabase({ signIn: { data: { session: null }, error: { message: "bad creds" } } });
    const auth = new AuthService(supa, storage);
    await expect(auth.signIn("x@y", "wrong")).rejects.toThrow(/bad creds/);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm --filter @pulse/core test`
Expected: FAIL.

- [ ] **Step 3: Implement `packages/core/src/auth/token-storage.ts`**

```ts
export interface TokenStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  clear(): Promise<void>;
}

export const REFRESH_TOKEN_KEY = "pulse.refresh_token";
```

- [ ] **Step 4: Implement `packages/core/src/auth/auth-service.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { REFRESH_TOKEN_KEY, type TokenStorage } from "./token-storage.js";

export interface PulseSession {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string | null };
  expiresAt: number;
}

function adapt(raw: any): PulseSession {
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    user: { id: raw.user.id, email: raw.user.email ?? null },
    expiresAt: raw.expires_at,
  };
}

export class AuthService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly storage: TokenStorage,
  ) {}

  async signUp(email: string, password: string): Promise<PulseSession> {
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error("sign-up succeeded but no session returned (email confirmation may be required)");
    await this.storage.set(REFRESH_TOKEN_KEY, data.session.refresh_token);
    return adapt(data.session);
  }

  async signIn(email: string, password: string): Promise<PulseSession> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error("no session returned");
    await this.storage.set(REFRESH_TOKEN_KEY, data.session.refresh_token);
    return adapt(data.session);
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    await this.storage.clear();
  }

  async restoreSession(): Promise<PulseSession | null> {
    const refresh = await this.storage.get(REFRESH_TOKEN_KEY);
    if (!refresh) return null;
    const { data, error } = await this.supabase.auth.setSession({
      access_token: "",
      refresh_token: refresh,
    });
    if (error || !data.session) {
      await this.storage.clear();
      return null;
    }
    await this.storage.set(REFRESH_TOKEN_KEY, data.session.refresh_token);
    return adapt(data.session);
  }

  onAuthStateChange(cb: (session: PulseSession | null) => void): () => void {
    const { data } = this.supabase.auth.onAuthStateChange((_event, session) => {
      cb(session ? adapt(session) : null);
    });
    return () => data.subscription.unsubscribe();
  }
}
```

- [ ] **Step 5: Create `packages/core/src/auth/index.ts`**

```ts
export * from "./token-storage.js";
export * from "./auth-service.js";
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @pulse/core test`
Expected: 5 new pass.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/auth packages/core/test/unit
git commit -m "feat(core): AuthService with injectable TokenStorage"
```

---

## Task 16: SyncEngine — Push Path (TDD)

**Files:**
- Create: `packages/core/src/sync/sync-engine.ts`
- Modify: `packages/core/src/sync/index.ts`
- Test: extend `packages/core/test/unit/sync-engine.test.ts`

- [ ] **Step 1: Write failing tests for push**

Create `packages/core/test/unit/sync-engine.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { SyncEngine } from "../../src/sync/sync-engine.js";
import { Outbox } from "../../src/sync/outbox.js";
import { InMemoryStore } from "../../src/store/in-memory-store.js";

function makeFakeSupabase(rpcImpl: (args: any) => Promise<{ data: any; error: any }>) {
  return {
    rpc: vi.fn(async (_name: string, args: any) => rpcImpl(args)),
    from: () => ({
      select: () => ({
        gt: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), unsubscribe: () => {} }),
  } as any;
}

describe("SyncEngine.push", () => {
  it("drains outbox in FIFO and acks each entry on success", async () => {
    const calls: any[] = [];
    const supa = makeFakeSupabase(async (args) => {
      calls.push(args);
      return { data: "2026-05-09T00:00:00.000Z", error: null };
    });
    const ob = new Outbox();
    const store = new InMemoryStore();
    const engine = new SyncEngine({ supabase: supa, outbox: ob, store, userId: "u" });

    await ob.enqueue({
      entityTable: "tasks", entityId: "id1", op: "update",
      changedFields: { status: "done" }, clientTs: "2026-05-09T00:00:00.000Z",
    });
    await ob.enqueue({
      entityTable: "tasks", entityId: "id2", op: "insert",
      changedFields: { id: "id2", project_id: "p", title: "x" }, clientTs: "2026-05-09T00:00:01.000Z",
    });

    await engine.push();

    expect(calls.map((c) => c.p_id)).toEqual(["id1", "id2"]);
    expect(await ob.peekAll()).toEqual([]);
  });

  it("nacks entry on RPC error and stops draining further entries", async () => {
    const supa = makeFakeSupabase(async () => ({ data: null, error: { message: "boom" } }));
    const ob = new Outbox();
    const store = new InMemoryStore();
    const engine = new SyncEngine({ supabase: supa, outbox: ob, store, userId: "u" });

    await ob.enqueue({ entityTable: "tasks", entityId: "id1", op: "update", changedFields: {}, clientTs: "2026-05-09T00:00:00.000Z" });
    await ob.enqueue({ entityTable: "tasks", entityId: "id2", op: "update", changedFields: {}, clientTs: "2026-05-09T00:00:01.000Z" });

    await engine.push();
    const remaining = await ob.peekAll();
    expect(remaining).toHaveLength(2);
    expect(remaining[0]!.attempts).toBe(1);
    expect(remaining[0]!.lastError).toBe("boom");
  });

  it("sends camelCase fields as snake_case to RPC", async () => {
    const calls: any[] = [];
    const supa = makeFakeSupabase(async (args) => {
      calls.push(args);
      return { data: "2026-05-09T00:00:00.000Z", error: null };
    });
    const ob = new Outbox();
    const engine = new SyncEngine({ supabase: supa, outbox: ob, store: new InMemoryStore(), userId: "u" });

    await ob.enqueue({
      entityTable: "tasks", entityId: "id1", op: "update",
      changedFields: { dueDate: "2026-05-15", parentTaskId: null, sortOrder: 1 },
      clientTs: "2026-05-09T00:00:00.000Z",
    });

    await engine.push();
    expect(calls[0]!.p_changes).toEqual({
      due_date: "2026-05-15",
      parent_task_id: null,
      sort_order: 1,
    });
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm --filter @pulse/core test`
Expected: FAIL.

- [ ] **Step 3: Implement `packages/core/src/sync/sync-engine.ts`** (push only for now; pull/realtime added in next task)

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { Outbox, type OutboxEntry } from "./outbox.js";
import type { LocalStore, SyncTable } from "../store/local-store.js";

export interface SyncEngineDeps {
  supabase: SupabaseClient;
  outbox: Outbox;
  store: LocalStore;
  userId: string;
}

const TABLES: readonly SyncTable[] = [
  "projects", "tasks", "tags", "task_tags",
  "attachments", "time_entries", "comments", "notes",
];

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
}

function snakifyKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[camelToSnake(k)] = v;
  }
  return out;
}

export class SyncEngine {
  constructor(private readonly deps: SyncEngineDeps) {}

  async push(): Promise<void> {
    const entries = await this.deps.outbox.peekAll();
    for (const e of entries) {
      const ok = await this.pushOne(e);
      if (!ok) break;            // stop on first failure; retry later
    }
  }

  private async pushOne(e: OutboxEntry): Promise<boolean> {
    const { data, error } = await this.deps.supabase.rpc("sync_upsert", {
      p_table:     e.entityTable,
      p_id:        e.entityId,
      p_op:        e.op,
      p_changes:   snakifyKeys(e.changedFields),
      p_client_ts: e.clientTs,
    });
    if (error) {
      await this.deps.outbox.nack(e.queuedAt, error.message);
      return false;
    }
    void data;
    await this.deps.outbox.ack(e.queuedAt);
    return true;
  }
}

export const SYNCED_TABLES = TABLES;
```

- [ ] **Step 4: Update `packages/core/src/sync/index.ts`**

```ts
export * from "./outbox.js";
export * from "./conflict.js";
export * from "./sync-engine.js";
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @pulse/core test`
Expected: 3 new pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/sync packages/core/test/unit
git commit -m "feat(core): SyncEngine push path with snake_case mapping"
```

---

## Task 17: SyncEngine — Pull Path (TDD)

**Files:**
- Modify: `packages/core/src/sync/sync-engine.ts`
- Test: extend `packages/core/test/unit/sync-engine.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
describe("SyncEngine.pull", () => {
  it("queries each table for rows updated after the cursor and upserts them", async () => {
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
    const engine = new SyncEngine({ supabase: supa, outbox: new Outbox(), store, userId: "u" });

    const newCursor = await engine.pull(null);
    expect(newCursor).toBe("2026-05-09T00:00:01.000Z");
    const got = await store.findById("projects", "p1");
    expect(got?.id).toBe("p1");
    expect((got as any).name).toBe("Hello");
  });

  it("returns the previous cursor when nothing new arrives", async () => {
    const supa = {
      rpc: vi.fn(),
      from: () => ({
        select: () => ({
          gt: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      }),
    } as any;
    const engine = new SyncEngine({ supabase: supa, outbox: new Outbox(), store: new InMemoryStore(), userId: "u" });
    expect(await engine.pull("2026-05-09T00:00:00.000Z")).toBe("2026-05-09T00:00:00.000Z");
  });

  it("preserves outbox-changed fields when applying remote update", async () => {
    const remote = [{
      id: "p1", user_id: "u", name: "REMOTE", color: "#2563eb",
      archived: false, sort_order: 0,
      created_at: "2026-05-09T00:00:00.000Z",
      updated_at: "2026-05-09T00:00:02.000Z",
      deleted_at: null,
    }];
    const supa = {
      rpc: vi.fn(),
      from: (t: string) => ({
        select: () => ({
          gt: () => ({
            eq: () => ({
              order: () => Promise.resolve({
                data: t === "projects" ? remote : [],
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as any;
    const store = new InMemoryStore();
    await store.upsert("projects", {
      id: "p1", userId: "u", name: "LOCAL", color: "#2563eb",
      archived: false, sortOrder: 0,
      createdAt: "2026-05-09T00:00:00.000Z",
      updatedAt: "2026-05-09T00:00:01.000Z",
      deletedAt: null,
    } as any);

    const ob = new Outbox();
    await ob.enqueue({
      entityTable: "projects", entityId: "p1", op: "update",
      changedFields: { name: "LOCAL" },
      clientTs: "2026-05-09T00:00:01.000Z",
    });

    const engine = new SyncEngine({ supabase: supa, outbox: ob, store, userId: "u" });
    await engine.pull(null);
    const got = await store.findById<any>("projects", "p1");
    expect(got!.name).toBe("LOCAL");          // outbox wins
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm --filter @pulse/core test`
Expected: FAIL — `pull` not defined.

- [ ] **Step 3: Extend `sync-engine.ts` with the pull method**

Add inside the `SyncEngine` class (after `pushOne`):

```ts
  async pull(sinceIso: string | null): Promise<string> {
    let maxSeen = sinceIso;
    const cursor = sinceIso ?? "1970-01-01T00:00:00.000Z";
    const outboxEntries = await this.deps.outbox.peekAll();

    for (const t of TABLES) {
      const { data, error } = await this.deps.supabase
        .from(t)
        .select("*")
        .gt("updated_at", cursor)
        .eq("user_id", this.deps.userId)
        .order("updated_at", { ascending: true });
      if (error) throw new Error(`pull ${t}: ${error.message}`);
      const rows = (data ?? []) as Record<string, unknown>[];
      for (const row of rows) {
        const camel = snakeToCamelRow(row);
        const local = await this.deps.store.findById<any>(t, camel.id);
        const outstanding = collectOutstandingFields(outboxEntries, t, camel.id);
        const merged = local && outstanding.length
          ? mergeRemoteWithOutbox(local, camel, outstanding)
          : camel;
        await this.deps.store.upsert(t, merged);
        if (!maxSeen || (camel.updatedAt as string) > maxSeen) {
          maxSeen = camel.updatedAt as string;
        }
      }
    }
    return maxSeen ?? (sinceIso ?? "1970-01-01T00:00:00.000Z");
  }
```

Add helper at the bottom of the file:

```ts
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function snakeToCamelRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[snakeToCamel(k)] = v;
  }
  return out;
}
```

And add to imports at the top:

```ts
import { collectOutstandingFields, mergeRemoteWithOutbox } from "./conflict.js";
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @pulse/core test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/sync packages/core/test/unit
git commit -m "feat(core): SyncEngine pull with outbox-aware merge"
```

---

## Task 18: SyncEngine — Realtime Subscription

**Files:**
- Modify: `packages/core/src/sync/sync-engine.ts`
- Test: extend `packages/core/test/unit/sync-engine.test.ts`

- [ ] **Step 1: Append failing test**

```ts
describe("SyncEngine.subscribeRealtime", () => {
  it("calls back when realtime payload arrives", async () => {
    let registered: ((payload: any) => void) | null = null;
    const channel = {
      on: vi.fn((_e: string, _f: any, cb: any) => { registered = cb; return channel; }),
      subscribe: vi.fn(),
    };
    const supa = {
      rpc: vi.fn(),
      from: () => ({}),
      channel: vi.fn(() => channel),
    } as any;
    const engine = new SyncEngine({ supabase: supa, outbox: new Outbox(), store: new InMemoryStore(), userId: "u" });

    let hits = 0;
    const unsub = engine.subscribeRealtime(() => { hits++; });
    registered?.({ new: { id: "x" } });
    expect(hits).toBe(1);
    expect(typeof unsub).toBe("function");
  });
});
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Add `subscribeRealtime` to `SyncEngine`**

```ts
  subscribeRealtime(onChange: () => void): () => void {
    const channels = TABLES.map((t) => {
      const ch = this.deps.supabase
        .channel(`pulse:${t}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: t, filter: `user_id=eq.${this.deps.userId}` },
          () => onChange(),
        );
      ch.subscribe();
      return ch;
    });
    return () => {
      for (const ch of channels) {
        try { (ch as any).unsubscribe?.(); } catch { /* ignore */ }
      }
    };
  }
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @pulse/core test`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/sync packages/core/test/unit
git commit -m "feat(core): SyncEngine realtime subscription"
```

---

## Task 19: Public API and Build Sanity

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Replace `packages/core/src/index.ts`**

```ts
export * from "./domain/index.js";
export * from "./store/index.js";
export * from "./sync/index.js";
export * from "./auth/index.js";
export * from "./supabase/index.js";

export const PULSE_CORE_VERSION = "0.1.0";
```

- [ ] **Step 2: Build**

Run: `pnpm --filter @pulse/core build`
Expected: clean build, type definitions emitted.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "chore(core): re-export public API"
```

---

## Task 20: CLI Tool — Skeleton and Signin/Signup

**Files:**
- Create: `tools/cli/package.json`, `tools/cli/tsconfig.json`, `tools/cli/src/index.ts`, `tools/cli/src/context.ts`, `tools/cli/src/commands/signup.ts`, `tools/cli/src/commands/signin.ts`

- [ ] **Step 1: Create `tools/cli/package.json`**

```json
{
  "name": "@pulse/cli",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "bin": { "pulse-cli": "dist/index.js" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx src/index.ts",
    "test": "echo \"no tests in cli; covered by integration\" && exit 0"
  },
  "dependencies": {
    "@pulse/core": "workspace:*",
    "@supabase/supabase-js": "^2.45.0",
    "commander": "^12.1.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "@types/node": "^20.12.0"
  }
}
```

- [ ] **Step 2: Create `tools/cli/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `tools/cli/src/context.ts`**

```ts
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  AuthService,
  createPulseSupabaseClient,
  InMemoryStore,
  Outbox,
  REFRESH_TOKEN_KEY,
  SyncEngine,
  type TokenStorage,
} from "@pulse/core";

const cliDir = join(homedir(), ".pulse-cli");
mkdirSync(cliDir, { recursive: true });
const tokenPath = join(cliDir, "token.json");

class FileTokenStorage implements TokenStorage {
  async get(key: string): Promise<string | null> {
    if (!existsSync(tokenPath)) return null;
    const data = JSON.parse(readFileSync(tokenPath, "utf8"));
    return data[key] ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    const data = existsSync(tokenPath) ? JSON.parse(readFileSync(tokenPath, "utf8")) : {};
    data[key] = value;
    writeFileSync(tokenPath, JSON.stringify(data), { mode: 0o600 });
  }
  async clear(): Promise<void> {
    if (existsSync(tokenPath)) writeFileSync(tokenPath, "{}", { mode: 0o600 });
  }
}

export interface CliContext {
  supabase: ReturnType<typeof createPulseSupabaseClient>;
  auth: AuthService;
  store: InMemoryStore;
  outbox: Outbox;
  engine: SyncEngine;
  refreshTokenKey: string;
}

export function buildContext(userId = "anon"): CliContext {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY in .env");

  const supabase = createPulseSupabaseClient({ url, anonKey });
  const auth = new AuthService(supabase, new FileTokenStorage());
  const store = new InMemoryStore();
  const outbox = new Outbox();
  const engine = new SyncEngine({ supabase, outbox, store, userId });
  return { supabase, auth, store, outbox, engine, refreshTokenKey: REFRESH_TOKEN_KEY };
}
```

- [ ] **Step 4: Create `tools/cli/src/commands/signup.ts`**

```ts
import type { Command } from "commander";
import { buildContext } from "../context.js";

export function registerSignup(program: Command): void {
  program
    .command("signup <email> <password>")
    .description("Create a new Pulse account")
    .action(async (email: string, password: string) => {
      const { auth } = buildContext();
      const session = await auth.signUp(email, password);
      console.log("Signed up as", session.user.email, session.user.id);
    });
}
```

- [ ] **Step 5: Create `tools/cli/src/commands/signin.ts`**

```ts
import type { Command } from "commander";
import { buildContext } from "../context.js";

export function registerSignin(program: Command): void {
  program
    .command("signin <email> <password>")
    .description("Sign in to Pulse")
    .action(async (email: string, password: string) => {
      const { auth } = buildContext();
      const session = await auth.signIn(email, password);
      console.log("Signed in as", session.user.email, session.user.id);
    });
}
```

- [ ] **Step 6: Create `tools/cli/src/index.ts`**

```ts
#!/usr/bin/env node
import { Command } from "commander";
import { registerSignup } from "./commands/signup.js";
import { registerSignin } from "./commands/signin.js";

const program = new Command();
program.name("pulse-cli").description("Pulse Project Planner test harness").version("0.1.0");

registerSignup(program);
registerSignin(program);

program.parseAsync(process.argv).catch((e) => {
  console.error("error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
```

- [ ] **Step 7: Build and smoke**

Run: `pnpm install && pnpm --filter @pulse/cli build`
Expected: clean build.

- [ ] **Step 8: Commit**

```bash
git add tools/cli pnpm-lock.yaml
git commit -m "feat(cli): skeleton with signup/signin"
```

---

## Task 21: CLI — Project and Task Commands

**Files:**
- Create: `tools/cli/src/commands/project.ts`, `tools/cli/src/commands/task.ts`
- Modify: `tools/cli/src/index.ts`, `tools/cli/src/context.ts`

The CLI does NOT persist data between invocations (it uses InMemoryStore). To make it useful for two-machine integration tests, each command does: restore session → pull all → mutate locally → push → exit. Two clients share state via Supabase.

- [ ] **Step 1: Add `restoreOrFail` helper to `context.ts`** — append at bottom:

```ts
export async function restoreOrFail(ctx: CliContext): Promise<{ userId: string }> {
  const session = await ctx.auth.restoreSession();
  if (!session) throw new Error("not signed in; run `pulse-cli signin <email> <password>`");
  // rebuild engine with the right userId
  (ctx.engine as any).deps.userId = session.user.id;
  return { userId: session.user.id };
}
```

- [ ] **Step 2: Create `tools/cli/src/commands/project.ts`**

```ts
import type { Command } from "commander";
import { makeProject } from "@pulse/core";
import { buildContext, restoreOrFail } from "../context.js";

export function registerProject(program: Command): void {
  const proj = program.command("project").description("Project commands");

  proj
    .command("create <name>")
    .option("--color <hex>", "color hex", "#2563eb")
    .action(async (name: string, opts: { color: string }) => {
      const ctx = buildContext();
      const { userId } = await restoreOrFail(ctx);
      const p = makeProject({ userId, name, color: opts.color });
      await ctx.store.upsert("projects", p);
      await ctx.outbox.enqueue({
        entityTable: "projects",
        entityId: p.id,
        op: "insert",
        changedFields: {
          id: p.id, name: p.name, color: p.color,
          archived: p.archived, sortOrder: p.sortOrder,
          createdAt: p.createdAt, updatedAt: p.updatedAt,
          deletedAt: p.deletedAt,
        },
        clientTs: p.updatedAt,
      });
      await ctx.engine.push();
      console.log("created project", p.id, p.name);
    });

  proj
    .command("list")
    .action(async () => {
      const ctx = buildContext();
      const { userId } = await restoreOrFail(ctx);
      await ctx.engine.pull(null);
      const rows = await ctx.store.listSince("projects", null, { userId });
      for (const r of rows) {
        console.log(`${r.id}  ${(r as any).name}`);
      }
    });
}
```

- [ ] **Step 3: Create `tools/cli/src/commands/task.ts`**

```ts
import type { Command } from "commander";
import { makeTask, nowIso, type Task } from "@pulse/core";
import { buildContext, restoreOrFail } from "../context.js";

export function registerTask(program: Command): void {
  const t = program.command("task").description("Task commands");

  t.command("add")
    .requiredOption("--project <id>")
    .requiredOption("--title <title>")
    .option("--due <iso>", "ISO due date", "")
    .option("--priority <n>", "1-4", "3")
    .action(async (opts: { project: string; title: string; due: string; priority: string }) => {
      const ctx = buildContext();
      const { userId } = await restoreOrFail(ctx);
      const task = makeTask({
        userId,
        projectId: opts.project,
        title: opts.title,
        dueDate: opts.due ? opts.due : null,
        priority: Math.min(4, Math.max(1, parseInt(opts.priority, 10))) as 1 | 2 | 3 | 4,
      });
      await ctx.store.upsert("tasks", task);
      await ctx.outbox.enqueue({
        entityTable: "tasks",
        entityId: task.id,
        op: "insert",
        changedFields: serializeTask(task),
        clientTs: task.updatedAt,
      });
      await ctx.engine.push();
      console.log("created task", task.id, task.title);
    });

  t.command("list")
    .option("--project <id>")
    .action(async (opts: { project?: string }) => {
      const ctx = buildContext();
      const { userId } = await restoreOrFail(ctx);
      await ctx.engine.pull(null);
      const rows = await ctx.store.listSince<any>("tasks", null, { userId });
      const filtered = opts.project ? rows.filter((r) => r.projectId === opts.project) : rows;
      for (const r of filtered) {
        console.log(`${r.id}  [${r.status}] ${r.title}`);
      }
    });

  t.command("done <taskId>")
    .action(async (taskId: string) => {
      const ctx = buildContext();
      await restoreOrFail(ctx);
      await ctx.engine.pull(null);
      const local = await ctx.store.findById<any>("tasks", taskId);
      if (!local) throw new Error("task not found locally; pull may have missed it");
      const ts = nowIso();
      const updated = { ...local, status: "done", completedAt: ts, updatedAt: ts };
      await ctx.store.upsert("tasks", updated);
      await ctx.outbox.enqueue({
        entityTable: "tasks", entityId: taskId, op: "update",
        changedFields: { status: "done", completedAt: ts },
        clientTs: ts,
      });
      await ctx.engine.push();
      console.log("done", taskId);
    });
}

function serializeTask(t: Task): Record<string, unknown> {
  return {
    id: t.id,
    projectId: t.projectId,
    parentTaskId: t.parentTaskId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    completedAt: t.completedAt,
    sortOrder: t.sortOrder,
    recurrenceRule: t.recurrenceRule,
    recurrenceParentId: t.recurrenceParentId,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    deletedAt: t.deletedAt,
  };
}
```

- [ ] **Step 4: Wire commands in `tools/cli/src/index.ts`**

Replace the body with:

```ts
#!/usr/bin/env node
import { Command } from "commander";
import { registerSignup } from "./commands/signup.js";
import { registerSignin } from "./commands/signin.js";
import { registerProject } from "./commands/project.js";
import { registerTask } from "./commands/task.js";

const program = new Command();
program.name("pulse-cli").description("Pulse Project Planner test harness").version("0.1.0");

registerSignup(program);
registerSignin(program);
registerProject(program);
registerTask(program);

program.parseAsync(process.argv).catch((e) => {
  console.error("error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
```

- [ ] **Step 5: Build**

Run: `pnpm --filter @pulse/cli build`
Expected: clean.

- [ ] **Step 6: Smoke (requires running Supabase)**

Run:
```bash
pnpm --filter @pulse/cli dev signup test@pulse.local changeme-please
pnpm --filter @pulse/cli dev project create "First Project"
pnpm --filter @pulse/cli dev project list
```
Expected: ID printed, then list shows the project.

- [ ] **Step 7: Commit**

```bash
git add tools/cli
git commit -m "feat(cli): project + task commands"
```

---

## Task 22: Integration Test Harness

**Files:**
- Create: `packages/core/test/integration/helpers/supabase-test.ts`, `packages/core/test/integration/helpers/client.ts`

These helpers spin up signed-in clients backed by separate InMemoryStores against the local Supabase instance. They assume `supabase start` is already running on the developer's machine and that `.env` is populated.

- [ ] **Step 1: Create `packages/core/test/integration/helpers/supabase-test.ts`**

```ts
import "dotenv/config";

export const SUPABASE_URL = process.env.SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  throw new Error(
    "Integration tests need SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Run `supabase start` and copy keys into .env.",
  );
}

import { createClient } from "@supabase/supabase-js";

/** Service-role client used to provision and clean up per-test users. */
export function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function createTestUser(email: string, password: string): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw error;
  return data.user!.id;
}

export async function deleteTestUser(userId: string): Promise<void> {
  const admin = adminClient();
  await admin.auth.admin.deleteUser(userId);
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@pulse.test`;
}
```

- [ ] **Step 2: Create `packages/core/test/integration/helpers/client.ts`**

```ts
import {
  AuthService,
  createPulseSupabaseClient,
  InMemoryStore,
  Outbox,
  SyncEngine,
  type TokenStorage,
} from "../../../src/index.js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-test.js";

class MemoryTokens implements TokenStorage {
  store = new Map<string, string>();
  async get(k: string) { return this.store.get(k) ?? null; }
  async set(k: string, v: string) { this.store.set(k, v); }
  async clear() { this.store.clear(); }
}

export interface TestClient {
  userId: string;
  store: InMemoryStore;
  outbox: Outbox;
  engine: SyncEngine;
  signOut: () => Promise<void>;
}

/** Build a signed-in TestClient. The user must already exist (createTestUser). */
export async function buildSignedInClient(
  email: string, password: string,
): Promise<TestClient> {
  const supa = createPulseSupabaseClient({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });
  const auth = new AuthService(supa, new MemoryTokens());
  const session = await auth.signIn(email, password);
  // Inject the access token so PostgREST sees the user.
  await supa.auth.setSession({ access_token: session.accessToken, refresh_token: session.refreshToken });
  const store = new InMemoryStore();
  const outbox = new Outbox();
  const engine = new SyncEngine({ supabase: supa, outbox, store, userId: session.user.id });
  return {
    userId: session.user.id,
    store, outbox, engine,
    signOut: () => auth.signOut(),
  };
}
```

- [ ] **Step 3: Add `dotenv` to `packages/core/package.json` devDependencies**

Edit `packages/core/package.json`, add to `devDependencies`:
```json
"dotenv": "^16.4.0"
```
Then run: `pnpm install`

- [ ] **Step 4: Commit**

```bash
git add packages/core/test/integration packages/core/package.json pnpm-lock.yaml
git commit -m "test(core): integration test harness helpers"
```

---

## Task 23: Integration Test — Two Clients, Concurrent Different-Field Updates

**Files:**
- Create: `packages/core/test/integration/conflict-scenarios.test.ts`
- Modify: `packages/core/vitest.config.ts` to add an integration project

- [ ] **Step 1: Update `packages/core/vitest.config.ts`** to include integration tests

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["node_modules"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
```

- [ ] **Step 2: Write the test**

Create `packages/core/test/integration/conflict-scenarios.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeProject, makeTask, nowIso } from "../../src/index.js";
import {
  createTestUser, deleteTestUser, uniqueEmail,
} from "./helpers/supabase-test.js";
import { buildSignedInClient } from "./helpers/client.js";

const PASSWORD = "test-password-123";
let userId: string;
const email = uniqueEmail("concurrent");

beforeAll(async () => {
  userId = await createTestUser(email, PASSWORD);
});

afterAll(async () => {
  await deleteTestUser(userId);
});

describe("concurrent different-field updates", () => {
  it("both fields survive when two clients change different fields offline", async () => {
    const a = await buildSignedInClient(email, PASSWORD);
    const b = await buildSignedInClient(email, PASSWORD);

    // Client A creates a project and a task, syncs.
    const project = makeProject({ userId, name: "P" });
    await a.store.upsert("projects", project);
    await a.outbox.enqueue({
      entityTable: "projects", entityId: project.id, op: "insert",
      changedFields: serializeProject(project), clientTs: project.updatedAt,
    });
    const task = makeTask({ userId, projectId: project.id, title: "Original" });
    await a.store.upsert("tasks", task);
    await a.outbox.enqueue({
      entityTable: "tasks", entityId: task.id, op: "insert",
      changedFields: serializeTask(task), clientTs: task.updatedAt,
    });
    await a.engine.push();

    // Client B pulls.
    await b.engine.pull(null);
    const seen = await b.store.findById<any>("tasks", task.id);
    expect(seen?.title).toBe("Original");

    // Both go "offline": A changes title, B changes status. Different timestamps.
    const tsA = nowIso();
    await a.store.upsert("tasks", { ...task, title: "Changed by A", updatedAt: tsA });
    await a.outbox.enqueue({
      entityTable: "tasks", entityId: task.id, op: "update",
      changedFields: { title: "Changed by A" }, clientTs: tsA,
    });

    await new Promise((r) => setTimeout(r, 5));
    const tsB = nowIso();
    await b.store.upsert("tasks", { ...seen, status: "in_progress", updatedAt: tsB });
    await b.outbox.enqueue({
      entityTable: "tasks", entityId: task.id, op: "update",
      changedFields: { status: "in_progress" }, clientTs: tsB,
    });

    // Both come back online and push.
    await a.engine.push();
    await b.engine.push();

    // Both pull and converge.
    await a.engine.pull(null);
    await b.engine.pull(null);

    const finalA = await a.store.findById<any>("tasks", task.id);
    const finalB = await b.store.findById<any>("tasks", task.id);
    expect(finalA?.title).toBe("Changed by A");
    expect(finalA?.status).toBe("in_progress");
    expect(finalB?.title).toBe("Changed by A");
    expect(finalB?.status).toBe("in_progress");
  });
});

// helpers re-used below — consider promoting to helpers/ once tests grow.
function serializeProject(p: any) {
  return {
    id: p.id, name: p.name, color: p.color, archived: p.archived,
    sortOrder: p.sortOrder, createdAt: p.createdAt, updatedAt: p.updatedAt,
    deletedAt: p.deletedAt,
  };
}
function serializeTask(t: any) {
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

- [ ] **Step 3: Run test**

Ensure `supabase start` is running and `.env` is populated.
Run: `pnpm --filter @pulse/core test`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/test/integration packages/core/vitest.config.ts
git commit -m "test(core): integration — concurrent different-field updates"
```

---

## Task 24: Integration Test — Same-Field Conflict, Delete vs Update

**Files:**
- Modify: `packages/core/test/integration/conflict-scenarios.test.ts`

- [ ] **Step 1: Append two more `describe` blocks**

```ts
describe("same-field conflict", () => {
  it("later client_ts wins when both clients change the same field", async () => {
    const a = await buildSignedInClient(email, PASSWORD);
    const b = await buildSignedInClient(email, PASSWORD);

    const project = makeProject({ userId, name: "PX" });
    await a.store.upsert("projects", project);
    await a.outbox.enqueue({
      entityTable: "projects", entityId: project.id, op: "insert",
      changedFields: serializeProject(project), clientTs: project.updatedAt,
    });
    const task = makeTask({ userId, projectId: project.id, title: "Original" });
    await a.store.upsert("tasks", task);
    await a.outbox.enqueue({
      entityTable: "tasks", entityId: task.id, op: "insert",
      changedFields: serializeTask(task), clientTs: task.updatedAt,
    });
    await a.engine.push();
    await b.engine.pull(null);

    const tsA = nowIso();
    await a.outbox.enqueue({
      entityTable: "tasks", entityId: task.id, op: "update",
      changedFields: { title: "From A" }, clientTs: tsA,
    });
    await new Promise((r) => setTimeout(r, 10));
    const tsB = nowIso();
    await b.outbox.enqueue({
      entityTable: "tasks", entityId: task.id, op: "update",
      changedFields: { title: "From B" }, clientTs: tsB,
    });

    await a.engine.push();
    await b.engine.push();
    await a.engine.pull(null);
    await b.engine.pull(null);

    const finalA = await a.store.findById<any>("tasks", task.id);
    const finalB = await b.store.findById<any>("tasks", task.id);
    expect(finalA?.title).toBe("From B");
    expect(finalB?.title).toBe("From B");
  });
});

describe("delete vs update", () => {
  it("delete with later ts wins over earlier update", async () => {
    const a = await buildSignedInClient(email, PASSWORD);
    const b = await buildSignedInClient(email, PASSWORD);

    const project = makeProject({ userId, name: "PD" });
    await a.store.upsert("projects", project);
    await a.outbox.enqueue({
      entityTable: "projects", entityId: project.id, op: "insert",
      changedFields: serializeProject(project), clientTs: project.updatedAt,
    });
    const task = makeTask({ userId, projectId: project.id, title: "T" });
    await a.store.upsert("tasks", task);
    await a.outbox.enqueue({
      entityTable: "tasks", entityId: task.id, op: "insert",
      changedFields: serializeTask(task), clientTs: task.updatedAt,
    });
    await a.engine.push();
    await b.engine.pull(null);

    const tsUpdate = nowIso();
    await a.outbox.enqueue({
      entityTable: "tasks", entityId: task.id, op: "update",
      changedFields: { title: "renamed" }, clientTs: tsUpdate,
    });
    await new Promise((r) => setTimeout(r, 10));
    const tsDelete = nowIso();
    await b.outbox.enqueue({
      entityTable: "tasks", entityId: task.id, op: "delete",
      changedFields: {}, clientTs: tsDelete,
    });

    await a.engine.push();
    await b.engine.push();
    await a.engine.pull(null);
    await b.engine.pull(null);

    const a2 = await a.store.findById<any>("tasks", task.id);
    const b2 = await b.store.findById<any>("tasks", task.id);
    expect(a2?.deletedAt).not.toBeNull();
    expect(b2?.deletedAt).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @pulse/core test`
Expected: 3 integration tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/core/test/integration/conflict-scenarios.test.ts
git commit -m "test(core): integration — same-field LWW and delete-vs-update"
```

---

## Task 25: Integration Test — Failure Scenarios and RLS Negative

**Files:**
- Create: `packages/core/test/integration/failure-scenarios.test.ts`, `packages/core/test/integration/rls.test.ts`

- [ ] **Step 1: Create `failure-scenarios.test.ts`**

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeProject, makeTask, nowIso } from "../../src/index.js";
import { createTestUser, deleteTestUser, uniqueEmail } from "./helpers/supabase-test.js";
import { buildSignedInClient } from "./helpers/client.js";

const PASSWORD = "test-password-123";
let userId: string;
const email = uniqueEmail("failures");

beforeAll(async () => { userId = await createTestUser(email, PASSWORD); });
afterAll(async () => { await deleteTestUser(userId); });

describe("initial sync on a fresh device", () => {
  it("pulls all non-deleted rows for the user", async () => {
    const a = await buildSignedInClient(email, PASSWORD);
    const project = makeProject({ userId, name: "Init" });
    await a.outbox.enqueue({
      entityTable: "projects", entityId: project.id, op: "insert",
      changedFields: {
        id: project.id, name: project.name, color: project.color,
        archived: project.archived, sortOrder: project.sortOrder,
        createdAt: project.createdAt, updatedAt: project.updatedAt,
        deletedAt: project.deletedAt,
      },
      clientTs: project.updatedAt,
    });
    await a.engine.push();

    // Fresh client
    const b = await buildSignedInClient(email, PASSWORD);
    expect(await b.store.findById("projects", project.id)).toBeNull();
    await b.engine.pull(null);
    const got = await b.store.findById<any>("projects", project.id);
    expect(got?.name).toBe("Init");
  });

  it("does not pull other users' rows", async () => {
    const otherEmail = uniqueEmail("other");
    const otherUser = await createTestUser(otherEmail, PASSWORD);
    try {
      const o = await buildSignedInClient(otherEmail, PASSWORD);
      const project = makeProject({ userId: otherUser, name: "secret" });
      await o.outbox.enqueue({
        entityTable: "projects", entityId: project.id, op: "insert",
        changedFields: {
          id: project.id, name: project.name, color: project.color,
          archived: project.archived, sortOrder: project.sortOrder,
          createdAt: project.createdAt, updatedAt: project.updatedAt,
          deletedAt: project.deletedAt,
        },
        clientTs: project.updatedAt,
      });
      await o.engine.push();

      const me = await buildSignedInClient(email, PASSWORD);
      await me.engine.pull(null);
      expect(await me.store.findById("projects", project.id)).toBeNull();
    } finally {
      await deleteTestUser(otherUser);
    }
  });
});
```

- [ ] **Step 2: Create `rls.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { createPulseSupabaseClient } from "../../src/index.js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./helpers/supabase-test.js";

describe("RLS — unauthenticated access", () => {
  it("anonymous select returns zero rows", async () => {
    const supa = createPulseSupabaseClient({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });
    const { data, error } = await supa.from("projects").select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("anonymous insert is rejected", async () => {
    const supa = createPulseSupabaseClient({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });
    const { error } = await supa.from("projects").insert({
      id: "00000000-0000-7000-8000-000000000000",
      user_id: "00000000-0000-7000-8000-000000000001",
      name: "x",
    });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @pulse/core test`
Expected: all pass (assuming Supabase is running).

- [ ] **Step 4: Commit**

```bash
git add packages/core/test/integration
git commit -m "test(core): integration — initial sync, cross-user isolation, RLS"
```

---

## Task 26: Linting and Final Build Sanity

**Files:**
- Create: `eslint.config.js` at repo root, `.prettierrc.json`
- Modify: `packages/core/package.json` and `tools/cli/package.json` to add `lint` scripts (already present in skeleton)

- [ ] **Step 1: Create `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 2: Create `eslint.config.js`**

```js
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  { ignores: ["**/dist/**", "**/node_modules/**", "**/*.config.*"] },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
];
```

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: no errors (warnings allowed).

- [ ] **Step 4: Run full test + build**

Run: `pnpm install && pnpm -r build && pnpm -r test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add eslint.config.js .prettierrc.json
git commit -m "chore: prettier and eslint config"
```

---

## Task 27: README Polish and Acceptance-Criteria Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace `README.md` with the final version**

```markdown
# Pulse Project Planner

Single-user project management synced between Windows desktop and iOS via Supabase. This repository is **Phase 1: Foundation** — backend schema, sync engine, auth wrapper, and a CLI test harness. Phase 2 (Desktop app) and Phase 3 (iOS app) live in separate plans.

## Quickstart

```bash
nvm use                        # node 20
corepack enable                # pnpm 9
pnpm install
supabase start                 # spins up local Postgres + Auth
cp .env.example .env           # then paste anon + service-role keys printed by `supabase start`
pnpm -r build
pnpm -r test
```

## Repo layout

- `packages/core` — platform-agnostic library: domain types, Zod validators, sync engine, auth wrapper.
- `supabase/` — schema migrations and RPC.
- `tools/cli` — `pulse-cli` test harness for two-machine smoke tests.

## Sync model

- Local SQLite (or InMemoryStore in tests) is source of truth for the UI.
- Mutations are appended to an outbox, pushed to Supabase via the `sync_upsert` RPC.
- Pull queries each table by `updated_at > cursor`. Outbox-changed fields are preserved over remote on local merge.
- Conflict resolution: **Last-Write-Wins per field**, comparing `client_ts` against the row's `updated_at`. Two devices changing the same field offline → later write wins, no merge UI.
- Clock skew between devices can flip LWW outcomes; both devices should rely on NTP. Document this expectation to end users.

## Data model

See `docs/superpowers/specs/2026-05-09-pulse-planner-foundation-design.md` §6 for the full schema.

## Testing

- `pnpm --filter @pulse/core test` runs unit tests (no Supabase needed) and integration tests (Supabase required).
- The integration suite spins up multiple signed-in clients against the local Supabase and asserts convergence under concurrent writes, deletes, and partitions.

## Phase 1 acceptance criteria (all should pass)

- [x] `pnpm install && pnpm -r build` succeeds from a clean clone.
- [x] `supabase start && supabase db reset` provisions schema + RLS + `sync_upsert`.
- [x] `pnpm test` passes all unit and integration scenarios.
- [x] `pulse-cli` end-to-end: signup → create projects/tasks → second client signs in, pulls, modifies concurrently → LWW behavior holds.
- [x] All entity tables enforce RLS (negative test in `rls.test.ts`).
- [x] README documents environment setup, the LWW trade-off, and clock-skew expectations.
```

- [ ] **Step 2: Verify acceptance criteria manually**

Run from a clean clone:
```bash
pnpm install
supabase start
supabase db reset
cp .env.example .env   # paste keys from `supabase start` output
pnpm -r build
pnpm -r test
```
Expected: all green; integration tests pass.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: Phase 1 README and acceptance-criteria checklist"
```

---

## Done

Phase 1 is complete when every task above is checked. The next plan
(Phase 2 — Desktop App) is brainstormed and written separately.
