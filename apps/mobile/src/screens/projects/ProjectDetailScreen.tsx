import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Plus } from "lucide-react-native";
import { makeProjectNote, nowIso, type Note, type Project, type Task } from "@pulse/core";
import { useProjects } from "@/stores/projects";
import { useTasks } from "@/stores/tasks";
import { useDeps } from "@/wiring/depsContext";
import { TaskRow } from "@/components/TaskRow";
import { ColorSwatchPopover } from "@/components/ColorSwatchPopover";
import { DueDatePicker } from "@/components/DueDatePicker";
import { MarkdownView } from "@/components/MarkdownView";
import { QuickAddSheet } from "@/components/QuickAddSheet";
import { TaskFAB } from "@/components/TaskFAB";
import { refreshAll } from "@/stores/refresh-all";

/**
 * Project detail screen. Mirrors `apps/desktop/src/renderer/project/ProjectView.tsx`
 * shape (header + sub-tabs) but uses a simple "Tasks" / "Notizen" segmented
 * toggle instead of `@react-navigation/material-top-tabs` (per the Task 13
 * spec allowance — saves a heavyweight nav dep).
 *
 * Header:
 *   • Color dot → ColorSwatchPopover (update project.color)
 *   • Tappable name → inline TextInput, saves on blur / Enter
 *   • Due-date pill → DueDatePicker (update project.dueDate)
 *   • Multiline description TextInput, autosave on blur
 *   • "Archiviert" badge when project.archived === true
 *
 * Tasks tab: FlatList of TaskRow from useTasks().byProject[id]. Refreshes on
 * mount. Empty state copy mirrors the inbox screen idiom.
 *
 * Notizen tab: directly fetches `notes` from deps.store filtered by projectId
 * (no mobile notesStore yet — v1 ships this inline, mirroring desktop
 * ProjectNotesView's IPC fetch). Each note has its own inline editor. The
 * outbox payload shape matches `apps/desktop/src/main/ipc.ts` lines 413-444.
 */
const EMPTY: readonly string[] = [];

export function ProjectDetailScreen(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const project = useProjects((s) => (id ? s.byId[id] : undefined));
  const update = useProjects((s) => s.update);
  const refresh = useProjects((s) => s.refresh);
  const [tab, setTab] = useState<"tasks" | "notes">("tasks");
  const [swatchOpen, setSwatchOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const triedRefresh = useRef(false);

  // If the project isn't in the store yet (cold open via deep link), kick a
  // refresh exactly once and render a spinner until it lands.
  useEffect(() => {
    if (!project && !triedRefresh.current) {
      triedRefresh.current = true;
      void refresh();
    }
  }, [project, refresh]);

  if (!id) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-8">
        <Text className="text-base text-ink-muted text-center">
          Kein Projekt ausgewählt.
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-3 px-4 py-2 rounded-md border border-gray-300"
        >
          <Text className="text-sm text-ink">Zurück</Text>
        </Pressable>
      </View>
    );
  }

  if (!project) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#2563EB" />
      </View>
    );
  }

  const projectId = project.id;

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 py-3 border-b border-gray-200 gap-2">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => setSwatchOpen(true)} hitSlop={6}>
            <View
              className="w-4 h-4 rounded-full border border-black/10"
              style={{ backgroundColor: project.color }}
            />
          </Pressable>
          <EditableName
            value={project.name}
            onSave={(name) => void update(projectId, { name })}
          />
          {project.archived ? (
            <View className="bg-gray-200 rounded px-2 py-0.5">
              <Text className="text-[10px] text-gray-700 uppercase tracking-wide">
                Archiviert
              </Text>
            </View>
          ) : null}
        </View>

        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => setDateOpen(true)}
            className="bg-gray-100 rounded px-2 py-1"
          >
            <Text className="text-xs text-ink">
              {project.dueDate
                ? format(parseISO(project.dueDate), "dd. MMM yyyy", { locale: de })
                : "Kein Datum"}
            </Text>
          </Pressable>
        </View>

        <DescriptionField
          value={project.description}
          onSave={(description) => void update(projectId, { description })}
        />

        <View className="flex-row gap-2 pt-1">
          <SegBtn active={tab === "tasks"} onPress={() => setTab("tasks")} label="Tasks" />
          <SegBtn active={tab === "notes"} onPress={() => setTab("notes")} label="Notizen" />
        </View>
      </View>

      {tab === "tasks" ? (
        <ProjectTasksTab projectId={projectId} />
      ) : (
        <ProjectNotesTab projectId={projectId} />
      )}

      <ColorSwatchPopover
        visible={swatchOpen}
        value={project.color}
        onPick={(color) => void update(projectId, { color })}
        onClose={() => setSwatchOpen(false)}
      />
      <DueDatePicker
        visible={dateOpen}
        value={project.dueDate}
        onPick={(dueDate) => void update(projectId, { dueDate })}
        onClose={() => setDateOpen(false)}
      />

      {tab === "tasks" && (
        <TaskFAB onPress={() => setQuickAddOpen(true)} aboveTabBar={false} />
      )}

      <QuickAddSheet
        visible={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        defaultProjectId={projectId}
      />
    </View>
  );
}

function EditableName({
  value,
  onSave,
}: {
  value: string;
  onSave: (next: string) => void;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit(): void {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== value) onSave(next);
    else setDraft(value);
  }

  if (!editing) {
    return (
      <Pressable onPress={() => setEditing(true)} className="flex-1">
        <Text className="text-xl font-semibold text-ink" numberOfLines={1}>
          {value}
        </Text>
      </Pressable>
    );
  }
  return (
    <TextInput
      value={draft}
      onChangeText={setDraft}
      onBlur={commit}
      onSubmitEditing={commit}
      autoFocus
      className="flex-1 text-xl font-semibold text-ink border-b border-pulse"
    />
  );
}

function DescriptionField({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (next: string | null) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  function commit(): void {
    if (draft.trim() === (value ?? "")) return;
    onSave(draft.trim() || null);
  }

  return (
    <TextInput
      value={draft}
      onChangeText={setDraft}
      onBlur={commit}
      multiline
      placeholder="Beschreibung — Markdown erlaubt…"
      maxLength={2000}
      className="text-sm text-ink border border-gray-200 rounded p-2"
    />
  );
}

function SegBtn({
  active,
  onPress,
  label,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
}): JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      className={`px-3 py-1.5 rounded ${
        active ? "bg-pulse" : "bg-white border border-gray-200"
      }`}
    >
      <Text
        className={`text-xs font-medium ${active ? "text-white" : "text-ink"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ProjectTasksTab({ projectId }: { projectId: string }): JSX.Element {
  const deps = useDeps();
  const ids = useTasks((s) => s.byProject[projectId] ?? EMPTY);
  const byId = useTasks((s) => s.byId);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void useTasks.getState().refreshProject(projectId);
  }, [projectId]);

  const tasks = useMemo<Task[]>(() => {
    const out: Task[] = [];
    for (const id of ids) {
      const t = byId[id];
      if (t && t.projectId === projectId) out.push(t);
    }
    return out;
  }, [ids, byId, projectId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (deps.engine) await deps.engine.pull();
      await refreshAll(deps);
      await useTasks.getState().refreshProject(projectId);
    } finally {
      setRefreshing(false);
    }
  }, [deps, projectId]);

  if (tasks.length === 0) {
    return (
      <FlatList
        data={[] as Task[]}
        keyExtractor={(t) => t.id}
        renderItem={() => null}
        ListEmptyComponent={
          <View className="items-center justify-center px-8 py-12">
            <Text className="text-base text-ink-muted text-center">
              Keine Tasks in diesem Projekt.
            </Text>
          </View>
        }
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />
        }
      />
    );
  }

  return (
    <FlatList
      data={tasks}
      keyExtractor={(t) => t.id}
      renderItem={({ item }) => (
        <View className="mb-1.5">
          <TaskRow task={item} />
        </View>
      )}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />
      }
    />
  );
}

function ProjectNotesTab({ projectId }: { projectId: string }): JSX.Element {
  const deps = useDeps();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [composing, setComposing] = useState(false);
  const [newDraft, setNewDraft] = useState("");

  const load = useCallback(async () => {
    const userId = deps.userId;
    if (!userId) {
      setNotes([]);
      setLoading(false);
      return;
    }
    const all = await deps.store.listSince<Note>("notes", null, { userId });
    const list = all
      .filter((n) => n.projectId === projectId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    setNotes(list);
    setLoading(false);
  }, [deps, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (deps.engine) await deps.engine.pull();
      await refreshAll(deps);
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [deps, load]);

  async function saveExisting(note: Note): Promise<void> {
    const userId = deps.userId;
    if (!userId) return;
    const text = draft.trim();
    setEditingId(null);
    if (text === note.bodyMd) return;
    if (!text) {
      // Delete-on-empty: simpler than a separate Löschen affordance for v1.
      const ts = nowIso();
      await deps.store.softDelete("notes", note.id, ts);
      await deps.outbox.enqueue({
        entityTable: "notes",
        entityId: note.id,
        op: "delete",
        changedFields: {},
        clientTs: ts,
      });
      await load();
      return;
    }
    const ts = nowIso();
    const updated: Note = { ...note, bodyMd: text, updatedAt: ts };
    await deps.store.upsert("notes", updated);
    await deps.outbox.enqueue({
      entityTable: "notes",
      entityId: note.id,
      op: "update",
      changedFields: { bodyMd: text, updatedAt: ts },
      clientTs: ts,
    });
    await load();
  }

  async function saveNew(): Promise<void> {
    const userId = deps.userId;
    if (!userId) {
      setComposing(false);
      return;
    }
    const text = newDraft.trim();
    setComposing(false);
    setNewDraft("");
    if (!text) return;
    try {
      const note = makeProjectNote({ userId, projectId, bodyMd: text });
      await deps.store.upsert("notes", note);
      await deps.outbox.enqueue({
        entityTable: "notes",
        entityId: note.id,
        op: "insert",
        changedFields: {
          id: note.id,
          projectId: note.projectId,
          taskId: note.taskId,
          bodyMd: note.bodyMd,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          deletedAt: note.deletedAt,
        },
        clientTs: note.updatedAt,
      });
      await load();
    } catch (e) {
      Alert.alert("Fehler", (e as Error).message);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#2563EB" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Text className="text-xs uppercase tracking-wide text-gray-500">
          Projekt-Notizen · Markdown
        </Text>
        <Pressable
          hitSlop={8}
          onPress={() => {
            setComposing(true);
            setNewDraft("");
          }}
          accessibilityLabel="Neue Notiz"
        >
          <Plus color="#2563EB" size={20} />
        </Pressable>
      </View>

      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => {
          const isEditing = editingId === item.id;
          if (isEditing) {
            return (
              <View className="mb-2">
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  onBlur={() => void saveExisting(item)}
                  multiline
                  autoFocus
                  placeholder="Notiz — Markdown…"
                  className="text-sm text-ink border border-pulse rounded p-3 min-h-[80px]"
                />
              </View>
            );
          }
          return (
            <Pressable
              onPress={() => {
                setDraft(item.bodyMd);
                setEditingId(item.id);
              }}
              className="mb-2 rounded border border-gray-200 p-3 bg-white"
            >
              <MarkdownView source={item.bodyMd} />
            </Pressable>
          );
        }}
        ListHeaderComponent={
          composing ? (
            <View className="mb-2">
              <TextInput
                value={newDraft}
                onChangeText={setNewDraft}
                onBlur={() => void saveNew()}
                multiline
                autoFocus
                placeholder="Neue Notiz — Markdown…"
                className="text-sm text-ink border border-pulse rounded p-3 min-h-[80px]"
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          composing ? null : (
            <View className="items-center justify-center px-8 py-12">
              <Text className="text-base text-ink-muted text-center">
                Noch keine Notizen. Tippe auf +, um eine anzulegen.
              </Text>
            </View>
          )
        }
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />
        }
      />
    </View>
  );
}
