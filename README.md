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
pnpm -r test                             # 69 core tests + 27 desktop tests
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
- **Build-time native compile of `better-sqlite3`** runs via `electron-builder install-app-deps` postinstall. If your environment lacks Visual Studio C++ toolchain, prebuilds for the resolved Electron version are fetched automatically; otherwise install Windows Build Tools.
- **Installer builds without PE-resource branding** unless Windows Developer Mode is enabled (or build is run as Administrator) — see `signAndEditExecutable: false` in `electron-builder.yml`.
