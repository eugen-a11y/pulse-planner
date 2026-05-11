import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { ChevronDown, ChevronRight, Plus } from "lucide-react-native";
import type { Project } from "@pulse/core";
import { useProjects } from "@/stores/projects";
import { useDeps } from "@/wiring/depsContext";
import { ProjectRow } from "@/components/ProjectRow";
import { SyncStatusPill } from "@/components/SyncStatusPill";

/**
 * Projects list screen. Two collapsible sections:
 *   • "Aktiv"  — default expanded, projects where `archived === false`.
 *   • "Archiv" — default collapsed, projects where `archived === true`.
 *
 * Header: title + SyncStatusPill + "+" button (Alert.prompt on iOS, fallback
 * to a single-shot Alert with a not-supported message on Android since the
 * mobile build targets iOS only per the phase-3 plan).
 *
 * Long-press on a row opens an iOS ActionSheet:
 *   • Active   → ["Archivieren", "Löschen", "Abbrechen"]
 *   • Archived → ["Reaktivieren", "Löschen", "Abbrechen"]
 *
 * Pull-to-refresh runs engine.pull() + projects.refresh().
 */
type Section = "active" | "archive";
type Row =
  | { kind: "header"; section: Section; count: number; open: boolean }
  | { kind: "item"; project: Project };

export function ProjectsScreen(): JSX.Element {
  const deps = useDeps();
  const byId = useProjects((s) => s.byId);
  const order = useProjects((s) => s.order);
  const create = useProjects((s) => s.create);
  const update = useProjects((s) => s.update);
  const remove = useProjects((s) => s.remove);
  const [refreshing, setRefreshing] = useState(false);
  const [activeOpen, setActiveOpen] = useState(true);
  const [archiveOpen, setArchiveOpen] = useState(false);

  useEffect(() => {
    void useProjects.getState().refresh();
  }, []);

  const { active, archived } = useMemo(() => {
    const a: Project[] = [];
    const r: Project[] = [];
    for (const id of order) {
      const p = byId[id];
      if (!p) continue;
      if (p.archived) r.push(p);
      else a.push(p);
    }
    return { active: a, archived: r };
  }, [order, byId]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    out.push({ kind: "header", section: "active", count: active.length, open: activeOpen });
    if (activeOpen) for (const p of active) out.push({ kind: "item", project: p });
    out.push({ kind: "header", section: "archive", count: archived.length, open: archiveOpen });
    if (archiveOpen) for (const p of archived) out.push({ kind: "item", project: p });
    return out;
  }, [active, archived, activeOpen, archiveOpen]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (deps.engine) await deps.engine.pull();
      await useProjects.getState().refresh();
    } finally {
      setRefreshing(false);
    }
  }, [deps.engine]);

  const onLongPress = useCallback(
    (p: Project) => {
      const options = p.archived
        ? ["Reaktivieren", "Löschen", "Abbrechen"]
        : ["Archivieren", "Löschen", "Abbrechen"];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
          title: p.name,
        },
        (idx) => {
          if (idx === 0) void update(p.id, { archived: !p.archived });
          else if (idx === 1) void remove(p.id);
        },
      );
    },
    [update, remove],
  );

  function onAddPress(): void {
    // Alert.prompt is iOS-only. The mobile target is iOS per phase-3 plan,
    // so this is the simplest input affordance for v1.
    if (Platform.OS === "ios" && typeof Alert.prompt === "function") {
      Alert.prompt(
        "Neues Projekt",
        "Name des Projekts",
        async (name) => {
          const trimmed = (name ?? "").trim();
          if (!trimmed) return;
          try {
            await create({ name: trimmed });
          } catch {
            // No toast surface on mobile yet (Task 22). Swallow per phase-3 spec.
          }
        },
        "plain-text",
        "",
      );
    } else {
      // Android fallback — a more complete add-flow lands with QuickAddSheet
      // (Task 17). For now, simply alert.
      Alert.alert("Neues Projekt", "Bitte iOS verwenden — Android folgt später.");
    }
  }

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center px-4 py-3 border-b border-gray-200 gap-3">
        <Text className="text-xl font-semibold text-ink flex-1">Projekte</Text>
        <SyncStatusPill />
        <Pressable hitSlop={8} onPress={onAddPress} accessibilityLabel="Neues Projekt">
          <Plus color="#2563EB" size={22} />
        </Pressable>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r, i) =>
          r.kind === "header" ? `h:${r.section}` : `p:${r.project.id}:${i}`
        }
        renderItem={({ item }) => {
          if (item.kind === "header") {
            const label = item.section === "active" ? "Aktiv" : "Archiv";
            const onToggle =
              item.section === "active"
                ? () => setActiveOpen((o) => !o)
                : () => setArchiveOpen((o) => !o);
            return (
              <Pressable
                onPress={onToggle}
                className="flex-row items-center gap-1 py-2 mt-2"
              >
                {item.open ? (
                  <ChevronDown color="#94A3B8" size={14} />
                ) : (
                  <ChevronRight color="#94A3B8" size={14} />
                )}
                <Text className="text-xs uppercase tracking-wide text-gray-500">
                  {label} ({item.count})
                </Text>
              </Pressable>
            );
          }
          return (
            <View className="mb-1.5">
              <ProjectRow project={item.project} onLongPress={() => onLongPress(item.project)} />
            </View>
          );
        }}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />
        }
        ListEmptyComponent={
          <View className="items-center justify-center px-8 py-12">
            <Text className="text-base text-ink-muted text-center">
              Noch keine Projekte. Tippe auf +, um eines anzulegen.
            </Text>
          </View>
        }
      />
    </View>
  );
}
