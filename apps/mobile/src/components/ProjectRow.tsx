import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { Project } from "@pulse/core";
import { useTasks } from "@/stores/tasks";

/**
 * Single project row used by ProjectsScreen. Renders:
 *   • Color dot (uses `project.color`).
 *   • Name (truncated to 1 line).
 *   • Progress bar showing `done / total` from `useTasks().byProject[id]`.
 *     If the project's tasks haven't been hydrated, falls back to "—" — we
 *     accept stale counts on the list view per the Task 13 spec ("don't
 *     refresh-everything just to compute progress").
 *
 * Tap navigates to /project/<id>; long-press surfaces the archive/delete
 * action sheet (handled by the parent screen).
 */
export interface ProjectRowProps {
  project: Project;
  onLongPress: () => void;
}

export function ProjectRow({ project, onLongPress }: ProjectRowProps): JSX.Element {
  const router = useRouter();
  const taskIds = useTasks((s) => s.byProject[project.id]);
  const byId = useTasks((s) => s.byId);

  const { done, total, percent, loaded } = useMemo(() => {
    if (!taskIds) return { done: 0, total: 0, percent: 0, loaded: false };
    let d = 0;
    let n = 0;
    for (const id of taskIds) {
      const t = byId[id];
      if (!t) continue;
      n += 1;
      if (t.status === "done") d += 1;
    }
    const p = n === 0 ? 0 : Math.round((d / n) * 100);
    return { done: d, total: n, percent: p, loaded: true };
  }, [taskIds, byId]);

  return (
    <Pressable
      onPress={() => router.push(`/project/${project.id}` as never)}
      onLongPress={onLongPress}
      className="bg-white rounded-md border border-gray-200 px-3 py-2.5 flex-row items-center gap-3"
    >
      <View
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: project.color }}
      />
      <View className="flex-1">
        <Text className="text-base text-ink" numberOfLines={1}>
          {project.name}
        </Text>
        <View className="flex-row items-center gap-2 mt-1">
          <View className="flex-1 h-1 rounded-full bg-gray-200 overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{ width: `${percent}%`, backgroundColor: project.color }}
            />
          </View>
          <Text className="text-[10px] text-gray-500 tabular-nums w-10 text-right">
            {loaded ? `${done}/${total}` : "—"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
