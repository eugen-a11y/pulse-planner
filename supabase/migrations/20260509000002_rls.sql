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
