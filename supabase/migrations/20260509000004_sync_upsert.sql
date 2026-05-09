-- Per-field Last-Write-Wins upsert.
-- Returns the resulting row's updated_at.

create or replace function public.sync_upsert(
  p_table     text,
  p_id        uuid,
  p_op        text,         -- 'insert' | 'update' | 'delete'
  p_changes   jsonb,         -- {field: value} (snake_case columns)
  p_client_ts timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_tables constant text[] := array[
    'projects','tasks','tags','task_tags','attachments',
    'time_entries','comments','notes'
  ];
  current_uid uuid := auth.uid();
  existing_updated_at timestamptz;
  existing_user_id uuid;
  set_clauses text := '';
  k text;
  result_ts timestamptz;
begin
  if current_uid is null then
    raise exception 'not authenticated';
  end if;
  if not (p_table = any(allowed_tables)) then
    raise exception 'table not allowed: %', p_table;
  end if;
  if p_op not in ('insert','update','delete') then
    raise exception 'invalid op: %', p_op;
  end if;

  -- All allowed tables have user_id and id columns. Fetch ownership + ts.
  execute format(
    'select user_id, updated_at from public.%I where id = $1',
    p_table
  ) into existing_user_id, existing_updated_at using p_id;

  if existing_user_id is not null and existing_user_id <> current_uid then
    raise exception 'forbidden';
  end if;

  if p_op = 'delete' then
    execute format(
      'update public.%I set deleted_at = $1, updated_at = $1
         where id = $2 and user_id = $3
           and (deleted_at is null or deleted_at < $1)',
      p_table
    ) using p_client_ts, p_id, current_uid;
    return p_client_ts;
  end if;

  if existing_user_id is null then
    -- INSERT path: build full row from p_changes (caller must provide all
    -- non-null required fields). user_id forced to current_uid.
    declare
      cols text := 'id, user_id';
      vals text := format('%L, %L', p_id, current_uid);
    begin
      for k in select jsonb_object_keys(p_changes) loop
        if k in ('id', 'user_id') then continue; end if;
        cols := cols || ', ' || quote_ident(k);
        vals := vals || ', ' ||
          coalesce(quote_nullable(p_changes ->> k), 'null');
      end loop;
      execute format(
        'insert into public.%I (%s) values (%s)
         on conflict (id) do nothing',
        p_table, cols, vals
      );
    end;
    return p_client_ts;
  end if;

  -- UPDATE path: per-field LWW.
  if p_client_ts < existing_updated_at then
    -- Whole payload is older than current row: still allow per-field
    -- updates only where p_client_ts >= per-field ts. We don't track
    -- per-field timestamps, so a simpler rule: skip the update entirely.
    return existing_updated_at;
  end if;

  for k in select jsonb_object_keys(p_changes) loop
    if k in ('id','user_id','created_at','updated_at') then continue; end if;
    if set_clauses <> '' then set_clauses := set_clauses || ', '; end if;
    set_clauses := set_clauses || quote_ident(k) || ' = ' ||
      coalesce(quote_nullable(p_changes ->> k), 'null');
  end loop;

  if set_clauses = '' then
    return existing_updated_at;
  end if;

  execute format(
    'update public.%I set %s, updated_at = $1
       where id = $2 and user_id = $3',
    p_table, set_clauses
  ) using p_client_ts, p_id, current_uid;

  return p_client_ts;
end $$;

revoke all on function public.sync_upsert(text,uuid,text,jsonb,timestamptz) from public;
revoke all on function public.sync_upsert(text,uuid,text,jsonb,timestamptz) from anon;
grant execute on function public.sync_upsert(text,uuid,text,jsonb,timestamptz) to authenticated;
