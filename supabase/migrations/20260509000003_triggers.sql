-- updated_at on every entity table
-- Only auto-stamp if the caller did NOT explicitly change updated_at.
-- This preserves client timestamps supplied by sync_upsert (LWW).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  if new.updated_at = old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end $$;

create trigger projects_updated_at     before update on public.projects     for each row execute function public.set_updated_at();
create trigger tasks_updated_at        before update on public.tasks        for each row execute function public.set_updated_at();
create trigger tags_updated_at         before update on public.tags         for each row execute function public.set_updated_at();
create trigger attachments_updated_at  before update on public.attachments  for each row execute function public.set_updated_at();
create trigger time_entries_updated_at before update on public.time_entries for each row execute function public.set_updated_at();
create trigger comments_updated_at     before update on public.comments     for each row execute function public.set_updated_at();
create trigger notes_updated_at        before update on public.notes        for each row execute function public.set_updated_at();

-- Subtask depth: parent_task_id must reference a task with NULL parent
create or replace function public.enforce_subtask_depth()
returns trigger language plpgsql as $$
declare
  parent_parent uuid;
begin
  if new.parent_task_id is null then
    return new;
  end if;
  select parent_task_id into parent_parent
    from public.tasks where id = new.parent_task_id;
  if parent_parent is not null then
    raise exception 'subtask depth exceeded: parent task already has a parent';
  end if;
  return new;
end $$;

create trigger tasks_subtask_depth
  before insert or update of parent_task_id on public.tasks
  for each row execute function public.enforce_subtask_depth();
