import { app } from "electron";
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createMainWindow } from "./window.js";
import { buildDeps, type AppDeps } from "./deps.js";
import { registerIpc } from "./ipc.js";
import { registerHotkeys } from "./hotkey.js";
import { setupTray } from "./tray.js";
import { setupNotifications } from "./notifications.js";
import { setupUpdater } from "./updater.js";
import { setUpdater } from "./updater-ref.js";

// Load .env from likely locations (dev: repo root, packaged: userData/.env).
// First match wins; later calls don't override existing env vars.
const envCandidates = [
  join(process.cwd(), ".env"),                   // running from apps/desktop
  join(process.cwd(), "..", "..", ".env"),       // running from apps/desktop, repo root
  join(app.getPath("userData"), ".env"),         // packaged: %APPDATA%/Pulse/.env
];
for (const path of envCandidates) {
  if (existsSync(path)) {
    loadEnv({ path, override: false });
  }
}

let win: ReturnType<typeof createMainWindow> | null = null;
let deps: AppDeps | null = null;

void app.whenReady().then(() => {
  deps = buildDeps();
  win = createMainWindow();
  registerIpc(deps, () => win);
  setupTray(() => win);
  setupNotifications(deps, () => win);
  const updater = setupUpdater(() => win);
  setUpdater(updater);
  registerHotkeys(() => win);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
