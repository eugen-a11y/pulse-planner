-- Pulse Project Planner — Phase 1 schema
-- All entity tables share: id (uuid), user_id (uuid), created_at,
-- updated_at, deleted_at (soft delete for sync).

create extension if not exists "uuid-ossp";

create table public.projects (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  color text not null default '#2563eb' check (color ~ '^#[0-9a-fA-F]{6}$'),
  archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.tasks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_task_id uuid references public.tasks(id) on delete cascade,
  title text not null check (length(title) between 1 and 500),
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  priority integer not null default 3 check (priority between 1 and 4),
  due_date timestamptz,
  completed_at timestamptz,
  sort_order integer not null default 0,
  recurrence_rule text,
  recurrence_parent_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.tags (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 64),
  color text not null default '#71717a' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, name)
);

create table public.task_tags (
  task_id uuid not null references public.tasks(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, tag_id)
);

create table public.attachments (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  mime text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.time_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.comments (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  body_md text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.notes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  body_md text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((project_id is null) <> (task_id is null))
);

create table public.activity_log (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('created','updated','deleted','status_changed')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Indexes (sync-critical)
create index projects_user_updated on public.projects (user_id, updated_at);
create index tasks_user_project    on public.tasks    (user_id, project_id) where deleted_at is null;
create index tasks_user_due        on public.tasks    (user_id, due_date)   where deleted_at is null;
create index tasks_user_updated    on public.tasks    (user_id, updated_at);
create index tags_user_updated     on public.tags     (user_id, updated_at);
create index task_tags_task        on public.task_tags (task_id);
create index attachments_user_updated on public.attachments (user_id, updated_at);
create index time_entries_user_updated on public.time_entries (user_id, updated_at);
create index time_entries_user_task on public.time_entries (user_id, task_id);
create index comments_user_updated on public.comments (user_id, updated_at);
create index comments_task         on public.comments (task_id);
create index notes_user_updated    on public.notes    (user_id, updated_at);
create index activity_user_created on public.activity_log (user_id, created_at desc);
