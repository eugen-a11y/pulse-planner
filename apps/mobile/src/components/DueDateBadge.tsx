import { Text } from "react-native";
import { parseISO, isToday, isTomorrow, isPast, isThisWeek, format } from "date-fns";
import { de } from "date-fns/locale";

/**
 * Mobile due-date pill. Same logic as the desktop DueDateBadge
 * (apps/desktop/src/renderer/components/DueDateBadge.tsx) but renders an RN
 * <Text>. We additionally surface "Morgen" because mobile Today list shows
 * just enough context for a quick glance — the desktop version inlined this
 * via "EEEE" formatting.
 */
export function DueDateBadge({ iso }: { iso: string | null }): JSX.Element | null {
  if (!iso) return null;
  const d = parseISO(iso);
  const overdue = isPast(d) && !isToday(d);
  const today = isToday(d);
  const tomorrow = isTomorrow(d);
  const thisWeek = isThisWeek(d, { weekStartsOn: 1 });

  let cls = "text-gray-500";
  let label: string;
  if (overdue) {
    cls = "text-red-600 font-medium";
    label = "Überfällig · " + format(d, "dd.MM.", { locale: de });
  } else if (today) {
    cls = "text-pulse font-medium";
    label = "Heute";
  } else if (tomorrow) {
    label = "Morgen";
  } else if (thisWeek) {
    label = format(d, "EEEE", { locale: de });
  } else {
    label = format(d, "EE dd.MM.", { locale: de });
  }
  return <Text className={`text-xs ${cls}`}>{label}</Text>;
}
