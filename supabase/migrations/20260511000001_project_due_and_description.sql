-- Phase 2.1: project enrichment fields
-- Add due_date (timestamptz) and description (text) to projects, both nullable.
-- RLS policies on public.projects already cover all columns of the row, no policy update needed.

alter table public.projects
  add column if not exists due_date    timestamptz,
  add column if not exists description text;
