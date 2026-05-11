# Pulse Project Planner — Phase 2.2 (Daily-Use Polish) Design

**Status:** Draft for review
**Date:** 2026-05-11
**Predecessors:** 2.1 (`docs/superpowers/specs/2026-05-11-pulse-planner-dashboard-design.md`)

## 1. Overview

Six small-to-medium daily-use features that close gaps where backend
infrastructure exists but UX doesn't, plus two new capabilities (search,
markdown rendering).

1. Recurring tasks (RRULE preset UI + auto-next on complete)
2. Tags on tasks (chip picker + tag-filter view)
3. Move task between Inbox ↔ project (project picker in TaskMeta)
4. Global search (Ctrl+K command-palette)
5. Markdown rendering for descriptions + notes (display only)
6. Archive projects (hide from sidebar, reachable via collapsed section)

No DB migrations: all required columns exist (`recurrence_rule`,
`recurrence_parent_id`, `archived`, `task_tags` join table).

## 2. Goals

- Each of the six features works against cloud Supabase + offline.
- No regression to Today / Dashboard / Project / Inbox / Quick-Add /
  attachments / sync / hotkey / tray.
- Existing `pnpm --filter @pulse/desktop test` stays green.

## 3. Non-Goals

- No bulk-edit (multi-select).
- No drag-to-reorder.
- No statistics / charts.
- No timer-start button on task rows (skipped per user pick).
- No data export.
- No keyboard shortcuts beyond Ctrl+K + the existing Ctrl+Shift+Space.
- No Markdown live-edit toggle — descriptions/notes use plain `<textarea>`
  for editing and rendered Markdown for display.

## 4. Feature Designs

### 4.1 Recurring Tasks

**UI** — `RecurrenceField` in TaskMeta, below "Fällig":

- Dropdown with presets:
  `Aus · Täglich · Werktags · Wöchentlich (Wochentag-Picker) · Alle 2 Wochen
   · Monatlich (Tag x) · Jährlich · Custom RRULE`
- Selecting a preset writes a normalized RRULE string to
  `task.recurrenceRule` (e.g. `FREQ=WEEKLY;BYDAY=MO,WE` for "wöchentlich
  Mo+Mi"). "Aus" sets to `null`.
- Custom: shows a text input for raw RRULE; validated client-side via the
  `rrule` package (already in `@pulse/core`).

**Auto-next on complete** — in `tasks.complete` IPC handler:

```ts
if (task.recurrenceRule && task.dueDate) {
  const rule = RRule.fromString(`RRULE:${task.recurrenceRule}`);
  const next = rule.after(new Date(task.dueDate), false);
  if (next) {
    const child = makeTask({
      ...sameMetadataAsParent,
      dueDate: next.toISOString(),
      recurrenceParentId: task.recurrenceParentId ?? task.id,
    });
    await deps.store.upsert("tasks", child);
    await deps.outbox.enqueue({ ... insert ... });
  }
}
```

The completed task stays done; a fresh open task with the next due date
is created. `recurrenceParentId` chains them so we never lose the lineage.
Tags from the parent are NOT automatically copied (deferred — would need
extra IPC roundtrip; can revisit if it bites).

### 4.2 Tags on Tasks + Tag-Filter View

**Chip picker on TaskMeta** — new "Tags"-Row:
- Renders the task's current tags as colored chips with `×` to detach.
- "+" button opens a popover listing all available tags (from
  `useTags`) plus an inline "neu erstellen…" input.
- Click a tag → `tags.attach(taskId, tagId)`. Already-attached tags are
  visually disabled.

**`tasks.tagsForTask(taskId)` IPC + `useTaskTags` store** — needed because
right now there's no way to read which tags belong to a task. New IPC
returns `tagId[]`; renderer keeps a `Map<taskId, Set<tagId>>` cache,
invalidated on `tags.changed` event.

**TagList sidebar wiring** — clicking a tag now sets
`useUi.currentView = { kind: "tag", tagId }`. AppShell ViewSlot routes
to a new `TagFilterView` that lists all open + done tasks with the tag,
across projects, with a project chip per row.

### 4.3 Move task between Inbox ↔ project

**TaskMeta Project Row** — new row at the top of TaskMeta:
- Shows current project as ProjectChip (or "Inbox" pill).
- Click → popover with searchable list of all projects + an "Inbox"
  entry at the top. Select → `tasks.update(id, { projectId: null | id })`.
- Existing `tasks.update` IPC already takes `Partial<Task>`; just plumb.

### 4.4 Global Search (Ctrl+K)

**Command palette modal** — new component `SearchPalette.tsx`:
- Opened via Ctrl+K (renderer-level `useEffect` keydown listener) or via
  a search icon in the sidebar header.
- In-memory search across already-loaded state (`useTasks.byId`,
  `useProjects.byId`, currently-open project notes — fetched lazily on
  first open via existing IPC).
- Match on title / name / body substring (case-insensitive). Sort by
  best match (startsWith > contains > fuzzy).
- Result row: icon (task/project/note), label, context (e.g. "Pulse
  Planner · überfällig"). Click → navigate via `useUi.setView` +
  `useUi.selectTask` as appropriate. Esc closes.

No new IPC. Pure renderer work + keyboard hook.

### 4.5 Markdown rendering

**Display-only** for these surfaces:
- Task description (in TaskBody)
- Project description (in ProjectView header)
- Project notes (in ProjectNotesView)
- Task notes (in NotePane)
- Comments (CommentList)

**Lib** — `marked` (~30 KB gzipped) chosen over `remark`/`react-markdown`
for size + zero React deps. Output is HTML; pipe through DOMPurify (~6 KB
gzipped) before rendering with `dangerouslySetInnerHTML` to be safe with
arbitrary user input.

**Edit mode** — when the field is focused / a "Bearbeiten" button is
clicked, swap to plain `<textarea>` (no live preview, no toolbar). On
blur, swap back to rendered HTML. This keeps the editor lightweight and
matches Pulse's minimalism.

### 4.6 Archive projects

**Project header** — "Archivieren"-Button (icon + tooltip) in the project
view header overflow area (next to the color swatch / due-date row).
Calls `projects.update(id, { archived: true })`.

**Sidebar** — `ProjectList` filters out `archived === true` from the
main list. Below the regular list, a collapsed "Archiv (n)" toggle that
expands to show archived projects (greyed out). Clicking an archived
project still opens its view; from there an "Wiederherstellen"-Button
sets `archived = false`.

**Dashboard** — archived projects do NOT appear in the project-list. KPIs
exclude their tasks (treat archived = soft-hidden for metrics purposes).

## 5. Renderer / IPC Changes Summary

| File | Change |
|---|---|
| `packages/core/src/domain/task.ts` | (no change — `recurrenceRule` already nullable string) |
| `apps/desktop/src/main/ipc.ts` | `tasks.complete` adds auto-next-instance logic; new `tasks.tagsForTask` handler |
| `apps/desktop/src/main/ipc-types.ts` | + `tasks.tagsForTask` |
| `apps/desktop/src/preload.ts` | + `tasks.tagsForTask` |
| `apps/desktop/src/renderer/detail/TaskMeta.tsx` | + Project row, Recurrence row, Tags row |
| `apps/desktop/src/renderer/components/RecurrenceField.tsx` | new |
| `apps/desktop/src/renderer/components/TagPicker.tsx` | new |
| `apps/desktop/src/renderer/components/ProjectPicker.tsx` | new |
| `apps/desktop/src/renderer/components/Markdown.tsx` | new (marked + DOMPurify) |
| `apps/desktop/src/renderer/detail/TaskBody.tsx` | switch description display to `<Markdown />` |
| `apps/desktop/src/renderer/project/ProjectView.tsx` | description renders as Markdown when not editing; add Archive button |
| `apps/desktop/src/renderer/project/ProjectNotesView.tsx` | rendered Markdown when not editing |
| `apps/desktop/src/renderer/detail/NotePane.tsx` | same |
| `apps/desktop/src/renderer/detail/CommentList.tsx` | render comment bodies as Markdown |
| `apps/desktop/src/renderer/shell/Sidebar.tsx` | Search-Icon trigger; archived-projects collapsible |
| `apps/desktop/src/renderer/shell/ProjectList.tsx` | filter archived; Archiv toggle |
| `apps/desktop/src/renderer/shell/TagList.tsx` | wire click → setView({kind:"tag"}) |
| `apps/desktop/src/renderer/tag/TagFilterView.tsx` | new |
| `apps/desktop/src/renderer/search/SearchPalette.tsx` | new |
| `apps/desktop/src/renderer/shell/AppShell.tsx` | mount SearchPalette + ViewSlot routes "tag" → TagFilterView |
| `apps/desktop/src/renderer/stores/tags.ts` | + `attach/detach` actions, `taskTags` Map |

New runtime deps: `marked`, `dompurify`, `@types/dompurify`.

## 6. Tests

- Unit: `tasks.complete` recurrence path produces a child task with the
  next-occurrence due date and `recurrenceParentId` set.
- Unit: search ranking returns startsWith above contains.
- Manual smoke: each of the six features in the running cloud-connected
  app, walk-through documented in the next plan.

## 7. Acceptance

- [ ] Recurring task: set "Wöchentlich Mo", complete it, see the next
      Monday's instance auto-appear in Today.
- [ ] Add 2 tags to a task → tag chips visible in TaskMeta + TaskRowItem
      → click a tag in sidebar → see only tasks with that tag.
- [ ] Inbox task → open detail → pick a project → vanishes from Inbox,
      appears in project.
- [ ] Ctrl+K → type "stand" → "Standup vorbereiten" appears → Enter →
      task selected.
- [ ] Description with `**fett** und [link](https://...)` renders
      formatted; click on textarea switches to edit.
- [ ] Project archive → vanishes from sidebar list, appears under "Archiv
      (1)" → restore → reappears in main list.
