import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { Project, Tag, Task } from "@pulse/core";
import { useTasks } from "@/stores/tasks";
import { useProjects } from "@/stores/projects";
import { useTags } from "@/stores/tags";
import { refreshAll } from "@/stores/refresh-all";
import { useDeps } from "@/wiring/depsContext";
import { TaskRow } from "@/components/TaskRow";

/**
 * Global search screen (Task 16). Case-insensitive substring search across the
 * three in-memory Zustand stores (tasks / projects / tags). Results render in
 * three sections in fixed order: Aufgaben, Projekte, Tags. Each row is
 * tappable and navigates to the corresponding detail route.
 *
 * Per the phase-3 plan:
 *   • Debounce typing by 200ms before committing the query.
 *   • Cap task results at 50 to keep render cost bounded.
 *   • Call refreshAll() once on mount so stale local data isn't searched.
 *   • No filters, no advanced operators, no recent-search history — stick to spec.
 *
 * Note on coverage: useTasks.byId is only hydrated by refreshToday/Upcoming/
 * Inbox/Project, so tasks that aren't in any of those buckets (e.g. project
 * tasks for an unvisited project) won't appear until that project is opened.
 * The refreshAll() call above warms Today/Upcoming/Inbox plus Projects+Tags,
 * which mirrors what the rest of the app considers "the working set".
 */
type Row =
  | { kind: "section"; label: string }
  | { kind: "task"; task: Task }
  | { kind: "project"; project: Project }
  | { kind: "tag"; tag: Tag };

export function SearchScreen(): JSX.Element {
  const router = useRouter();
  const deps = useDeps();
  const tasksById = useTasks((s) => s.byId);
  const projectsById = useProjects((s) => s.byId);
  const projectsOrder = useProjects((s) => s.order);
  const tagsById = useTags((s) => s.byId);
  const tagsOrder = useTags((s) => s.order);

  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One-shot refresh on mount so the search index reflects the latest local
  // data. Swallow errors — search still works against whatever is in memory.
  useEffect(() => {
    refreshAll(deps).catch(() => {
      // swallow per phase-3 spec
    });
  }, [deps]);

  // 200ms debounce: every keystroke restarts the timer; only the final value
  // makes it into activeQuery, which is what useMemo depends on.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setActiveQuery(query);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const q = activeQuery.trim().toLowerCase();

  const matchedTasks = useMemo<Task[]>(() => {
    if (!q) return [];
    const out: Task[] = [];
    for (const t of Object.values(tasksById)) {
      if (t.deletedAt) continue;
      const title = t.title.toLowerCase();
      const desc = (t.description ?? "").toLowerCase();
      if (title.includes(q) || desc.includes(q)) {
        out.push(t);
        if (out.length >= 50) break;
      }
    }
    return out;
  }, [tasksById, q]);

  const matchedProjects = useMemo<Project[]>(() => {
    if (!q) return [];
    const out: Project[] = [];
    for (const id of projectsOrder) {
      const p = projectsById[id];
      if (!p || p.deletedAt) continue;
      if (p.name.toLowerCase().includes(q)) out.push(p);
    }
    return out;
  }, [projectsById, projectsOrder, q]);

  const matchedTags = useMemo<Tag[]>(() => {
    if (!q) return [];
    const out: Tag[] = [];
    for (const id of tagsOrder) {
      const tag = tagsById[id];
      if (!tag || tag.deletedAt) continue;
      if (tag.name.toLowerCase().includes(q)) out.push(tag);
    }
    return out;
  }, [tagsById, tagsOrder, q]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (matchedTasks.length > 0) {
      out.push({ kind: "section", label: "Aufgaben" });
      for (const t of matchedTasks) out.push({ kind: "task", task: t });
    }
    if (matchedProjects.length > 0) {
      out.push({ kind: "section", label: "Projekte" });
      for (const p of matchedProjects) out.push({ kind: "project", project: p });
    }
    if (matchedTags.length > 0) {
      out.push({ kind: "section", label: "Tags" });
      for (const tag of matchedTags) out.push({ kind: "tag", tag });
    }
    return out;
  }, [matchedTasks, matchedProjects, matchedTags]);

  const hasQuery = q.length > 0;
  const noResults = hasQuery && rows.length === 0;

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center px-2 py-3 border-b border-gray-200 gap-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Zurück"
        >
          <ChevronLeft color="#2563EB" size={26} />
        </Pressable>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Suchen…"
          placeholderTextColor="#94A3B8"
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          className="flex-1 text-base text-ink py-1 px-2"
        />
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Abbrechen"
        >
          <Text className="text-sm text-pulse px-1">Abbrechen</Text>
        </Pressable>
      </View>

      {!hasQuery ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-base text-ink-muted text-center">
            Tippe, um zu suchen.
          </Text>
        </View>
      ) : noResults ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-base text-ink-muted text-center">
            Keine Treffer.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r, i) => {
            if (r.kind === "section") return `s:${r.label}`;
            if (r.kind === "task") return `t:${r.task.id}:${i}`;
            if (r.kind === "project") return `p:${r.project.id}:${i}`;
            return `g:${r.tag.id}:${i}`;
          }}
          renderItem={({ item }) => {
            if (item.kind === "section") {
              return (
                <Text className="text-xs uppercase tracking-wide text-gray-500 mb-2 mt-2">
                  {item.label}
                </Text>
              );
            }
            if (item.kind === "task") {
              return (
                <View className="mb-1.5">
                  <TaskRow task={item.task} />
                </View>
              );
            }
            if (item.kind === "project") {
              return (
                <View className="mb-1.5">
                  <Pressable
                    onPress={() => router.push(`/project/${item.project.id}` as never)}
                    className="bg-white rounded-md border border-gray-200 px-3 py-2.5 flex-row items-center gap-3"
                  >
                    <View
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: item.project.color }}
                    />
                    <Text
                      className="flex-1 text-sm text-ink"
                      numberOfLines={1}
                    >
                      {item.project.name}
                    </Text>
                    {item.project.archived ? (
                      <Text className="text-[10px] uppercase tracking-wide text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        Archiviert
                      </Text>
                    ) : null}
                  </Pressable>
                </View>
              );
            }
            // tag
            return (
              <View className="mb-1.5">
                <Pressable
                  onPress={() => router.push(`/tags/${item.tag.id}` as never)}
                  className="bg-white rounded-md border border-gray-200 px-3 py-2.5 flex-row items-center gap-3"
                >
                  <View
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.tag.color }}
                  />
                  <Text
                    className="flex-1 text-sm text-ink"
                    numberOfLines={1}
                  >
                    {item.tag.name}
                  </Text>
                </Pressable>
              </View>
            );
          }}
          contentContainerStyle={{ padding: 16 }}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}
