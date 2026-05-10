-- Phase 2.x: enable Inbox view (tasks without project assignment).
-- Make tasks.project_id nullable. Existing rows are unaffected (all currently NOT NULL).
-- The FK to public.projects with ON DELETE CASCADE remains: a task with NULL project_id
-- simply has no FK row — fine.

alter table public.tasks alter column project_id drop not null;
