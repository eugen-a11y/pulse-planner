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
