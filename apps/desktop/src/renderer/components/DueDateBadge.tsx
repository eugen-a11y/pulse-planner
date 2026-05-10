import { parseISO, isToday, isPast, isThisWeek, format } from "date-fns";
import { de } from "date-fns/locale";

export function DueDateBadge({ iso }: { iso: string | null }) {
  if (!iso) return null;
  const d = parseISO(iso);
  const overdue = isPast(d) && !isToday(d);
  const today = isToday(d);
  const thisWeek = isThisWeek(d, { weekStartsOn: 1 });

  let cls = "text-gray-500";
  let label = format(d, "dd.MM.", { locale: de });
  if (overdue) { cls = "text-red-600 font-medium"; label = "überfällig · " + label; }
  else if (today) { cls = "text-pulse font-medium"; label = "heute"; }
  else if (thisWeek) { label = format(d, "EEEE", { locale: de }); }

  return <span className={`text-xs ${cls}`}>{label}</span>;
}
