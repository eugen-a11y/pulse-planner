/**
 * Best-effort debug log persisted to `documentDirectory/pulse-debug.log`.
 *
 * Used by:
 *   - BackgroundFetch task (no console / no Zustand available)
 *   - SettingsScreen "Log exportieren" action (Task 18 export bundle)
 *
 * Contract: NEVER throws. Every write/read is wrapped in try/catch and a
 * failure is silently swallowed — the log is diagnostic, not load-bearing.
 *
 * Rotation: the file is truncated to its last ~MAX_BYTES/2 bytes once it
 * grows past MAX_BYTES (64KB). Simple, no rolling index files. Good enough
 * for a debug surface that ships a few lines per background-fetch tick.
 */

import * as FileSystem from "expo-file-system";

const LOG_FILE = (FileSystem.documentDirectory ?? "") + "pulse-debug.log";
const MAX_BYTES = 64 * 1024;

export async function appendDebugLog(line: string): Promise<void> {
  try {
    const ts = new Date().toISOString();
    const entry = `${ts} ${line}\n`;
    const info = await FileSystem.getInfoAsync(LOG_FILE);
    if (!info.exists) {
      await FileSystem.writeAsStringAsync(LOG_FILE, entry);
      return;
    }
    if ((info.size ?? 0) > MAX_BYTES) {
      // Truncate: keep last half + the new entry.
      const old = await FileSystem.readAsStringAsync(LOG_FILE);
      const kept = old.slice(Math.floor(old.length / 2));
      await FileSystem.writeAsStringAsync(LOG_FILE, kept + entry);
      return;
    }
    const existing = await FileSystem.readAsStringAsync(LOG_FILE);
    await FileSystem.writeAsStringAsync(LOG_FILE, existing + entry);
  } catch {
    // swallow — debug log is best-effort
  }
}

export async function readDebugLog(): Promise<string> {
  try {
    const info = await FileSystem.getInfoAsync(LOG_FILE);
    if (!info.exists) return "";
    return await FileSystem.readAsStringAsync(LOG_FILE);
  } catch {
    return "";
  }
}
