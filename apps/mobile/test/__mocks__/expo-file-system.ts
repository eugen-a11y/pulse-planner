/**
 * In-memory mock for `expo-file-system` covering only the surface
 * `apps/mobile/src/platform/WidgetData.ts` consumes.
 *
 * The real module is a thin wrapper around iOS NSFileManager (Swift) / Android
 * java.io.File, neither of which run in Node. We model the bits the widget
 * snapshot writer needs: documentDirectory, getInfoAsync, makeDirectoryAsync,
 * writeAsStringAsync, readAsStringAsync.
 */

const files = new Map<string, string>();
const dirs = new Set<string>();

export const documentDirectory = "file:///mock/documents/";

export async function getInfoAsync(uri: string): Promise<{ exists: boolean; isDirectory?: boolean }> {
  if (dirs.has(uri)) return { exists: true, isDirectory: true };
  if (files.has(uri)) return { exists: true, isDirectory: false };
  return { exists: false };
}

export async function makeDirectoryAsync(
  uri: string,
  _opts?: { intermediates?: boolean },
): Promise<void> {
  dirs.add(uri);
}

export async function writeAsStringAsync(uri: string, content: string): Promise<void> {
  files.set(uri, content);
}

export async function readAsStringAsync(uri: string): Promise<string> {
  const v = files.get(uri);
  if (v === undefined) throw new Error(`ENOENT: ${uri}`);
  return v;
}

// Test helpers (not part of the real API).
export function __reset(): void {
  files.clear();
  dirs.clear();
}
export function __dump(): { files: Map<string, string>; dirs: Set<string> } {
  return { files, dirs };
}
