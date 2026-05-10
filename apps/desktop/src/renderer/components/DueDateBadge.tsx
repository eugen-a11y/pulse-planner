import { parseISO, isToday, isPast, isThisWeek, format } from "date-fns";
import { de } from "date-fns/locale";

export function DueDateBadge({ iso }: { iso: string | null }) {
  if (!iso) return null;
  const d = parseISO(iso);
  const overdue = isPast(d) && !isToday(d);
  const today = isToday(d);
  const thisWeek = isThisWeek(d, { weekStartsOn: 1 });
  const time = format(d, "HH:mm", { locale: de });

  let cls = "text-gray-500";
  let datePart = format(d, "dd.MM.", { locale: de });
  if (overdue) { cls = "text-red-600 font-medium"; datePart = "überfällig · " + datePart; }
  else if (today) { cls = "text-pulse font-medium"; datePart = "heute"; }
  else if (thisWeek) { datePart = format(d, "EEEE", { locale: de }); }

  return <span className={`text-xs ${cls}`}>{datePart} · {time}</span>;
}
