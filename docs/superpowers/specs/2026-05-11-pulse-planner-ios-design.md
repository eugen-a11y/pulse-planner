# Pulse Project Planner — Phase 3 (iOS App) Design

**Status:** Draft for review
**Date:** 2026-05-11
**Predecessors:**
- Phase 1 (`docs/superpowers/specs/2026-05-09-pulse-planner-foundation-design.md`)
- Phase 2 (`docs/superpowers/specs/2026-05-09-pulse-planner-desktop-design.md`)
- Phase 2.1 (`docs/superpowers/specs/2026-05-11-pulse-planner-dashboard-design.md`)
- Phase 2.2 (`docs/superpowers/specs/2026-05-11-pulse-planner-2.2-design.md`)

## 1. Overview

Phase 3 delivers the iOS companion to the existing Windows desktop client,
sharing the `@pulse/core` package 1:1. The mobile app is an Expo Managed
React Native build distributed via TestFlight using EAS Build (no Mac
required for Eugen). The feature set is intentionally lean for v1, focused
on consuming and lightly editing the same data set that the desktop client
maintains, with local notifications and a Today widget for quick access.

The mobile client reuses every piece of business logic from `@pulse/core`:
Domain types, Zod, SyncEngine (push/pull/realtime), AuthService, Outbox,
MergeEngine (per-field LWW), SyncStateRepo. Only the **platform adapters**
are new — SQLite store, secure token storage, notification bridge, widget
data writer, background fetch task.

## 2. Goals

- Native iOS app distributed via TestFlight, installable on Eugen's iPhone.
- Feature parity for daily use against the desktop: read, create, edit,
  complete, snooze, tag, recurrence, search, Inbox/Project switching,
  archive view.
- Local notifications for due tasks with snooze + done banner actions.
- Today widget (Small + Medium) showing the next 3–5 due tasks.
- Optional Face ID unlock on the login screen.
- Cross-machine sync continues to work (desktop ↔ mobile via Supabase
  cloud, identical LWW behavior).
- Existing 69 `@pulse/core` Phase-1 tests stay green; new mobile-side
  Jest suite covers the new adapters.

## 3. Non-Goals

- No Apple Reminders two-way bridge (deferred to v1.x).
- No Apple Watch companion app.
- No Kanban board view on mobile.
- No time-tracker on mobile.
- No iCloud Drive / Files-app integration for attachments.
- No social login (matches Phase 2: email/password only).
- No public App Store release in Phase 3 (TestFlight only).
- No Sentry / Crashlytics in v1 (manual log export instead).
- No Detox or other automated E2E tests in v1 (manual TestFlight checklist).
- No Expo Web build.
- No silent-push (APNs) sync — Phase 3 uses pull-on-foreground +
  background-fetch.

## 4. Tech Stack

| Concern | Choice |
|---|---|
| Framework | Expo SDK 52 Managed Workflow |
| Build / Distribution | EAS Build → TestFlight (App Store Connect) |
| Language | TypeScript |
| UI runtime | React Native |
| Navigation | Expo Router (file-based, Tabs + Stack) |
| State | Zustand (matches desktop) |
| Styling | NativeWind (Tailwind for RN), Pulse theme `#2563EB` |
| Local DB | `expo-sqlite` (new `ExpoSqliteStore` impl of `LocalStore`) |
| Secure tokens | `expo-secure-store` (new `SecureStoreTokenStorage` impl) |
| Notifications | `expo-notifications` (local only, no APNs server) |
| Biometric | `expo-local-authentication` (Face ID / Touch ID) |
| Widget | `@bacons/apple-targets` (config plugin for SwiftUI extensions) |
| Background sync | `expo-background-fetch` (~30 min iOS-managed cadence) |
| Prefs | `react-native-mmkv` (rememberMe, faceIdEnabled, last-sync) |
| Markdown | `react-native-markdown-display` |
| Recurrence | `rrule` (already a `@pulse/core` dep) |

**Reused from `@pulse/core`:** Domain types, Zod schemas, SyncEngine,
AuthService, Outbox, MergeEngine, SyncStateRepo, case-mapping, conflict
helpers, RRULE helpers.

## 5. Architecture

### 5.1 Monorepo placement

```
apps/
  desktop/       ← Phase 2 (unchanged)
  mobile/        ← NEW (Expo Managed)
    app/                 ← Expo Router file-tree
      (tabs)/
        today.tsx
        upcoming.tsx
        inbox.tsx
        projects.tsx
        settings.tsx
      project/[id].tsx
      task/[id].tsx
      tags/index.tsx
      search.tsx
      auth/
        login.tsx
        signup.tsx
    src/
      wiring/deps.ts            ← DI container, builds @pulse/core services
      platform/
        ExpoSqliteStore.ts      ← LocalStore impl
        SecureStoreTokenStorage.ts ← TokenStorage impl
        ExpoNotifications.ts    ← schedule + categories
        WidgetData.ts           ← snapshot writer
        BackgroundFetch.ts      ← registers iOS task
      stores/                   ← Zustand stores
      screens/                  ← screen-level components
      components/               ← shared UI atoms
      lib/                      ← parsers, date helpers
    targets/
      TodayWidget/              ← SwiftUI widget extension
    app.config.ts               ← Expo plugins + apple-targets config
    eas.json                    ← EAS Build profiles
packages/
  core/          ← @pulse/core, 1:1 reused (no breaking changes)
```

### 5.2 Layers

| Layer | Responsibility | Files |
|---|---|---|
| Platform | iOS-specific bridges | `src/platform/*` |
| Core wiring | DI container assembling `@pulse/core` | `src/wiring/deps.ts` |
| State | Zustand stores | `src/stores/{auth,tasks,projects,tags,sync}.ts` |
| Navigation | Expo Router | `app/**` |
| UI | RN + NativeWind | `src/screens`, `src/components` |
| Lib | Parsers, helpers | `src/lib/*` |

UI reads **only** from Zustand stores, never directly from SQLite. Writes
go through Zustand → `@pulse/core` service → optimistic SQLite update +
Outbox enqueue.

### 5.3 Boot sequence

1. `app/_layout.tsx` renders `<Splash />` while `deps.ts` resolves.
2. `deps.ts`:
   - Open SQLite, run migrations (DDL strings shared via `@pulse/core/sql`).
   - Construct `ExpoSqliteStore`, `SecureStoreTokenStorage`, Supabase
     client, `AuthService`, `SyncEngine`, `Outbox`.
   - Wire `WS` polyfill (RN already ships WebSocket — no extra dep needed).
3. `AuthService.restoreSession()`:
   - Tokens missing → render Login (Face-ID shortcut if enabled).
   - Tokens present → `engine.pull()` → `subscribeRealtime()` → hydrate
     stores via `store.refreshAll()` → mount Tabs.
4. Register `AppState` listener and `BackgroundFetch` task.

### 5.4 Sync lifecycle

| Trigger | Action |
|---|---|
| App start with valid token | `engine.pull()` → realtime subscribe |
| `AppState` → `active` | `engine.pull()` + ensure realtime subscribed |
| `AppState` → `background` | unsubscribe realtime; Outbox-timer pauses |
| `BackgroundFetch` tick (~30 min) | short `engine.pull()` (≤ 25s), no subscribe |
| Pull-to-refresh | manual `engine.pull()` |
| `SyncStatusPill` tap | manual `engine.pull()` |
| Outbox has pending | auto-drain via `@pulse/core` Outbox timer |

## 6. UI / Screens

### 6.1 Tab bar (5 tabs)

| Tab | Screen | Content |
|---|---|---|
| Today | `today.tsx` | Overdue + due-today, grouped; quick-add `+` in header |
| Upcoming | `upcoming.tsx` | Next 7 days grouped by date |
| Inbox | `inbox.tsx` | Tasks with `projectId === null` |
| Projects | `projects.tsx` | Active projects with progress bar; collapsed Archive section; tap → push detail |
| Settings | `settings.tsx` | Account, sync status, Face-ID toggle, logout, version, debug-log export |

### 6.2 Stack screens (above tabs)

| Route | Purpose |
|---|---|
| `project/[id].tsx` | Project header (inline-edit name, color swatch, due picker, description), sub-tabs Tasks / Notizen |
| `task/[id].tsx` | Title, Markdown description, due, recurrence, tags, comments, subtasks |
| `tags/index.tsx` | Cross-project tag filter view |
| `search.tsx` | Global search (icon in tab headers) |
| `auth/login.tsx` | Email + password; Face-ID unlock if previously enabled |
| `auth/signup.tsx` | Registration |

### 6.3 Shared components

- `<TaskRow>` — checkbox, title, due pill, tag dots. Swipe-left → Done.
  Long-press → action sheet (Move, Duplicate, Delete).
- `<ProjectRow>` — color dot, name, progress bar.
- `<TagPicker>` — bottom-sheet with inline-create + color palette.
- `<ColorSwatchPopover>` — 9-color picker matching desktop palette.
- `<DueDatePicker>` — native iOS DateTimePicker wheel.
- `<RRulePicker>` — preset dropdown + Custom… modal (freq, interval, byDay).
- `<MarkdownView>` — `react-native-markdown-display`; link tap →
  `Linking.openURL`.
- `<QuickAddSheet>` — bottom-sheet text input with live token preview
  (date, project, tags).
- `<SyncStatusPill>` — header pill: idle / syncing / error; tap → refresh.
- `<EmptyState>` — Pulse logo + tab-specific copy.

### 6.4 Gestures

- Swipe-left on `<TaskRow>` → Complete (single swipe action only; delete
  via long-press action sheet).
- Long-press on `<TaskRow>` → ActionSheet (Move, Duplicate, Delete).
- Pull-to-refresh on every tab → `engine.pull()`.
- Tap `<SyncStatusPill>` on error → toast with last sync error.

## 7. Data Flow

### 7.1 Read path

```
ExpoSqliteStore (SQLite) → @pulse/core stores → Zustand → React components
```

- Initial hydration: after `engine.pull()`, `deps.ts` calls
  `store.refreshAll()` once.
- Realtime: `subscribeRealtime()` applies changes to SQLite → 500ms
  debounced `store.refreshAll()` (mirrors desktop pattern from commit
  `82b9f8f`).

### 7.2 Write path

```
UI → Zustand method → @pulse/core service.upsert()
   → SQLite (optimistic) + Outbox enqueue
   → Outbox drain → Supabase sync_upsert RPC
   → server response → SQLite merge (per-field LWW)
```

`MergeEngine` from `@pulse/core` handles conflicts identically to desktop;
no mobile-side merge logic.

### 7.3 Persistence

- **SQLite (`expo-sqlite`)** — all domain tables 1:1 with desktop; DDL
  strings shared via `@pulse/core/sql` export (small refactor in
  `@pulse/core` to expose them; today they live inside
  `BetterSqliteStore`).
- **SecureStore (`expo-secure-store`)** — `accessToken`, `refreshToken`,
  `userId`, `userEmail`. Encrypted; biometric-bound optional.
- **MMKV (`react-native-mmkv`)** — `rememberMe`, `faceIdEnabled`,
  `lastSyncAt`, `widgetLastUpdated`, `notificationsPermission`,
  `pendingNotificationActions`.

### 7.4 Widget data channel

App-Group `group.me.reinfeld.pulse` shared between app and widget
extension. After each successful `engine.pull()` and after
`tasks.markDone()`, the app writes `today_snapshot.json` (top 5 due tasks
sorted ascending by `dueDate`) to the App-Group container, then calls
`WidgetCenter.reloadAllTimelines()`.

## 8. Notifications

### 8.1 Permissions

- First task with `dueDate` triggers `requestPermissionsAsync()`.
- Status cached in MMKV; app does not re-prompt if denied.
- Denied → Settings tab shows "Erinnerungen sind deaktiviert · Tippen um
  zu öffnen" → `Linking.openSettings()`.

### 8.2 Categories (banner actions)

| Category | Actions |
|---|---|
| `TASK_DUE` | "Erledigt", "Snooze 1h", "Snooze bis morgen" (all `foreground=false`) |

Action handlers in `src/platform/ExpoNotifications.ts`:
- `DONE` → `tasksStore.markDone(taskId)` → Outbox push.
- `SNOOZE_1H` → cancel existing, schedule new notification +1h.
- `SNOOZE_TOMORROW` → cancel existing, schedule new at tomorrow 09:00.

If app is suspended at action time and token has expired, the action is
queued in MMKV `pendingNotificationActions` and replayed after the next
foreground refresh + token-refresh succeeds.

### 8.3 Scheduling

- On `task.upsert()` with `dueDate` →
  `scheduleNotificationAsync({ identifier: task.id, trigger: { date }, category: 'TASK_DUE' })`.
- On `dueDate` change → cancel + reschedule (identifier-keyed → idempotent).
- On `delete` / `markDone` → `cancelScheduledNotificationAsync(task.id)`.
- For recurring tasks: only the **next** instance is scheduled. When the
  current instance completes, `@pulse/core` spawns the next instance,
  whose upsert triggers a new schedule.

### 8.4 Reconciler

- iOS hard-caps scheduled notifications at 64. The reconciler runs on
  `AppState=active` and after each pull:
  - Compute next-60 future tasks sorted by `dueDate`.
  - Diff vs. current scheduled set; cancel obsolete, schedule missing.
  - Skip tasks with `dueDate < now`.
- Time-zone drift: stored as UTC; rescheduled relative to device-local
  time on every foreground.

### 8.5 Settings toggle

- "Erinnerungen aktivieren" master switch. Off →
  `cancelAllScheduledNotificationsAsync()` + reconciler short-circuits.
- Default: off until first task with dueDate is created and permission is
  granted.

## 9. Today Widget

### 9.1 Native target

`apps/mobile/targets/TodayWidget/` (SwiftUI), built via
`@bacons/apple-targets` config plugin. App-Group id
`group.me.reinfeld.pulse`. Bundle id `me.reinfeld.pulse.TodayWidget`.

Files:
- `TodayWidget.swift` — SwiftUI view, Small (2×2) + Medium (4×2) families.
- `Provider.swift` — TimelineProvider reads `today_snapshot.json`.
- `TodayWidgetBundle.swift` — entry point.

### 9.2 Data refresh

- App writes snapshot after: successful pull, `markDone`,
  `task.upsert` with `dueDate === today`, background-fetch success.
- Widget's own timeline policy is `after(now + 30 min)` as a fallback.

### 9.3 Sizes

- **Small (2×2)** — up to 3 tasks: title + due pill.
- **Medium (4×2)** — up to 5 tasks: title + due pill + project color dot.

### 9.4 Deep linking

- Tap on a task in widget → `pulse://task/<id>` → Expo Router opens task
  detail.
- Tap on widget header → `pulse://today`.

### 9.5 Fallback (risk)

If `@bacons/apple-targets` cannot build under EAS or the maintainer
pauses, the widget target is removed and shipped in v1.1. App
functionality is unaffected.

## 10. Authentication & Biometric

- Login screen: email + password, "Angemeldet bleiben" checkbox (same UX
  as desktop). On success, tokens go to SecureStore; if biometric is
  available, a second toggle "Mit Face ID entsperren" appears in Settings.
- When Face-ID is enabled, a subsequent app launch with a stored refresh
  token shows a Face-ID quick-unlock button on the login screen. Unlock
  triggers `AuthService.refreshSession()`.
- Logout: `cancelAllScheduledNotificationsAsync()` + clear SecureStore +
  clear local SQLite (?) — **decision deferred until plan phase**: keep
  local DB cached for fast re-login vs. wipe for safety. Default in spec:
  **keep** (matches desktop behavior).

## 11. Error Handling

| Error source | Detection | UI | Recovery |
|---|---|---|---|
| Pull network failure | `engine.pull()` throws | SyncStatusPill red; toast "Keine Verbindung" | Exponential backoff (5s/15s/45s, ≤ 5×) |
| Outbox push 5xx/network | drain throws | SyncStatusPill red | `@pulse/core` Outbox retry policy |
| Outbox push 4xx | RPC validation error | Toast + entry moves to DLQ | Settings → "Fehlgeschlagene Sync-Items" lists DLQ; user retries / deletes |
| 401 from RPC / realtime auth | Response code | Navigate to Login; toast "Sitzung abgelaufen" | `AuthService.refreshSession()` via refresh token; on fail clear SecureStore |
| Realtime disconnect | channel `CLOSED` | SyncStatusPill yellow | Auto-resubscribe with backoff; foreground pull covers gap |
| Background-fetch timeout | iOS kills task | none (background) | Log; next foreground pull recovers |
| SQLite corruption | exception in adapter | Fatal-error screen with "Daten zurücksetzen" button | Wipe SQLite + SecureStore, return to Login |
| Notification permission denied | `requestPermissionsAsync` | Settings tab tile | `Linking.openSettings()` |
| Action without token | handler called offline / token expired | (none) | Queue in MMKV; replay after foreground+refresh |

### 11.1 Debug log

- `react-native-logs` with rolling 3-day file transport in
  `FileSystem.documentDirectory + 'logs/'`.
- Settings → "Debug-Log exportieren" → `Sharing.shareAsync(latest)`.
- Helper `redact()` strips tokens and passwords before log emit.

### 11.2 Crash recovery

`deps.ts` wraps boot-critical init in try/catch and renders an
Error-screen with "Logs senden" and "App-Daten zurücksetzen" buttons
instead of a white screen of death.

## 12. Testing

| Layer | Tooling | Scope |
|---|---|---|
| Unit | Jest + `jest-expo` | `ExpoSqliteStore`, `SecureStoreTokenStorage`, `WidgetData`, notification reconciler, quick-add parser |
| Integration | Jest + `@pulse/core` in-memory | DI container smoke test, `engine.pull()` with mock Supabase, Outbox drain with mocked RPC |
| Component | `@testing-library/react-native` | Today, Inbox, Project-Detail, Auth — render + interactions |
| E2E (manual) | TestFlight checklist | Smoke path on Eugen's iPhone |

**Out of scope for v1:**
- Detox.
- Widget extension unit tests.
- Background-fetch automated test.
- Push-notification delivery automated test (manual `due_date = now+1min`
  trial instead).

**`@pulse/core` Bestandsschutz:** the 69 Phase-1 tests must remain green
after the SQL-string export refactor. Any new behavior added to
`@pulse/core` for mobile requires accompanying unit tests in `@pulse/core`.

### 12.1 TestFlight manual checklist

```
□ Fresh install: Login mit Test-Account funktioniert
□ Bestehender Install: App startet ohne Re-Login
□ Face-ID-Toggle aktivieren → Restart → Face-ID-Prompt
□ Pull-to-refresh in jedem Tab triggert SyncStatusPill
□ Task anlegen → erscheint in Desktop nach <5s (Realtime)
□ Task in Desktop ändern → erscheint in Mobile nach <5s
□ Airplane an → Task anlegen → Airplane aus → Task syncs out
□ Quick-Add zeigt Token-Preview (Datum/Projekt/Tags)
□ Notification feuert bei Due-Date (+1min-Test)
□ Notification-Action „Erledigt" → Task done in DB
□ Snooze-Action verschiebt Notification korrekt
□ Today-Widget zeigt heutige Tasks, Tap öffnet App
□ Widget aktualisiert sich nach Task-Done in der App
□ App-Background >30min → Foreground triggert Pull
□ Logout löscht Token, App fordert Re-Login
```

## 13. Build & Release

- **EAS Build profiles** (`eas.json`):
  - `development` — dev-client with Metro, internal distribution.
  - `preview` — release-mode internal build for ad-hoc testing.
  - `production` — App-Store-signed for TestFlight.
- **Submission:** `eas submit -p ios --profile production` → App Store
  Connect → TestFlight.
- **Apple Developer Program:** $99/year, paid + active before first
  TestFlight upload.
- **App identifiers:** Bundle id `me.reinfeld.pulse`, widget bundle
  `me.reinfeld.pulse.TodayWidget`, App Group `group.me.reinfeld.pulse`.
- **Versioning:** `expo.version` in `app.config.ts`, build number
  auto-incremented via `expo-build-properties`.
- **Cost note:** EAS free tier allows ~30 builds/month; Pulse stays well
  inside.

## 14. Risks & Mitigations

1. **`@bacons/apple-targets` is community-maintained.** If broken at
   build time → drop widget target, ship v1 without widget; widget moves
   to v1.1. App still ships.
2. **iOS background-fetch is heuristic.** Documented as best-effort; the
   product does not rely on it for correctness. Foreground pull is the
   contract.
3. **64-notification cap.** Reconciler keeps only the next 60 scheduled;
   slips beyond that are picked up on subsequent foreground/pull cycles.
4. **`@pulse/core` SQL-string export refactor.** Adds public surface; if
   schema diverges later between desktop and mobile, the export becomes
   `getSqlForPlatform()`. v1 keeps a single shared DDL.
5. **EAS Build minutes during iteration.** Mitigate by using `development`
   profile + dev-client locally; only spend `production` builds for
   TestFlight uploads.
6. **No Mac for local debugging of SwiftUI widget.** Iterations on widget
   require an EAS build per change. Mitigation: keep the widget minimal
   for v1 and run as much as possible from the JSON snapshot rather than
   widget-side logic.

## 15. Open Questions (resolve in plan)

1. Logout behavior: wipe local SQLite or keep cached? Spec default: keep.
2. Quick-Add parser location: leave duplicated in `apps/desktop` and
   `apps/mobile`, or hoist to `@pulse/core`? Spec default: hoist (one-time
   move).
3. Where to host the EAS project (`expo.dev/@<user>/pulse`)? Eugen's
   Expo handle TBD.
4. Apple Developer Team-ID + signing certificate provisioning — first-run
   only, manual in App Store Connect.

## 16. Phase-2 Cross-Reference (what mobile must match)

| Phase-2 capability | Mobile parity (v1) |
|---|---|
| Cloud Supabase auth + sync | yes |
| Per-field LWW conflict merge | yes (via `@pulse/core`) |
| Inbox view | yes |
| Project archive | yes (collapsed section in Projects tab) |
| Tags + tag-filter view | yes |
| Recurrence (RRULE + auto-next) | yes (same logic) |
| Quick-Add with parser | yes (RN bottom-sheet) |
| Global search (Ctrl+K) | yes (header search icon) |
| Markdown display | yes (`react-native-markdown-display`) |
| Notifications | yes (local) |
| Kanban board | **no** |
| Time tracker | **no** |
| Tray + global hotkey | **n/a** (iOS has no equivalent) |
| Attachments (Supabase Storage) | **deferred** to v1.1 |
| Dashboard (KPI strip + projects) | **deferred** to v1.1 |

## 17. Definition of Done for Phase 3

- `apps/mobile` builds via EAS `production` profile and uploads to
  TestFlight.
- App installs on Eugen's iPhone, logs in against cloud Supabase, syncs
  with the desktop client both directions in under 5 seconds.
- All 14 items of the TestFlight manual checklist (§12.1) pass.
- Jest unit + integration suite green via
  `pnpm --filter @pulse/mobile test`.
- `@pulse/core` Phase-1 tests still green via
  `pnpm --filter @pulse/core test`.
- Risks (§14) acknowledged in `phase3` project memory.
