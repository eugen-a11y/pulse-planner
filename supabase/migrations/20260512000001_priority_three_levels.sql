-- Collapse priority scale from 1-4 to 1-3.
--   OLD → NEW
--   1 (highest) → 1 (high)
--   2 (high)    → 2 (medium)
--   3 (medium)  → 2 (medium)   -- old default
--   4 (low)     → 3 (low)
-- Done in a single CASE to avoid cascade issues.

alter table public.tasks drop constraint if exists tasks_priority_check;

update public.tasks
set priority = case priority
  when 4 then 3
  when 3 then 2
  when 2 then 2
  else 1
end;

alter table public.tasks
  add constraint tasks_priority_check check (priority between 1 and 3);

alter table public.tasks alter column priority set default 2;
