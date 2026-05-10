import { app } from "electron";
import { config as loadEnv } from "dotenv";
import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createMainWindow } from "./window.js";
import { buildDeps, type AppDeps } from "./deps.js";
import { registerIpc } from "./ipc.js";
import { registerHotkeys } from "./hotkey.js";
import { setupTray } from "./tray.js";
import { setupNotifications } from "./notifications.js";
import { setupUpdater } from "./updater.js";
import { setUpdater } from "./updater-ref.js";

// Disk-based boot tracing for cases where stdout/stderr is not captured
// (packaged Electron GUI app on Windows). Writes one line per lifecycle step.
const traceLog = join(app.getPath("userData"), "boot-trace.log");
function trace(line: string): void {
  try {
    appendFileSync(traceLog, `${new Date().toISOString()} ${line}\n`);
  } catch { /* userData not writable yet — ignore */ }
}

trace("--- main module loaded ---");
process.on("uncaughtException", (e) => trace(`uncaughtException: ${e.stack ?? e}`));
process.on("unhandledRejection", (r) => trace(`unhandledRejection: ${r}`));

// Load .env from likely locations (dev: repo root, packaged: userData/.env).
const envCandidates = [
  join(process.cwd(), ".env"),
  join(process.cwd(), "..", "..", ".env"),
  join(app.getPath("userData"), ".env"),
];
for (const path of envCandidates) {
  if (existsSync(path)) {
    loadEnv({ path, override: false });
    trace(`loaded env from ${path}`);
  }
}
trace(`SUPABASE_URL=${process.env.SUPABASE_URL ?? "<unset>"}, SUPABASE_ANON_KEY=${process.env.SUPABASE_ANON_KEY ? "<set>" : "<empty>"}`);

let win: ReturnType<typeof createMainWindow> | null = null;
let deps: AppDeps | null = null;

void app.whenReady().then(() => {
  trace("whenReady fired");
  try {
    deps = buildDeps();
    trace("buildDeps OK");
    win = createMainWindow();
    trace("createMainWindow OK");
    registerIpc(deps, () => win);
    trace("registerIpc OK");
    setupTray(() => win);
    trace("setupTray OK");
    setupNotifications(deps, () => win);
    trace("setupNotifications OK");
    const updater = setupUpdater(() => win);
    setUpdater(updater);
    trace("setupUpdater OK");
    registerHotkeys(() => win);
    trace("registerHotkeys OK — boot complete");
  } catch (e) {
    trace(`whenReady BOOT FAIL: ${(e as Error).stack ?? (e as Error).message}`);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
