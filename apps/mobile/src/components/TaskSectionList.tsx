import { Text, View } from "react-native";
import type { Task } from "@pulse/core";

export type TaskRow =
  | { type: "header"; key: string; label: string; count: number; muted?: boolean }
  | { type: "task"; task: Task; done: boolean };

/** Splits a sorted task list into [open, done] groups with section headers,
 *  preserving the dueDate-asc order within each group. Used by Inbox + Project
 *  task lists so completed tasks settle to the bottom of the screen. */
export function groupTasks(tasks: Task[]): TaskRow[] {
  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");
  const out: TaskRow[] = [];
  if (open.length > 0) {
    out.push({ type: "header", key: "h-open", label: "Offen", count: open.length });
    for (const t of open) out.push({ type: "task", task: t, done: false });
  }
  if (done.length > 0) {
    out.push({ type: "header", key: "h-done", label: "Erledigt", count: done.length, muted: true });
    for (const t of done) out.push({ type: "task", task: t, done: true });
  }
  return out;
}

export function TaskSectionHeader({
  label, count, muted,
}: { label: string; count: number; muted?: boolean }): JSX.Element {
  return (
    <View className="mt-3 mb-1.5">
      <Text className={`text-[11px] uppercase tracking-wide ${muted ? "text-ink-muted" : "text-gray-500"}`}>
        {label} ({count})
      </Text>
    </View>
  );
}
