import { useRef } from "react";
import { ActionSheetIOS, Pressable, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import type { Task } from "@pulse/core";
import { useTasks } from "@/stores/tasks";
import { PriorityBadge } from "./PriorityBadge";
import { DueDateBadge } from "./DueDateBadge";

/**
 * Mobile task row used by Today/Upcoming/Inbox/Project lists. Mirrors the
 * desktop TaskRowItem.tsx feature set but adapted for touch:
 *
 *   • Tap row → router.push("/task/<id>") (target screen lands in Task 14).
 *   • Tap checkbox → complete() or re-open via update({ status: "todo", ... }).
 *   • Swipe-left → red "Erledigt" action that completes the task.
 *   • Long-press → iOS ActionSheet with Erledigen / [extraActions…] / Löschen
 *     / Abbrechen. `extraActions` is the screen-specific extension surface used
 *     e.g. by the Inbox screen to inject "Verschieben in Projekt…".
 *
 * Tag dots are deferred to Task 14/15 per the plan — no task_tags fetch here.
 */
export interface TaskRowExtraAction {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

export interface TaskRowProps {
  task: Task;
  extraActions?: TaskRowExtraAction[];
}

export function TaskRow({ task, extraActions = [] }: TaskRowProps): JSX.Element {
  const router = useRouter();
  const complete = useTasks((s) => s.complete);
  const update = useTasks((s) => s.update);
  const remove = useTasks((s) => s.remove);
  const swipeRef = useRef<Swipeable>(null);

  const done = task.status === "done";

  function onToggle(): void {
    if (done) void update(task.id, { status: "todo", completedAt: null });
    else void complete(task.id);
  }

  function onLongPress(): void {
    // Order: Erledigen, …extraActions, Löschen, Abbrechen.
    const options = ["Erledigen", ...extraActions.map((a) => a.label), "Löschen", "Abbrechen"];
    const deleteIndex = 1 + extraActions.length;
    const cancelIndex = deleteIndex + 1;
    // Mark Löschen as destructive plus any extraActions flagged destructive.
    const destructiveIndices: number[] = [deleteIndex];
    extraActions.forEach((a, i) => {
      if (a.destructive) destructiveIndices.push(1 + i);
    });
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        destructiveButtonIndex: destructiveIndices,
        cancelButtonIndex: cancelIndex,
      },
      (idx) => {
        if (idx === 0) void complete(task.id);
        else if (idx === deleteIndex) void remove(task.id);
        else if (idx > 0 && idx < deleteIndex) {
          const extra = extraActions[idx - 1];
          if (extra) extra.onPress();
        }
      },
    );
  }

  function renderRightActions(): JSX.Element {
    return (
      <Pressable
        onPress={() => {
          swipeRef.current?.close();
          void complete(task.id);
        }}
        className="bg-red-600 justify-center items-center px-5"
      >
        <Text className="text-white text-sm font-medium">Erledigt</Text>
      </Pressable>
    );
  }

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false}>
      <Pressable
        onPress={() => router.push(`/task/${task.id}`)}
        onLongPress={onLongPress}
        className="bg-white rounded-md border border-gray-200 px-3 py-2 flex-row items-center gap-3"
      >
        <Pressable
          onPress={onToggle}
          hitSlop={8}
          className={`w-5 h-5 rounded border items-center justify-center ${
            done ? "bg-pulse border-pulse" : "border-gray-400 bg-white"
          }`}
        >
          {done ? <Text className="text-white text-xs">✓</Text> : null}
        </Pressable>
        <View className="flex-1 flex-row items-center gap-2">
          <Text
            numberOfLines={1}
            className={`flex-1 text-sm ${done ? "line-through text-gray-400" : "text-ink"}`}
          >
            {task.title}
          </Text>
          <PriorityBadge priority={task.priority as 1 | 2 | 3 | 4} />
        </View>
        <DueDateBadge iso={task.dueDate} />
      </Pressable>
    </Swipeable>
  );
}
