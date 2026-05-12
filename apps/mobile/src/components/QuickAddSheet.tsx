import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import { parseISO, isToday, isTomorrow, isPast, isThisWeek, format } from "date-fns";
import { de } from "date-fns/locale";
import { parseQuickAdd } from "@pulse/core";
import { useProjects } from "@/stores/projects";
import { useTasks } from "@/stores/tasks";

/**
 * Quick-Add bottom sheet — translucent Modal pinned to the bottom containing
 * a TextInput and a live preview chip strip parsed by `@pulse/core`'s
 * `parseQuickAdd`. Mirrors the desktop Quick-Add window
 * (apps/desktop/src/renderer/quick-add/QuickAdd.tsx) in behaviour: the parser
 * extracts title, @project, !priority, #tags, and a chrono(de) date; submit
 * persists a task via `useTasks.create({...parsed})`. Tag attachment on submit
 * is intentionally omitted to mirror desktop's `quickAdd.submit` IPC handler
 * (apps/desktop/src/main/ipc.ts) which also drops `tagNames`. Tag chips are
 * informational only.
 *
 * If `parseQuickAdd` returns `projectId === null` and the caller supplied a
 * `defaultProjectId`, the task lands in that project; otherwise it goes to the
 * Inbox.
 */
export interface QuickAddSheetProps {
  visible: boolean;
  onClose: () => void;
  defaultProjectId?: string | null;
}

function formatDateChip(iso: string): string {
  const d = parseISO(iso);
  if (isPast(d) && !isToday(d)) return "Überfällig · " + format(d, "dd.MM.", { locale: de });
  if (isToday(d)) return "Heute · " + format(d, "HH:mm", { locale: de });
  if (isTomorrow(d)) return "Morgen · " + format(d, "HH:mm", { locale: de });
  if (isThisWeek(d, { weekStartsOn: 1 })) return format(d, "EEEE HH:mm", { locale: de });
  return format(d, "EE dd.MM. HH:mm", { locale: de });
}

export function QuickAddSheet({
  visible,
  onClose,
  defaultProjectId = null,
}: QuickAddSheetProps): JSX.Element {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const byId = useProjects((s) => s.byId);
  const order = useProjects((s) => s.order);
  const loaded = useProjects((s) => s.loaded);

  useEffect(() => {
    if (visible && !loaded) void useProjects.getState().refresh();
  }, [visible, loaded]);

  // Reset text every time the sheet opens fresh.
  useEffect(() => {
    if (visible) setText("");
  }, [visible]);

  const refs = useMemo(
    () =>
      order
        .map((id) => byId[id])
        .filter((p): p is NonNullable<typeof p> => !!p && !p.archived)
        .map((p) => ({ id: p.id, name: p.name })),
    [order, byId],
  );

  const parsed = useMemo(() => parseQuickAdd(text, refs), [text, refs]);
  const projectForChip = parsed.projectId ? byId[parsed.projectId] : null;
  const effectiveProjectId = parsed.projectId ?? defaultProjectId ?? null;
  const canSubmit = parsed.title.trim().length > 0 && !busy;

  async function onSubmit(): Promise<void> {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await useTasks.getState().create({
        projectId: effectiveProjectId,
        title: parsed.title,
        dueDate: parsed.dueDate,
        priority: parsed.priority,
      });
      setText("");
      onClose();
    } catch {
      // No toast surface on mobile yet (Task 22). Swallow per phase-3 spec.
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
      <Pressable
        onPress={onClose}
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}
      >
        <Pressable
          // Stop tap-through so taps on the card don't close the sheet.
          onPress={() => {}}
          style={{
            backgroundColor: "#FFFFFF",
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingBottom: 24,
            paddingTop: 12,
          }}
        >
          <View style={{ alignItems: "center", paddingBottom: 8 }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#D1D5DB",
              }}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingBottom: 8,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: "#0F172A",
                flex: 1,
              }}
            >
              Quick-Add
            </Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Schließen">
              <X color="#475569" size={20} />
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 16 }}>
            <TextInput
              autoFocus
              value={text}
              onChangeText={setText}
              editable={!busy}
              multiline={false}
              returnKeyType="done"
              onSubmitEditing={() => void onSubmit()}
              placeholder="Title  @projekt  !1-4  morgen 9:00  #tag"
              placeholderTextColor="#94A3B8"
              style={{
                height: 44,
                paddingHorizontal: 12,
                fontSize: 14,
                color: "#0F172A",
                borderWidth: 1,
                borderColor: "#D1D5DB",
                borderRadius: 6,
              }}
            />
            <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
              Ohne @projekt landet die Aufgabe in der Inbox
            </Text>
          </View>

          {(projectForChip || parsed.dueDate || parsed.priority < 4 || parsed.tagNames.length > 0) && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, gap: 6 }}
            >
              {projectForChip && (
                <View
                  className="flex-row items-center rounded-full px-2.5 py-1"
                  style={{ backgroundColor: (projectForChip.color ?? "#94A3B8") + "22" }}
                >
                  <View
                    className="w-2 h-2 rounded-full mr-1.5"
                    style={{ backgroundColor: projectForChip.color ?? "#94A3B8" }}
                  />
                  <Text className="text-xs text-ink">{projectForChip.name}</Text>
                </View>
              )}
              {parsed.dueDate && (
                <View className="rounded-full bg-blue-100 px-2.5 py-1">
                  <Text className="text-xs text-blue-700">
                    {formatDateChip(parsed.dueDate)}
                  </Text>
                </View>
              )}
              {parsed.priority < 4 && (
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{
                    backgroundColor:
                      parsed.priority === 1
                        ? "#FEE2E2"
                        : parsed.priority === 2
                          ? "#FFEDD5"
                          : "#FEF9C3",
                  }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{
                      color:
                        parsed.priority === 1
                          ? "#B91C1C"
                          : parsed.priority === 2
                            ? "#C2410C"
                            : "#A16207",
                    }}
                  >
                    P{parsed.priority}
                  </Text>
                </View>
              )}
              {parsed.tagNames.map((name) => (
                <View
                  key={`tag:${name}`}
                  className="rounded-full bg-gray-100 px-2.5 py-1"
                >
                  <Text className="text-xs text-ink-muted">#{name}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <Pressable
              disabled={!canSubmit}
              onPress={() => void onSubmit()}
              style={{
                borderRadius: 6,
                paddingVertical: 12,
                alignItems: "center",
                backgroundColor: canSubmit ? "#2563EB" : "#D1D5DB",
              }}
              accessibilityLabel="Aufgabe anlegen"
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#FFFFFF" }}>
                Anlegen
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
