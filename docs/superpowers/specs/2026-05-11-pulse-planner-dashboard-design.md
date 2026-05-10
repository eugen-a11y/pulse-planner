# Pulse Project Planner — Dashboard + Project Enrichment (Phase 2.1) Design

**Status:** Draft for review
**Date:** 2026-05-11
**Predecessors:**
- `docs/superpowers/specs/2026-05-09-pulse-planner-foundation-design.md` (Phase 1)
- `docs/superpowers/specs/2026-05-09-pulse-planner-desktop-design.md` (Phase 2)

## 1. Overview

Phase 2.1 closes a gap left by Phase 2: the Phase-1 design promised "project progress bars and a dashboard" but the Phase-2 plan never wired one up. The landing view became Today, with no aggregate-overview surface.

This phase delivers:
1. A **Dashboard** view — KPI strip plus a project-list with inline progress bars — and makes it the new landing view (Today moves to a peer sidebar entry).
2. **Project enrichment** — projects gain editable name, color, due date (timestamp), description, and notes, all surfaced in a new project-view header. Color editing is a fixed swatch palette.
3. A **Kanban click/drag fix** — single-click on a card opens the task detail; drag still works after an 8 px movement threshold.

These are additive to existing features. No regressions to Today, Project list/kanban, Quick Add, attachments, or sync are intended.

## 2. Goals

- Pulse opens to a Dashboard showing KPIs and per-project progress.
- The user can rename a project, change its color, set/clear a due date+time, edit a description, and write a long-form note — all from the project view, all syncing to cloud Supabase.
- Single-click on a Kanban card opens the task detail; drag remains available for status changes.
- DB schema gains two new columns on `projects` (`due_date`, `description`) via a forward-only migration applied to local Docker Supabase and to the cloud project `albbdekronmsiqiwnlpp`.
- All existing tests stay green; new behavior gets at least smoke coverage.

## 3. Non-Goals (Phase 2.1)

- No project archiving UI — `archived` column already exists; surfacing it stays v1.x.
- No project sorting UI — `sortOrder` column exists, no drag-to-reorder yet.
- No multi-note support per project — one Markdown notes block per project, same as task notes.
- No KPI customization — the four KPIs are fixed (Open, Today, Overdue, Done this week).
- No charts / time-series. Progress bars only.
- No tag editing / color from this phase — tags keep current behavior.
- iOS (Phase 3) consumes the same `@pulse/core` and the same DB schema, but Phase 3 is out of scope for this spec.

## 4. Data Model Changes

### 4.1 Migration `20260511000001_project_due_and_description.sql`

```sql
alter table public.projects
  add column due_date    timestamptz,
  add column description text;
```

Both nullable. Applied to:
- Local Docker Supabase via `supabase db push` against `supabase/`.
- Cloud project `albbdekronmsiqiwnlpp` via `supabase db push --linked`.

Forward-only. Existing rows get `null` for both. RLS policies on `projects` already cover all columns of the table — no policy changes needed.

### 4.2 Domain type (`packages/core/src/domain/project.ts`)

```ts
export const ProjectSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1).max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  archived: z.boolean(),
  sortOrder: z.number().int(),
  dueDate: z.string().nullable(),         // ISO 8601, nullable
  description: z.string().nullable(),     // free-form, nullable
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});
```

`makeProject` defaults `dueDate: null, description: null`.

### 4.3 Sync

The Phase-1 `sync_upsert` RPC accepts arbitrary fields per-table — no signature change. The outbox `changedFields` payload in `projects.update` IPC must include `dueDate` and `description` when set. `case-mapping-row.ts` handles snake_case conversion automatically.

## 5. Renderer / UI

### 5.1 Sidebar — System Views

Replace today's `[Heute, Diese Woche]` system-view list with `[Dashboard, Heute, Diese Woche]`. Dashboard becomes the default selected entry on first load (`useUi.currentView` initial state changes from `{ kind: "today" }` to `{ kind: "dashboard" }`).

### 5.2 Dashboard View

New component: `apps/desktop/src/renderer/dashboard/DashboardView.tsx`.

Layout (mirrors Option A mockup at `pulse-dashboard-mockups.html`):

```
+--------------------------------------------------------------+
| Dashboard · Sonntag, 11. Mai 2026 · KW 19                    |
+--------------------------------------------------------------+
| [Offen 31] [Heute 4] [Überfällig 2] [Erledigt Woche 7]       |
|                                                              |
| Projekte                                       [+ Neues …]   |
| +--------------------------------------------------------+   |
| | ● Pulse Planner   [#######-] 18/27  67%   heute 14:00 |   |
| | ● Website Redesign [###----]  4/12  33%   morgen 10:00|   |
| | ● Backoffice CRM   [##-----]  3/14  21%   überfällig  |   |
| | ● Hamburg Pulse    [#######]  9/10  90%   morgen 09:00|   |
| +--------------------------------------------------------+   |
+--------------------------------------------------------------+
```

KPIs are derived in the renderer from already-loaded `useTasks` / `useProjects` state — no new IPC.

- **Offen gesamt** = count of non-deleted, non-done tasks across all projects.
- **Heute fällig** = count of non-done tasks whose `dueDate <= end-of-today`.
- **Überfällig** = count of non-done tasks whose `dueDate < start-of-today`.
- **Erledigt · Woche** = count of tasks with `status = "done"` and `completedAt >= start-of-this-ISO-week`.

Per-project progress = `done_tasks / total_tasks`. Bar fills with `--pulse` blue (≥40 %), amber (`#F59E0B`, 1–39 %), or emerald (`#10B981`, ≥85 %). Each row's right column shows the next-due open task (`min(dueDate)` over open tasks of that project), formatted via `DueDateBadge`. Click on a row navigates to the project view (`useUi.setView({ kind: "project", projectId })`).

Empty-state: when no projects exist, show CTA "Erstes Projekt anlegen" that opens the same inline-add input as the sidebar's `+`.

### 5.3 Project View Header

Replace the current minimal header (color dot + name + view-mode toggle) with an editable header block:

```
+----------------------------------------------------------------+
| ● [color swatch, click → palette popover]                      |
| [editable project name, click-to-edit, blur-to-save] ⌄         |
| Fällig: [datetime-local picker] [×]   ▓▓▓▓▓▓░░ 67% · 18/27    |
| Beschreibung: [autosave textarea, max 500 chars]               |
|                                                                |
| [List | Kanban | Notes]   ← view-mode tabs                     |
+----------------------------------------------------------------+
```

- Name: `<input>` styled as text; on blur or Enter → `projects.update({name})`.
- Color swatch: button shows the current color; click → popover with 9 swatches:
  - `#2563EB` (Pulse blue), `#10B981` (emerald), `#F59E0B` (amber), `#EF4444` (red), `#8B5CF6` (violet), `#EC4899` (pink), `#14B8A6` (teal), `#F97316` (orange), `#6B7280` (slate). Click → `projects.update({color})` and close popover.
- Due date: `<input type="datetime-local">`; same parse/serialize pattern as TaskMeta. Clear button removes the date.
- Description: `<textarea>`; debounced 600 ms autosave on change → `projects.update({description})`.
- Progress bar: same logic as DashboardView per-row bar.
- View-mode toggle: existing List/Kanban + new "Notes" tab.

### 5.4 Project Notes Tab

New component: `ProjectNotesView.tsx`. Reuses the existing `notes.listForProject` IPC and renders a single Markdown note (mirrors task `NotePane`). Behavior: load first note for project; if none, on first save, create one.

### 5.5 Kanban Click vs Drag

Current: dnd-kit's default `PointerSensor` activates drag immediately, eating the click handler on the card.

Fix: configure the Kanban DndContext with explicit sensors:

```ts
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
);
```

8 px movement threshold lets a quick tap fire `onClick` (which already exists at `KanbanColumn.tsx:33` calling `useUi.selectTask`); a meaningful drag still grabs and reorders.

## 6. IPC Surface Changes

`PulseApi.projects.update` already takes `Partial<Project>`. With the domain type extended, `dueDate` and `description` flow through automatically. No new handlers, no new channels.

`PulseApi.notes.listForProject` and `notes.create({ projectId, bodyMd })` already exist. No additions.

## 7. Migration Procedure

1. Write `supabase/migrations/20260511000001_project_due_and_description.sql`.
2. Apply locally: `supabase db push` (against the local Docker stack).
3. Apply to cloud: with `SUPABASE_ACCESS_TOKEN` set, `supabase db push --linked`.
4. Update `packages/core/src/domain/project.ts` (schema + `makeProject`).
5. Rebuild + repackage Pulse desktop, file-copy over the install dir per `cloud_supabase.md` snippet.

Existing local SQLite stores: the desktop's `001_init.sql` migration creates the `projects` table without these columns. New columns must also be added to `apps/desktop/src/main/store/migrations/001_init.sql`. Strategy: bump to `002_project_due_and_description.sql` and `db.exec(migrationSql)` runs both at startup (idempotent — `add column if not exists`).

## 8. Tests

- Unit: `packages/core` — `makeProject` returns null defaults for new fields; `ProjectSchema.parse` accepts and rejects values appropriately.
- Unit: `apps/desktop` — Dashboard KPI computations on mock task/project state, edge cases (no projects, no tasks, all done).
- Integration: SQLite local-store reads/writes new columns through the case-mapping layer.
- E2E (manual smoke against installed Pulse on cloud Supabase):
  1. Open Pulse → lands on Dashboard.
  2. KPIs and project progress bars match a project with a known task split.
  3. Click on project row → Project View opens.
  4. Rename project → reload → name persists. Verify in Supabase Studio.
  5. Pick a color from swatch palette → row dot updates everywhere.
  6. Set a due date+time → DueDateBadge shows date+time → clear → cleared.
  7. Type description → close+reopen → description persists.
  8. Add notes → cloud row in `notes` table with `project_id` set.
  9. Switch to Kanban tab → single-click on card opens task detail. Drag a card across columns → status changes + syncs.

## 9. Acceptance Criteria

- [ ] Pulse desktop on first launch (after sign-in) shows the Dashboard.
- [ ] All four KPIs render and update when tasks change.
- [ ] Each project row has a progress bar that reflects done/total ratio.
- [ ] Project view header allows rename, color change, due-date set/clear, description edit, all persisted to cloud.
- [ ] Project notes tab in project view reads + writes via existing `notes.*` IPC.
- [ ] Kanban: tap = open detail; drag (>8 px) = move between columns.
- [ ] No regression to Today, Quick Add, Attachments, Sync, Tray, Notifications, Hotkey.
- [ ] Migration applied to both local and cloud Supabase; both `pnpm --filter @pulse/desktop test` and a full Pulse boot pass.

## 10. Open Questions

None — all design decisions taken in the 2026-05-11 brainstorming round.

## 11. Out of Scope (future work)

- v1.x desktop: project archiving UI, project drag-to-reorder, project recurrence, custom KPI selection, dashboard time-series chart, Markdown rendering preview for descriptions.
- Phase 3 (iOS): same data model, same `@pulse/core`, separate Expo renderer.
