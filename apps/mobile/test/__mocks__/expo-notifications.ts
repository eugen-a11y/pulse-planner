/**
 * Manual mock for `expo-notifications`.
 *
 * Backed by an in-memory list — no native bindings needed in Node tests.
 * Mirrors only the surface the app's `ExpoNotifications` adapter touches.
 */

type Trigger = { date: Date | number };

interface Scheduled {
  identifier: string;
  content: { title: string; body?: string; data?: Record<string, unknown>; categoryIdentifier?: string };
  trigger: Trigger;
}

const scheduled: Scheduled[] = [];
let counter = 0;
let permissionsStatus: "granted" | "denied" | "undetermined" = "granted";
const listeners: Array<(resp: unknown) => void> = [];

export function setNotificationHandler(_handler: unknown): void {
  // no-op
}

export async function setNotificationCategoryAsync(_id: string, _actions: unknown[]): Promise<void> {
  // no-op
}

export async function getPermissionsAsync(): Promise<{ status: typeof permissionsStatus }> {
  return { status: permissionsStatus };
}

export async function requestPermissionsAsync(): Promise<{ status: typeof permissionsStatus }> {
  return { status: permissionsStatus };
}

export async function scheduleNotificationAsync(input: {
  content: Scheduled["content"];
  trigger: Trigger;
}): Promise<string> {
  const identifier = `n${++counter}`;
  scheduled.push({ identifier, content: input.content, trigger: input.trigger });
  return identifier;
}

export async function cancelScheduledNotificationAsync(identifier: string): Promise<void> {
  const i = scheduled.findIndex((s) => s.identifier === identifier);
  if (i >= 0) scheduled.splice(i, 1);
}

export async function cancelAllScheduledNotificationsAsync(): Promise<void> {
  scheduled.length = 0;
}

export async function getAllScheduledNotificationsAsync(): Promise<Scheduled[]> {
  return scheduled.slice();
}

export async function getLastNotificationResponseAsync(): Promise<unknown | null> {
  return null;
}

export function addNotificationResponseReceivedListener(
  listener: (resp: unknown) => void,
): { remove: () => void } {
  listeners.push(listener);
  return {
    remove: () => {
      const i = listeners.indexOf(listener);
      if (i >= 0) listeners.splice(i, 1);
    },
  };
}

// Test helpers (not part of the public API but handy if a future test wants them).
export function __reset(): void {
  scheduled.length = 0;
  listeners.length = 0;
  counter = 0;
  permissionsStatus = "granted";
}

// Type stubs so the adapter's TS compiles.
export type DateTriggerInput = { date: Date };
