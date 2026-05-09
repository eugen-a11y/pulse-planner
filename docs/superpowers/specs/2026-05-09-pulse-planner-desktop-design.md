# Pulse Project Planner — Desktop App (Phase 2) Design

**Status:** Draft for review
**Date:** 2026-05-09
**Predecessor:** `docs/superpowers/specs/2026-05-09-pulse-planner-foundation-design.md` (Phase 1)
**Successor:** `docs/superpowers/specs/<future>-pulse-planner-mobile-design.md` (Phase 3)

## 1. Overview

Phase 2 builds the Windows desktop app for Pulse Project Planner. It is an Electron app that consumes the platform-agnostic `@pulse/core` library produced in Phase 1, adds a Vite + React + Zustand renderer, ships the SQLite-backed `LocalStore` implementation that Phase 1 deliberately deferred, and integrates the desktop-native surfaces the user requested: tray icon, global hotkey, notifications, and auto-update.

The app delivers full Banana-Split feature parity (projects, tasks with subtasks/recurrence, tags, time-tracking, notes, comments, attachments, kanban) plus the Pulse-extras: native Windows toasts, `Ctrl+Shift+Space` Quick-Add, tray badge for Today-count, and electron-updater-driven auto-update via GitHub Releases. Visual style is light-only, electric-blue (`#2563EB`) accent, inspired by `pulsehamburg.de`.

## 2. Goals

- Working Windows-x64 NSIS installer (`Pulse-Setup-x.y.z.exe`) with auto-update.
- Two-machine convergence: a Pulse-Desktop edit on one machine reaches a Pulse-Desktop on a second machine via Phase 1's `SyncEngine`, with the per-field LWW guarantees from Phase 1 preserved.
- Today-Agenda as the landing view; 3-pane shell (sidebar | task list | task detail).
- All native integrations functional: Tray, GlobalShortcut, Notifications, Auto-Update.
- Acceptance test: manual smoke against the packaged installer, plus automated Playwright E2E on the unpacked binary.

## 3. Non-Goals (Phase 2)

- No macOS or Linux build (Windows-x64 only).
- No multi-user / sharing / role permissions. Single-user account; RLS enforces isolation as in Phase 1.
- No AI features, no third-party integrations (no Slack, no calendar sync).
- No web app; the Electron renderer is the only UI.
- No CI/CD pipeline; releases are manual and infrequent (solo project).
- No EV code-signing in v1; smart-screen warning is documented in the README. v1.1 may add EV-cert if usage broadens.
- No dark mode in v1; Tailwind tokens are scaffolded so v1.x can ship dark without re-architecting.

## 4. Architecture

### 4.1 Process Topology

The app uses Electron's standard two-process model:

```
┌──────────────────────── Electron App ───────────────────────────┐
│                                                                  │
│  Main Process (Node.js, hosts @pulse/core)                       │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  apps/desktop/src/main/index.ts                        │     │
│  │   ├─ window.ts          BrowserWindow + Quick-Add win  │     │
│  │   ├─ tray.ts            Tray icon + badge + menu       │     │
│  │   ├─ hotkey.ts          globalShortcut Ctrl+Shift+Spc  │     │
│  │   ├─ notifications.ts   Schedules + fires Toasts       │     │
│  │   ├─ updater.ts         electron-updater + signals     │     │
│  │   ├─ ipc.ts             Typed handlers (see §4.3)      │     │
│  │   └─ store/                                            │     │
│  │       └─ better-sqlite-store.ts  LocalStore impl       │     │
│  │                                                         │     │
│  │   from @pulse/core: AuthService, SyncEngine, Outbox,   │     │
│  │   conflict merge helpers, domain types/Zod schemas.    │     │
│  └────────────────────────────────────────────────────────┘     │
│                            ▲                                     │
│                       contextBridge                              │
│                       (preload.ts)                               │
│                            ▼                                     │
│  Renderer Process (Chromium, sandboxed)                          │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  apps/desktop/src/renderer (Vite + React)              │     │
│  │   ├─ shell/    Layout: Sidebar | List | Detail         │     │
│  │   ├─ today/    Agenda view                             │     │
│  │   ├─ project/  Project view + Kanban                   │     │
│  │   ├─ quick-add/ Modal in second window                 │     │
│  │   ├─ stores/   Zustand: tasks, projects, ui, timer     │     │
│  │   └─ api.ts    window.pulse.* typed wrapper            │     │
│  └────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Renderer Sandbox

Renderer windows are created with `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`. The renderer has no direct Node, file-system, or SQLite access. All bridges go through `preload.ts` via `contextBridge.exposeInMainWorld('pulse', api)`.

### 4.3 IPC Surface (typed)

All IPC handlers live in `apps/desktop/src/main/ipc.ts`. The `window.pulse` shape exposed in the renderer is:

```ts
window.pulse = {
  auth: {
    signIn(email, password): Promise<PulseSession>,
    signUp(email, password): Promise<PulseSession>,
    signOut(): Promise<void>,
    restoreSession(): Promise<PulseSession | null>,
  },
  projects: {
    list(): Promise<Project[]>,
    create(input): Promise<Project>,
    update(id, fields): Promise<Project>,
    delete(id): Promise<void>,
  },
  tasks: {
    list(filter): Promise<Task[]>,
    list_today(): Promise<Task[]>,
    list_upcoming(): Promise<Task[]>,
    create(input): Promise<Task>,
    update(id, fields): Promise<Task>,
    delete(id): Promise<void>,
    complete(id): Promise<Task>,
  },
  tags: { list, create, attach, detach },
  notes: { list, create, update, delete },
  comments: { list, create, update, delete },
  attachments: { list, upload, delete },
  time_entries: { list, start, stop, delete },
  sync: {
    pushNow(): Promise<void>,
    pullNow(): Promise<void>,
    onStatusChange(cb): Unsubscribe,    // wraps webContents IPC events
  },
  timer: {
    start(taskId): Promise<TimeEntry>,
    stop(): Promise<TimeEntry | null>,
    onCurrentChange(cb): Unsubscribe,
  },
  quickAdd: {
    show(): void,
    parse(text): Promise<{ title, projectId?, dueDate?, priority?, tagNames? }>,
  },
  notifications: { schedule, snooze, dismiss },
  updater: {
    check(): Promise<UpdateInfo | null>,
    onDownloadProgress(cb): Unsubscribe,
    installAndRestart(): void,
  },
}
```

**Patterns:**

- **Request/Response:** `ipcRenderer.invoke('tasks.list', filter)` → main returns `Task[]`.
- **Events from main → renderer:** Main calls `webContents.send('tasks.changed', { projectId })` after a successful sync-pull mutates local data. Renderer Zustand stores subscribe and invalidate the affected slice.
- **Events as observables:** Helpers like `sync.onStatusChange(cb)` return an `Unsubscribe` and internally bridge `ipcRenderer.on(...)` → callback.

## 5. Data Flow & State Management

### 5.1 Source of Truth

The local SQLite database in the main process is the single source of truth. Renderer Zustand stores are pure caches — when the main process emits `*.changed`, affected slices are re-fetched.

### 5.2 Read Path

```
Renderer view mounts
  → useTasks(projectId)             // Zustand selector
  → if cache stale: window.pulse.tasks.list({projectId})
  → Main: BetterSqliteStore.listSince(...) → returns rows (camelCase via mapper)
  → Renderer subscribes to 'tasks.changed' → re-fetches affected slice on event
```

### 5.3 Write Path (local mutation)

```
User clicks ✓ "Storyboard schreiben"
  → window.pulse.tasks.complete(taskId)
  → Main:
      1. store.upsert("tasks", { ...task, status:"done", completedAt:nowIso(), updatedAt:nowIso() })
      2. outbox.enqueue({ op:"update", changedFields:{ status, completedAt }, clientTs:nowIso() })
      3. webContents.send('tasks.changed', { projectId })
      4. engine.push() (fire-and-forget)
      5. resolve IPC immediately
  → Renderer: optimistic UI update + cache invalidation on event
```

### 5.4 Sync Loop

- **Pull cursor per table:** persisted in a new local `sync_state` table (`{ table TEXT PRIMARY KEY, last_pulled_at TEXT NOT NULL }`). Replaces Phase 1's in-memory cursor.
- **Pull triggers:** app start; realtime event (debounced 500ms); manual refresh (`F5`); 60-second backstop timer.
- **Push triggers:** after each local mutation; realtime reconnect; app start (drain pending outbox).
- **Realtime:** `engine.subscribeRealtime(() => triggerPull())`. Pulse listens for postgres-changes and triggers a pull rather than applying realtime payloads directly, to keep one merge code path.

### 5.5 Active Timer

The active time-entry lives in the main process as the single source. The renderer subscribes to `timer.onCurrentChange` for the top-bar pill. On app quit, the timer is *not* stopped — it remains running. On next start, elapsed time is recomputed from `started_at`.

### 5.6 Conflict Resolution (recap from Phase 1)

- Server wins for fields not currently in the local outbox.
- Local outbox-changed fields win during pull-merge (`mergeRemoteWithOutbox`).
- On push, per-field LWW via the `sync_upsert` RPC.

### 5.7 Error Handling

- IPC errors → JS exception in renderer → `<Toast>` in bottom-right with operation context.
- Sync failures (network, expired auth) → banner in sidebar with retry button and the last error from outbox `lastError`.
- Fatal main-process crash → renderer shows full-screen "Pulse must restart" with a Restart button.
- 401 from Supabase → main calls `auth.signOut()` → renderer shows Re-Sign-In modal; outbox is preserved and drained after re-sign-in.

## 6. Native Integrations

### 6.1 Tray (`apps/desktop/src/main/tray.ts`)

- Icon: 16×16 + 32×32 ICO with Pulse-blue dot logo. Windows-only, single light-themed icon.
- Tooltip: `"Pulse · 3 Tasks heute · 1 überfällig"` (live-updated on data change).
- Badge: simulated by dynamically composing the tray icon (overlay red dot + count). Fallback if compositing renders poorly on high-DPI: static icon, count in tooltip only.
- Click: toggle main window (show/hide).
- Right-click menu: `Pulse öffnen`, `Quick Add (Ctrl+Shift+Space)`, separator, `Today`, `Upcoming`, separator, `Beenden`.
- When an update is available: top menu item `"Update auf v0.2.1 installieren"`.

### 6.2 Global Hotkey (`apps/desktop/src/main/hotkey.ts`)

- `globalShortcut.register('Ctrl+Shift+Space', openQuickAdd)` at app start.
- Registration failure → toast `"Hotkey unavailable; open via tray"`. v1.1 will offer a settings pane to rebind.
- `app.on('will-quit')` → `globalShortcut.unregisterAll()`.

### 6.3 Quick-Add Modal

- Second `BrowserWindow`, frameless, `width:600 height:120`, focused-on-show.
- Same preload bridge.
- Input parser supports inline syntax:
  - `@<project-prefix>` — fuzzy project lookup
  - `!1` … `!4` — priority
  - Natural date: "heute", "morgen", "freitag", "15.05" + optional time, parsed via `chrono-node` German locale
  - `#<tag>` — tag name (created if missing)
- Esc or blur closes; submit creates the task and shows a bottom-right toast.

### 6.4 Notifications (`apps/desktop/src/main/notifications.ts`)

- **Scheduling:** at app start and after each task mutation, fetch all tasks with `due_date` in the next 24h, register `setTimeout` per task. Old timers are cleared first.
- **Fire:** `new Notification({ title: task.title, body: project.name + ' · ' + relativeTime(due_date), actions: [{ type:'button', text:'10 Min später' }, { type:'button', text:'Erledigt' }], silent: false })`.
- **Actions:**
  - "10 Min später" → `due_date += 10min` via task update.
  - "Erledigt" → `complete(taskId)`.
  - Body click → bring main window to front, focus the task in detail-pane.
- **Sleep/resume:** on `powerMonitor.on('resume')`, all timers are re-scheduled. Notifications missed by ≤5 min still fire ("verpasst: Storyboard").

### 6.5 Auto-Update (`apps/desktop/src/main/updater.ts`)

- `electron-updater` with GitHub Releases provider.
- Polling: every 6 hours and at every app start.
- UX: not silent. When an update is downloaded, an in-app notification offers `"Jetzt installieren"` (relaunch immediately) or `"Beim nächsten Start"` (deferred).
- Code-signing optional; without an EV cert, smart-screen warns on install (documented in README).
- Release artefacts: Windows-x64 NSIS installer + blockmap (for differential updates) + `latest.yml`.

## 7. UI Components & Screens

### 7.1 App Shell

```
┌──────────┬───────────────────────┬──────────────────────┐
│ Sidebar  │ List-Pane             │ Detail-Pane          │
│  220px   │ flex: 1, min 360px    │ 380px (collapsible)  │
├──────────┼───────────────────────┼──────────────────────┤
│ Pulse ▾  │ ★ Heute · Donnerstag  │ ← (closed) or detail │
│          │                       │                      │
│ ★ Today  │ [Inline new-task ↵]   │                      │
│ Upcoming │                       │                      │
│ Inbox    │ ÜBERFÄLLIG            │                      │
│          │  · Newsletter senden  │                      │
│ ─────    │                       │                      │
│ PROJECTS │ HEUTE (3)             │                      │
│ ● pulse  │  · Storyboard         │                      │
│ ● Phase2 │  · Steuerb. Mail      │                      │
│ ● Person.│  · Slides Review      │                      │
│ + neu    │                       │                      │
│          │                       │                      │
│ TAGS     │                       │                      │
│ #urgent  │                       │                      │
│ #waiting │                       │                      │
└──────────┴───────────────────────┴──────────────────────┘
[ ⏱ 00:23:14 · Storyboard schreiben · ⏹ ]   [Sync ✓ vor 12s]
   Top-bar pill (timer running only)            Bottom-status
```

Min window size 1280×720. Below 1100px width, the detail pane auto-collapses to a 2-pane layout.

### 7.2 Component Hierarchy

```
<AppShell>
  <Sidebar>
    <SystemViews>           // Today, Upcoming, Inbox
    <ProjectList>           // editable, drag to reorder
    <TagList>               // click filters current view
  <MainPane>
    <ListView>              // virtualized via react-window for big lists
      <ListHeader>          // title, view-options, +new-task
      <TaskRow>×N           // checkbox, title, priority, due, project-chip
    <KanbanView>            // alternative for project view, dnd-kit
      <KanbanColumn>×3      // todo, in_progress, done
        <TaskCard>×N
  <DetailPane>              // collapsible, ESC closes
    <TaskHeader>
    <TaskMeta>              // due, recurrence, tags
    <TaskBody>              // markdown description (editable)
    <SubtaskList>           // 1-level deep (Phase-1 trigger enforces)
    <TimeEntries>           // history + start/stop button
    <Comments>
    <Attachments>           // list + drop zone
  <TopBarPill>              // timer pill
  <StatusBar>               // sync state, online/offline, last-sync
  <ToastStack>              // bottom-right transient messages
```

### 7.3 Library Choices

- **shadcn/ui** primitives (Dialog, DropdownMenu, Popover, Tooltip, ContextMenu) — copy-paste, Tailwind-based.
- **Tailwind CSS** with Pulse tokens:
  ```css
  --pulse-blue: #2563EB;
  --pulse-blue-hover: #1D4ED8;
  --gray-bg: #FAFAFA;
  --border: #E5E5E5;
  ```
- **react-window** — virtualised task lists (>100 items).
- **dnd-kit** — kanban drag-and-drop, subtask reorder.
- **chrono-node** with `de` locale — Quick-Add date parsing.
- **lucide-react** — icons (matches pulsehamburg.de).
- **react-hook-form + zod** — forms; reuses Zod schemas from `@pulse/core`.
- **date-fns** with `de` locale — date display.

### 7.4 Special Screens

- **Auth (pre-signin):** centred Pulse logo, email + password form, "Neu hier? Konto erstellen" toggle.
- **Empty Today:** large checkmark + "Nichts mehr für heute. Schön." + Quick-Add button.
- **Empty project:** "+ Erste Task".
- **Empty sidebar:** onboarding hint.
- **Offline banner:** slim bar at top of list-pane: `"Offline · 3 Änderungen werden übertragen"` with retry.
- **Re-sign-in modal:** triggered by 401; preserves outbox.

### 7.5 Kanban View

- Toggle in project-view header (List ⇄ Kanban).
- 3 columns: Todo · In Progress · Done.
- Drag-drop changes `status` via dnd-kit `useDroppable`.
- Done column shows last 7 days only; older items collapsed under "Show 12 more".

## 8. Build, Distribution & Testing

### 8.1 Repo Layout (Phase 2 additions)

```
apps/
  desktop/
    package.json                    # @pulse/desktop
    vite.config.ts                  # vite-plugin-electron
    electron-builder.yml
    src/
      main/
        index.ts
        window.ts
        tray.ts
        hotkey.ts
        notifications.ts
        updater.ts
        ipc.ts
        store/
          better-sqlite-store.ts    # LocalStore impl
          migrations/               # local SQLite schema for desktop
        preload.ts
      renderer/
        index.html
        main.tsx
        api.ts
        shell/
        today/
        project/
        quick-add/
        components/
        stores/
        styles/tailwind.css
    test/
      unit/                         # Vitest
      e2e/                          # Playwright
    assets/
      icon.ico
      tray-default.png
      tray-with-count-template.png
```

### 8.2 `@pulse/core` Additions

- Stricter `BaseRow`-generic typing for `BetterSqliteStore`.
- A `SyncStateRepo` helper for persisted pull cursors (replaces Phase 1's in-memory cursor passing).
- snake_case ⇄ camelCase row mapping helpers extracted to `packages/core/src/sync/case-mapping.ts` for reuse by both `BetterSqliteStore` and the existing `SyncEngine`.

### 8.3 Build Pipeline

```
pnpm --filter @pulse/desktop dev      # vite-plugin-electron, Main + Renderer HMR
pnpm --filter @pulse/desktop build    # tsc + vite build → dist/
pnpm --filter @pulse/desktop pack     # electron-builder dir-only (for testing)
pnpm --filter @pulse/desktop dist     # electron-builder NSIS installer + latest.yml
```

### 8.4 electron-builder.yml

- target: `nsis` (one-click installer + auto-update).
- arch: `x64` only.
- code-signing: optional via env (`CSC_LINK`, `CSC_KEY_PASSWORD`); without an EV cert, smart-screen warns.
- publish: `github` (GitHub Releases as update server).
- artifactName: `Pulse-Setup-${version}.${ext}`.

### 8.5 Distribution

- v1: unsigned, GitHub Releases. README documents the smart-screen warning.
- v1.1: EV code-signing-cert (~$300/year) once usage broadens.
- Auto-updater polls `https://github.com/<user>/pulse-planner/releases/latest/latest.yml` every 6h.

### 8.6 Testing

| Layer | Tooling | Scope |
|---|---|---|
| `@pulse/core` unit | Vitest | Phase 1's 54 unit + 7 integration tests, unchanged |
| Desktop main pure functions | Vitest in `apps/desktop` | Quick-Add parser, notification scheduler (fake-timers), IPC handler mocks |
| Desktop renderer components | Vitest + happy-dom + RTL | TaskRow, TaskDetail, KanbanColumn — pure render |
| End-to-end | Playwright + electron-launcher | Packaged app: signin → task → today → timer → restart |
| Manual smoke | — | Tray click, hotkey, native notifications |

E2E acceptance flows:
1. Cold start → signup → empty today → Quick-Add via hotkey → task appears.
2. Task with due-time → start timer → 5s wait → stop → time-entry persisted.
3. Project with 3 tasks → kanban view → drag Todo→Done → status correct + sync.
4. Offline toggle (DevTools network) → mutate → online → outbox drains.
5. Quit → restart → last view + data + running timer all restored.
6. Update flow with mock `latest.yml` → "Update available" → install → restart.

No CI in scope. Runs are local; release smoke is manual against the packaged installer.

## 9. Trade-offs and Risks

### 9.1 Accepted Trade-offs

| Trade-off | Decision | Rationale |
|---|---|---|
| 3-pane requires ≥1280px | Detail-pane is collapsible | Primary use is on a large monitor; laptop fallback is supported |
| No dark mode | Light only in v1 | -40% UI polish; Tailwind tokens scaffolded for v1.x dark |
| No mac/Linux | Windows-x64 only | Phase 3 covers mobile; no Linux/Mac demand |
| Unsigned installer in v1 | Smart-screen warning documented | EV-cert cost only justified at broader use |
| No CI/CD | Manual releases | Solo project, releases <1×/week expected |
| Quick-Add German locale only | `chrono-de` | User is German; `en` locale trivial later |
| Realtime triggers pull, not direct apply | Pull after realtime event | Outbox merge is needed anyway; one apply path |
| `task_tags` not in pull cursor (Phase-1 known limitation) | Realtime-only sync for `task_tags` | Tag drift possible after extended offline; tracked for Phase 3 |

### 9.2 Risks and Mitigations

1. **better-sqlite3 native rebuild for Electron ABI** — `postinstall` runs `electron-rebuild` automatically; fail-fast if absent.
2. **GlobalShortcut conflict** — fallback toast "Hotkey unavailable; open via tray"; v1.1 settings UI for custom binding.
3. **Notifications during sleep/hibernate** — re-schedule on `powerMonitor.resume`; missed-by-≤5min still fired.
4. **Auto-update rollback** — electron-updater has no rollback; pre-release E2E smoke is mandatory; README documents manual rollback.
5. **Auth-token-refresh-loop** — sync's 401 handler triggers signOut; outbox preserved across re-sign-in.
6. **Drag-drop performance on big kanban** — `react-window` virtualises; Done column already 7-day-limited.
7. **Differential updates** — electron-builder generates blockmaps; expected ~5-15MB diffs against ~80MB binary.
8. **Realtime pull-trigger throttle** — main-side debounces `triggerPull` at 500ms.

### 9.3 Unknown Unknowns

- Real-world dataset behaviour at 200+ tasks and 50+ time-entries/day.
- Tray-icon badge compositing on high-DPI Windows displays.
- chrono-node German edge cases (e.g., "nächsten Mittwoch um halb 3").

## 10. Acceptance Criteria

Phase 2 is complete when:

- [ ] `pnpm --filter @pulse/desktop dist` produces `Pulse-Setup-x.y.z.exe` plus `latest.yml` and blockmap.
- [ ] Cold installation on a clean Windows-x64 machine launches Pulse, shows signin, and after sign-in shows the Today-Agenda.
- [ ] Two-machine convergence test: an edit on machine A appears on machine B within 5s of a manual pull (or instantly via realtime).
- [ ] Tray icon visible after launch with live Today-count tooltip; click toggles main window.
- [ ] `Ctrl+Shift+Space` opens the Quick-Add modal from any focused application.
- [ ] A task with `due_date` 30s in the future fires a native Windows toast at the due time, with snooze and complete actions functional.
- [ ] Updating an old build via the in-app updater installs and relaunches successfully.
- [ ] All Phase 1 acceptance criteria still pass.
- [ ] Playwright E2E: all 6 flows in §8.6 green.

## 11. Out of Scope (Future Phases)

- Phase 3 (iOS): same `@pulse/core`, separate Expo + React Native renderer.
- v1.x desktop: dark mode, settings UI for hotkey rebind, EV-code-signing, custom view/filter creation, recurring-task auto-rollover, AI features (e.g., natural-language task summarisation), Mac/Linux builds.
