import { BrowserWindow, app } from "electron";
import { join } from "node:path";

// vite-plugin-electron bundles this file; emitted at dist-electron/main/.
// Use app.getAppPath() (= apps/desktop/) as a stable anchor regardless of bundle layout.
function dist(...segments: string[]): string {
  return join(app.getAppPath(), "dist-electron", ...segments);
}
function rendererDist(...segments: string[]): string {
  return join(app.getAppPath(), "dist", "renderer", ...segments);
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: dist("preload", "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(rendererDist("index.html"));
  }
  win.once("ready-to-show", () => win.show());
  return win;
}

let quickAddWin: BrowserWindow | null = null;

export function showQuickAddWindow(): BrowserWindow {
  if (quickAddWin && !quickAddWin.isDestroyed()) {
    quickAddWin.show(); quickAddWin.focus();
    return quickAddWin;
  }
  quickAddWin = new BrowserWindow({
    width: 600, height: 120,
    frame: false, resizable: false,
    center: true, alwaysOnTop: false, show: false,
    webPreferences: {
      preload: dist("preload", "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    void quickAddWin.loadURL(process.env.VITE_DEV_SERVER_URL + "src/renderer/quick-add/index.html");
  } else {
    void quickAddWin.loadFile(rendererDist("quick-add", "index.html"));
  }
  quickAddWin.once("ready-to-show", () => { quickAddWin?.show(); quickAddWin?.focus(); });
  quickAddWin.on("blur", () => { quickAddWin?.hide(); });
  quickAddWin.on("closed", () => { quickAddWin = null; });
  return quickAddWin;
}

export function hideQuickAdd(): void {
  if (quickAddWin && !quickAddWin.isDestroyed()) quickAddWin.hide();
}
