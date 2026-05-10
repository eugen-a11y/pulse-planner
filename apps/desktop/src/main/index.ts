import { app } from "electron";
import { createMainWindow } from "./window.js";
import { buildDeps, type AppDeps } from "./deps.js";
import { registerIpc } from "./ipc.js";
import { registerHotkeys } from "./hotkey.js";

let win: ReturnType<typeof createMainWindow> | null = null;
let deps: AppDeps | null = null;

void app.whenReady().then(() => {
  deps = buildDeps();
  win = createMainWindow();
  registerIpc(deps, () => win);
  registerHotkeys(() => win);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
