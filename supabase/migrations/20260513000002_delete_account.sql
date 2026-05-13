-- Self-service account deletion (Apple Review requirement since 2022).
-- Deletes the caller's auth.users row; FK cascades wipe every public table
-- because every entity references auth.users(id) ON DELETE CASCADE.

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
begin
  if current_uid is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = current_uid;
end;
$$;

revoke all on function public.delete_account() from public;
grant execute on function public.delete_account() to authenticated;
