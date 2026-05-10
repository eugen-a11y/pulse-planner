const LABEL: Record<number, string> = { 1: "▲▲▲", 2: "▲▲", 3: "▲", 4: "·" };
const COLOR: Record<number, string> = { 1: "text-red-600", 2: "text-orange-500", 3: "text-yellow-600", 4: "text-gray-400" };

export function PriorityBadge({ priority }: { priority: 1 | 2 | 3 | 4 }) {
  return <span className={`text-xs ${COLOR[priority]}`}>{LABEL[priority]}</span>;
}
