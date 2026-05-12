import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Modal } from "react-native";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowLeft, X } from "lucide-react-native";
import {
  makeComment,
  nowIso,
  type Comment,
  type Task,
} from "@pulse/core";
import { useTasks } from "@/stores/tasks";
import { useProjects } from "@/stores/projects";
import { useTags } from "@/stores/tags";
import { useDeps } from "@/wiring/depsContext";
import { MarkdownView } from "@/components/MarkdownView";
import { PriorityBadge } from "@/components/PriorityBadge";
import { DueDatePicker } from "@/components/DueDatePicker";
import { RRulePicker, describeRRule } from "@/components/RRulePicker";
import { TagPicker } from "@/components/TagPicker";

/**
 * Task detail screen. Mirrors the desktop TaskView (`apps/desktop/src/renderer/
 * task/TaskView.tsx`) feature set, scoped to what Phase 3 spec §14 lists:
 *
 *   Header        : ◀ Back · checkbox · inline-editable title
 *   Project chip  : tap → ProjectPickerSheet
 *   Due date      : tap → DueDatePicker
 *   Recurrence    : tap → RRulePicker (Aus / Täglich / Werktags / Wöchentlich /
 *                   Alle 2 Wochen / Monatlich / Jährlich / Custom)
 *   Tags          : chips + tap → TagPicker bottom sheet
 *   Description   : MarkdownView read mode → tap to edit (multiline TextInput,
 *                   save on blur)
 *   Subtasks      : checklist of tasks with parentTaskId === id; inline "+
 *                   Subtask" composer
 *   Comments      : sorted by createdAt asc, composer + Senden at bottom.
 *                   Outbox payload mirrors `apps/desktop/src/main/ipc.ts:454-471`.
 *
 * No mobile commentsStore yet → comments are loaded directly via
 * `deps.store.listSince("comments")` and created with `makeComment` + outbox
 * enqueue, same shape as desktop.
 *
 * Subtasks are just `Task` rows where `parentTaskId === id`. We render an
 * inline checkbox-and-title row (small TaskRow variant) and rely on the
 * existing `useTasks().complete / update / create` actions for state.
 */
const EMPTY_TASK_IDS: readonly string[] = [];

export function TaskDetailScreen(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const task = useTasks((s) => (id ? s.byId[id] : undefined));
  const update = useTasks((s) => s.update);
  const complete = useTasks((s) => s.complete);
  const refreshProject = useTasks((s) => s.refreshProject);
  const refreshInbox = useTasks((s) => s.refreshInbox);

  const triedRefresh = useRef(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [rruleOpen, setRruleOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);

  // Cold open (deep link `pulse://task/<id>`): the store might not have the
  // task yet. Kick a one-shot refresh of inbox + the task's likely project
  // when we have an id but no task.
  useEffect(() => {
    if (id && !task && !triedRefresh.current) {
      triedRefresh.current = true;
      void refreshInbox();
    }
  }, [id, task, refreshInbox]);

  if (!id) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-8">
        <Text className="text-base text-ink-muted text-center">Keine Task ausgewählt.</Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-3 px-4 py-2 rounded-md border border-gray-300"
        >
          <Text className="text-sm text-ink">Zurück</Text>
        </Pressable>
      </View>
    );
  }

  if (!task) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#2563EB" />
      </View>
    );
  }

  const taskId = task.id;
  const done = task.status === "done";

  function onToggleStatus(): void {
    if (done) void update(taskId, { status: "todo", completedAt: null });
    else void complete(taskId);
  }

  function onPickProject(projectId: string): void {
    setProjectOpen(false);
    if (projectId === task!.projectId) return;
    void update(taskId, { projectId });
    // The inbox/project lists rely on these helpers to recompute membership.
    void refreshInbox();
    void refreshProject(projectId);
  }

  function onClearProject(): void {
    setProjectOpen(false);
    if (task!.projectId === null) return;
    void update(taskId, { projectId: null });
  }

  function onPickDate(iso: string | null): void {
    void update(taskId, { dueDate: iso });
  }

  function onPickRRule(rrule: string | null): void {
    void update(taskId, { recurrenceRule: rrule });
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white"
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 96 }}
      >
        {/* Header */}
        <View className="px-4 pt-3 pb-2 border-b border-gray-200 gap-3">
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <ArrowLeft color="#0F172A" size={22} />
            </Pressable>
            <View className="flex-1" />
            <Text className="text-xs text-ink-muted">
              {done ? "Erledigt" : "Offen"}
            </Text>
            <Pressable
              onPress={onToggleStatus}
              hitSlop={8}
              className={`w-6 h-6 rounded border items-center justify-center ${
                done ? "bg-pulse border-pulse" : "border-gray-400 bg-white"
              }`}
              accessibilityLabel={done ? "Als offen markieren" : "Als erledigt markieren"}
            >
              {done ? <Text className="text-white text-xs">✓</Text> : null}
            </Pressable>
          </View>
          <EditableTitle
            value={task.title}
            done={done}
            onSave={(title) => void update(taskId, { title })}
          />
        </View>

        {/* Project chip */}
        <Row
          label="Projekt"
          value={<ProjectChip projectId={task.projectId} />}
          onPress={() => setProjectOpen(true)}
        />

        {/* Due date */}
        <Row
          label="Fälligkeit"
          value={
            <Text className="text-sm text-ink">
              {task.dueDate
                ? format(parseISO(task.dueDate), "EE dd. MMM yyyy", { locale: de })
                : "Kein Datum"}
            </Text>
          }
          onPress={() => setDateOpen(true)}
        />

        {/* Recurrence */}
        <Row
          label="Wiederholung"
          value={
            <Text className="text-sm text-ink">{describeRRule(task.recurrenceRule)}</Text>
          }
          onPress={() => setRruleOpen(true)}
        />

        {/* Priority */}
        <View className="px-4 py-3 border-b border-gray-100 flex-row items-center">
          <Text className="text-xs uppercase tracking-wide text-gray-500 w-32">
            Priorität
          </Text>
          <View className="flex-1 flex-row items-center gap-2">
            {[1, 2, 3].map((p) => {
              const on = task.priority === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => void update(taskId, { priority: p as 1 | 2 | 3 })}
                  hitSlop={6}
                  className={`rounded-md px-2 py-1.5 flex-row items-center gap-1.5 border ${
                    on ? "border-pulse bg-pulse/10" : "border-gray-200 bg-white"
                  }`}
                >
                  <PriorityBadge priority={p as 1 | 2 | 3} />
                  <Text className={`text-xs ${on ? "text-pulse font-semibold" : "text-ink-muted"}`}>
                    {p === 1 ? "Hoch" : p === 2 ? "Mittel" : "Niedrig"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Tags */}
        <TagsRow taskId={taskId} onPress={() => setTagsOpen(true)} />

        {/* Description */}
        <DescriptionSection
          value={task.description}
          onSave={(description) => void update(taskId, { description })}
        />

        {/* Subtasks */}
        <SubtasksSection parent={task} />

        {/* Comments */}
        <CommentsSection taskId={taskId} />
      </ScrollView>

      <TaskProjectPicker
        visible={projectOpen}
        currentProjectId={task.projectId}
        onPickProject={onPickProject}
        onPickInbox={onClearProject}
        onClose={() => setProjectOpen(false)}
      />
      <DueDatePicker
        visible={dateOpen}
        value={task.dueDate}
        onPick={onPickDate}
        onClose={() => setDateOpen(false)}
      />
      <RRulePicker
        visible={rruleOpen}
        value={task.recurrenceRule}
        onPick={onPickRRule}
        onClose={() => setRruleOpen(false)}
      />
      <TagPicker
        visible={tagsOpen}
        taskId={taskId}
        onClose={() => setTagsOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

function Row({
  label,
  value,
  onPress,
}: {
  label: string;
  value: JSX.Element;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      className="px-4 py-3 border-b border-gray-100 flex-row items-center active:bg-gray-50"
    >
      <Text className="text-xs uppercase tracking-wide text-gray-500 w-32">{label}</Text>
      <View className="flex-1">{value}</View>
    </Pressable>
  );
}

function EditableTitle({
  value,
  done,
  onSave,
}: {
  value: string;
  done: boolean;
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
      <Pressable onPress={() => setEditing(true)} className="pb-1">
        <Text
          className={`text-2xl font-semibold ${done ? "line-through text-gray-400" : "text-ink"}`}
          numberOfLines={3}
        >
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
      multiline
      className="text-2xl font-semibold text-ink border-b border-pulse pb-1"
    />
  );
}

function ProjectChip({ projectId }: { projectId: string | null }): JSX.Element {
  const project = useProjects((s) => (projectId ? s.byId[projectId] : undefined));
  if (!projectId) {
    return (
      <View className="self-start bg-gray-100 rounded px-2 py-1">
        <Text className="text-sm text-ink">Inbox</Text>
      </View>
    );
  }
  if (!project) {
    return (
      <View className="self-start bg-gray-100 rounded px-2 py-1">
        <Text className="text-sm text-ink">…</Text>
      </View>
    );
  }
  return (
    <View className="self-start bg-gray-100 rounded px-2 py-1 flex-row items-center gap-2">
      <View
        className="w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: project.color }}
      />
      <Text className="text-sm text-ink" numberOfLines={1}>
        {project.name}
      </Text>
    </View>
  );
}

/**
 * Bottom-sheet project picker for tasks. Differs from `ProjectPickerSheet` by
 * exposing an explicit "Inbox" row at the top — letting the user clear the
 * task's projectId without a separate gesture. ProjectPickerSheet is reused
 * elsewhere (e.g. Inbox screen) where moving TO Inbox doesn't make sense.
 */
function TaskProjectPicker({
  visible,
  currentProjectId,
  onPickProject,
  onPickInbox,
  onClose,
}: {
  visible: boolean;
  currentProjectId: string | null;
  onPickProject: (projectId: string) => void;
  onPickInbox: () => void;
  onClose: () => void;
}): JSX.Element {
  const byId = useProjects((s) => s.byId);
  const order = useProjects((s) => s.order);
  const loaded = useProjects((s) => s.loaded);

  useEffect(() => {
    if (visible && !loaded) void useProjects.getState().refresh();
  }, [visible, loaded]);

  const projects = useMemo(
    () => order.map((id) => byId[id]).filter((p) => p && !p.archived),
    [order, byId],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 justify-end">
        <Pressable
          onPress={() => {}}
          className="bg-white rounded-t-2xl pb-6 pt-3 max-h-[70%] border border-gray-300"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.18,
            shadowRadius: 14,
            elevation: 12,
          }}
        >
          <View className="items-center pb-2">
            <View className="w-10 h-1 rounded-full bg-gray-300" />
          </View>
          <Text className="text-base font-semibold text-ink px-4 pb-2">Projekt</Text>

          <Pressable
            onPress={onPickInbox}
            className="flex-row items-center gap-3 px-4 py-3 active:bg-gray-100"
          >
            <View className="w-3 h-3 rounded-full bg-gray-400" />
            <Text className="text-sm text-ink flex-1">Inbox</Text>
            {currentProjectId === null ? <Text className="text-pulse text-sm">✓</Text> : null}
          </Pressable>

          <FlatList
            data={projects}
            keyExtractor={(p) => p!.id}
            renderItem={({ item }) => {
              const p = item!;
              const on = p.id === currentProjectId;
              return (
                <Pressable
                  onPress={() => onPickProject(p.id)}
                  className="flex-row items-center gap-3 px-4 py-3 active:bg-gray-100"
                >
                  <View className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                  <Text className="text-sm text-ink flex-1" numberOfLines={1}>
                    {p.name}
                  </Text>
                  {on ? <Text className="text-pulse text-sm">✓</Text> : null}
                </Pressable>
              );
            }}
          />

          <Pressable
            onPress={onClose}
            className="mx-4 mt-3 rounded-md border border-gray-300 py-2 items-center"
            hitSlop={8}
          >
            <Text className="text-sm font-medium text-ink">Abbrechen</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TagsRow({
  taskId,
  onPress,
}: {
  taskId: string;
  onPress: () => void;
}): JSX.Element {
  const byId = useTags((s) => s.byId);
  const attachedIds = useTags((s) => s.tagsForTask[taskId]);

  useEffect(() => {
    if (attachedIds === undefined) {
      void useTags.getState().loadTagsForTask(taskId);
    }
  }, [taskId, attachedIds]);

  const tags = useMemo(
    () => (attachedIds ?? []).map((tid) => byId[tid]).filter((t) => t !== undefined),
    [attachedIds, byId],
  );

  return (
    <Pressable
      onPress={onPress}
      className="px-4 py-3 border-b border-gray-100 flex-row items-center active:bg-gray-50"
    >
      <Text className="text-xs uppercase tracking-wide text-gray-500 w-32">Tags</Text>
      <View className="flex-1 flex-row flex-wrap gap-1.5">
        {tags.length === 0 ? (
          <Text className="text-sm text-ink-muted">Keine</Text>
        ) : (
          tags.map((t) => (
            <View
              key={t!.id}
              className="flex-row items-center gap-1 bg-gray-100 rounded px-2 py-0.5"
            >
              <View
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: t!.color }}
              />
              <Text className="text-xs text-ink">{t!.name}</Text>
            </View>
          ))
        )}
      </View>
    </Pressable>
  );
}

function DescriptionSection({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (next: string | null) => void;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  function commit(): void {
    setEditing(false);
    const next = draft.trim();
    if (next === (value ?? "")) return;
    onSave(next || null);
  }

  return (
    <View className="px-4 py-3 border-b border-gray-100">
      <Text className="text-xs uppercase tracking-wide text-gray-500 pb-2">
        Beschreibung · Markdown
      </Text>
      {editing ? (
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onBlur={commit}
          multiline
          autoFocus
          placeholder="Beschreibung — Markdown erlaubt…"
          className="text-sm text-ink border border-pulse rounded p-2 min-h-[100px]"
        />
      ) : (
        <Pressable
          onPress={() => setEditing(true)}
          className="rounded border border-gray-200 p-3 bg-white"
        >
          <MarkdownView
            source={value ?? ""}
            placeholder="Antippen, um eine Beschreibung hinzuzufügen…"
          />
        </Pressable>
      )}
    </View>
  );
}

function SubtasksSection({ parent }: { parent: Task }): JSX.Element {
  const byId = useTasks((s) => s.byId);
  const byProject = useTasks((s) => s.byProject);
  const inboxIds = useTasks((s) => s.inboxIds);
  const create = useTasks((s) => s.create);
  const complete = useTasks((s) => s.complete);
  const update = useTasks((s) => s.update);

  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");

  // Subtasks live in the same store as their parent. Walk whichever index the
  // parent belongs to (project list or inbox) and filter by parentTaskId.
  const subtasks = useMemo<Task[]>(() => {
    const candidateIds = parent.projectId
      ? byProject[parent.projectId] ?? EMPTY_TASK_IDS
      : inboxIds;
    const out: Task[] = [];
    for (const id of candidateIds) {
      const t = byId[id];
      if (t && t.parentTaskId === parent.id) out.push(t);
    }
    // Also pick up subtasks that may have been loaded via other refresh paths
    // (e.g. Today list). Cheap second sweep across byId.
    for (const t of Object.values(byId)) {
      if (t.parentTaskId === parent.id && !out.includes(t)) out.push(t);
    }
    out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return out;
  }, [byId, byProject, inboxIds, parent.id, parent.projectId]);

  async function saveNew(): Promise<void> {
    const title = draft.trim();
    setComposing(false);
    setDraft("");
    if (!title) return;
    try {
      await create({
        projectId: parent.projectId,
        title,
        parentTaskId: parent.id,
      });
    } catch (e) {
      Alert.alert("Fehler", (e as Error).message);
    }
  }

  function toggleSub(t: Task): void {
    if (t.status === "done") void update(t.id, { status: "todo", completedAt: null });
    else void complete(t.id);
  }

  return (
    <View className="px-4 py-3 border-b border-gray-100">
      <View className="flex-row items-center justify-between pb-2">
        <Text className="text-xs uppercase tracking-wide text-gray-500">Unteraufgaben</Text>
        <Pressable
          onPress={() => {
            setComposing(true);
            setDraft("");
          }}
          hitSlop={8}
        >
          <Text className="text-sm text-pulse">+ Hinzufügen</Text>
        </Pressable>
      </View>

      {subtasks.length === 0 && !composing ? (
        <Text className="text-sm text-ink-muted">Keine Unteraufgaben.</Text>
      ) : null}

      {subtasks.map((t) => {
        const sdone = t.status === "done";
        return (
          <View key={t.id} className="flex-row items-center gap-3 py-2">
            <Pressable
              onPress={() => toggleSub(t)}
              hitSlop={6}
              className={`w-5 h-5 rounded border items-center justify-center ${
                sdone ? "bg-pulse border-pulse" : "border-gray-400 bg-white"
              }`}
            >
              {sdone ? <Text className="text-white text-xs">✓</Text> : null}
            </Pressable>
            <Text
              className={`flex-1 text-sm ${sdone ? "line-through text-gray-400" : "text-ink"}`}
              numberOfLines={2}
            >
              {t.title}
            </Text>
          </View>
        );
      })}

      {composing ? (
        <View className="flex-row items-center gap-2 pt-1">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onBlur={() => void saveNew()}
            onSubmitEditing={() => void saveNew()}
            autoFocus
            placeholder="Neue Unteraufgabe…"
            className="flex-1 text-sm text-ink border-b border-pulse pb-1"
          />
        </View>
      ) : null}
    </View>
  );
}

function CommentsSection({ taskId }: { taskId: string }): JSX.Element {
  const deps = useDeps();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const userId = deps.userId;
    if (!userId) {
      setComments([]);
      setLoading(false);
      return;
    }
    const all = await deps.store.listSince<Comment>("comments", null, { userId });
    const list = all
      .filter((c) => c.taskId === taskId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    setComments(list);
    setLoading(false);
  }, [deps, taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(): Promise<void> {
    const text = draft.trim();
    if (!text) return;
    const userId = deps.userId;
    if (!userId) return;
    setSending(true);
    try {
      const c = makeComment({ userId, taskId, bodyMd: text });
      await deps.store.upsert("comments", c);
      await deps.outbox.enqueue({
        entityTable: "comments",
        entityId: c.id,
        op: "insert",
        changedFields: {
          id: c.id,
          taskId: c.taskId,
          bodyMd: c.bodyMd,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          deletedAt: c.deletedAt,
        },
        clientTs: c.updatedAt,
      });
      setDraft("");
      await load();
    } catch (e) {
      Alert.alert("Fehler", (e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string): Promise<void> {
    try {
      const ts = nowIso();
      await deps.store.softDelete("comments", id, ts);
      await deps.outbox.enqueue({
        entityTable: "comments",
        entityId: id,
        op: "delete",
        changedFields: {},
        clientTs: ts,
      });
      await load();
    } catch (e) {
      Alert.alert("Fehler", (e as Error).message);
    }
  }

  return (
    <View className="px-4 py-3">
      <Text className="text-xs uppercase tracking-wide text-gray-500 pb-2">Kommentare</Text>
      {loading ? (
        <ActivityIndicator color="#2563EB" />
      ) : comments.length === 0 ? (
        <Text className="text-sm text-ink-muted pb-2">Noch keine Kommentare.</Text>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(c) => c.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View className="mb-2 rounded border border-gray-200 p-3 bg-white flex-row items-start gap-2">
              <View className="flex-1">
                <MarkdownView source={item.bodyMd} />
                <Text className="text-[10px] text-gray-400 pt-2">
                  {format(parseISO(item.createdAt), "dd. MMM yyyy · HH:mm", { locale: de })}
                </Text>
              </View>
              <Pressable
                onPress={() => void remove(item.id)}
                hitSlop={10}
                accessibilityLabel="Kommentar löschen"
                className="p-1"
              >
                <X color="#94A3B8" size={18} />
              </Pressable>
            </View>
          )}
        />
      )}

      <View className="flex-row items-end gap-2 pt-2">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          placeholder="Kommentar — Markdown erlaubt…"
          className="flex-1 text-sm text-ink border border-gray-300 rounded p-2 min-h-[40px]"
        />
        <Pressable
          onPress={() => void send()}
          disabled={!draft.trim() || sending}
          className={`px-3 py-2 rounded-md ${
            !draft.trim() || sending ? "bg-gray-300" : "bg-pulse"
          }`}
          hitSlop={6}
        >
          <Text className="text-sm font-medium text-white">Senden</Text>
        </Pressable>
      </View>
    </View>
  );
}
