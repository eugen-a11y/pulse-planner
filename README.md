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
