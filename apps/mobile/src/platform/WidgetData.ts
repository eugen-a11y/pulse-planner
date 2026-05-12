/**
 * App-Group snapshot writer for the iOS Today widget.
 *
 * Writes a JSON file `today_snapshot.json` into the shared App-Group container
 * (`group.me.reinfeld.pulse`) that the SwiftUI widget (`targets/TodayWidget`)
 * reads on its next timeline refresh.
 *
 * --- iOS path caveats ----------------------------------------------------
 * `expo-file-system`'s `documentDirectory` is sandbox-scoped to the *app*
 * container, not the App-Group container. iOS exposes the group container
 * via `NSFileManager.containerURL(forSecurityApplicationGroupIdentifier:)`
 * on the native side; from JS we synthesize a sibling path by traversing
 * `../AppGroup/<group>/` relative to `documentDirectory`.
 *
 * In Expo SDK 52 dev-client this only works because `@bacons/apple-targets`
 * generates the group entitlement at prebuild and the synthesised relative
 * path resolves through the sandbox jailbreak that the entitlement permits.
 * In Expo SDK 53+ the new sandbox-strict FileSystem API may require a tiny
 * native module wrapping the `containerURL(...)` call. For now we keep the
 * relative-path form, which is what every community sample uses (e.g.
 * https://github.com/EvanBacon/expo-apple-targets samples).
 *
 * --- Reload --------------------------------------------------------------
 * `WidgetCenter.shared.reloadAllTimelines()` is a native call. v1 does NOT
 * ship a native module for it; iOS picks up the new file on its next
 * timeline tick (~30 min, per Provider's `.after(now + 30 min)` policy).
 * Follow-up Task 21+ may add an Expo module that calls `[WidgetCenter ...]`.
 */

import * as FileSystem from "expo-file-system";

const APP_GROUP_PATH = `${FileSystem.documentDirectory}../AppGroup/group.me.reinfeld.pulse/`;
const SNAPSHOT = APP_GROUP_PATH + "today_snapshot.json";

export interface WidgetSnapshotTask {
  id: string;
  title: string;
  due: string | null;
  projectColor: string | null;
}

export interface WidgetSnapshot {
  generatedAt: string;
  tasks: WidgetSnapshotTask[];
}

/** Minimal task shape consumed by `buildTodaySnapshot`. Matches `Task` from `@pulse/core`. */
export interface SnapshotTaskInput {
  id: string;
  title: string;
  dueDate: string | null;
  status: string;
  deletedAt: string | null;
  projectId: string | null;
}

/** Minimal project shape consumed by `buildTodaySnapshot`. */
export interface SnapshotProjectInput {
  id: string;
  color: string | null;
}

export interface BuildSnapshotInput {
  now: Date;
  tasks: SnapshotTaskInput[];
  projects: SnapshotProjectInput[];
  /** Default 5. */
  maxItems?: number;
}

/**
 * Pure selector: builds the widget snapshot from raw store state.
 *
 *  - filters: status !== "done", deletedAt === null, dueDate <= end-of-today
 *  - sort: overdue (due < now) first, then by dueDate asc
 *  - cap: maxItems (default 5)
 *  - maps projectColor from `projects` by id (null if no project / missing)
 */
export function buildTodaySnapshot(input: BuildSnapshotInput): WidgetSnapshot {
  const max = input.maxItems ?? 5;
  const now = input.now;

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const cutoff = todayEnd.toISOString();
  const nowIso = now.toISOString();

  const projectColorById = new Map<string, string | null>();
  for (const p of input.projects) projectColorById.set(p.id, p.color);

  const eligible = input.tasks.filter(
    (t) =>
      t.status !== "done" &&
      t.deletedAt === null &&
      t.dueDate !== null &&
      t.dueDate <= cutoff,
  );

  eligible.sort((a, b) => {
    const aOver = (a.dueDate as string) < nowIso ? 0 : 1;
    const bOver = (b.dueDate as string) < nowIso ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    return (a.dueDate as string).localeCompare(b.dueDate as string);
  });

  const tasks: WidgetSnapshotTask[] = eligible.slice(0, max).map((t) => ({
    id: t.id,
    title: t.title,
    due: t.dueDate,
    projectColor: t.projectId ? projectColorById.get(t.projectId) ?? null : null,
  }));

  return {
    generatedAt: nowIso,
    tasks,
  };
}

/**
 * Persist a snapshot to the App-Group container. Never throws — failures are
 * logged via console.warn so a widget-write error can't crash a Zustand action
 * (the call sites in `tasks.ts` and `_layout.tsx` rely on this contract).
 */
export async function writeSnapshot(snap: WidgetSnapshot): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(APP_GROUP_PATH);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(APP_GROUP_PATH, { intermediates: true });
    }
    await FileSystem.writeAsStringAsync(SNAPSHOT, JSON.stringify(snap));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[WidgetData] writeSnapshot failed:", (e as Error).message);
  }
}

/**
 * Read the snapshot back from the App-Group container. Returns null when no
 * snapshot exists yet, or when the file is unreadable/corrupt. Used by tests
 * and any future "what's currently displayed in the widget" debug view.
 */
export async function readSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const info = await FileSystem.getInfoAsync(SNAPSHOT);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(SNAPSHOT);
    return JSON.parse(raw) as WidgetSnapshot;
  } catch {
    return null;
  }
}

/**
 * Trigger WidgetCenter.reloadAllTimelines() on iOS. v1 is a no-op: we don't
 * ship a native module for the call. iOS will pick up the new file on its
 * next timeline tick (Provider uses `.after(now + 30 min)`).
 *
 * Follow-up: add an Expo native module wrapping
 *   `[WidgetCenter.shared reloadAllTimelinesWithCompletionHandler:nil]`
 * and call it here.
 */
export async function reloadWidget(): Promise<void> {
  // intentionally empty
}
