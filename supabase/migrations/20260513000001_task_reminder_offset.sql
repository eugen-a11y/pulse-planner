-- Per-task reminder offset (minutes before due_date).
-- NULL = no reminder. 0 = fire exactly at due_date. >0 = N minutes before.
-- Cap matches client UI (max 7 days back).
alter table public.tasks
  add column if not exists reminder_offset_minutes int;

alter table public.tasks
  drop constraint if exists tasks_reminder_offset_check;

alter table public.tasks
  add constraint tasks_reminder_offset_check
  check (reminder_offset_minutes is null or (reminder_offset_minutes >= 0 and reminder_offset_minutes <= 10080));
