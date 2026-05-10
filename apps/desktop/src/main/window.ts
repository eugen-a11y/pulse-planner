import { BrowserWindow, app } from "electron";
import { appendFileSync } from "node:fs";
import { join } from "node:path";

// vite-plugin-electron bundles this file; emitted at dist-electron/main/.
// Use app.getAppPath() (= apps/desktop/) as a stable anchor regardless of bundle layout.
function dist(...segments: string[]): string {
  return join(app.getAppPath(), "dist-electron", ...segments);
}
function rendererDist(...segments: string[]): string {
  return join(app.getAppPath(), "dist", "renderer", ...segments);
}

const traceLog = (): string => join(app.getPath("userData"), "boot-trace.log");
function trace(line: string): void {
  try { appendFileSync(traceLog(), `${new Date().toISOString()} [window] ${line}\n`); } catch { /* */ }
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

  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    trace(`did-fail-load code=${code} desc="${desc}" url=${url}`);
    win.show();
  });
  win.webContents.on("render-process-gone", (_e, details) => {
    trace(`render-process-gone reason=${details.reason} exitCode=${details.exitCode}`);
  });
  win.webContents.on("preload-error", (_e, path, err) => {
    trace(`preload-error path=${path} err=${err.message}`);
  });
  win.webContents.on("did-finish-load", () => trace("did-finish-load"));
  win.webContents.on("dom-ready", () => trace("dom-ready"));

  const indexPath = rendererDist("index.html");
  trace(`createMainWindow loadFile path=${indexPath}`);
  if (process.env.VITE_DEV_SERVER_URL) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL).then(() => trace("dev loadURL ok")).catch((e) => trace(`dev loadURL fail: ${e.message}`));
  } else {
    void win.loadFile(indexPath).then(() => trace("loadFile ok")).catch((e) => trace(`loadFile fail: ${e.message}`));
  }
  win.once("ready-to-show", () => { trace("ready-to-show fired"); win.show(); });
  setTimeout(() => {
    if (!win.isDestroyed()) {
      trace(`3s timeout: isVisible=${win.isVisible()} isDestroyed=${win.isDestroyed()}`);
      if (!win.isVisible()) {
        win.show();
        win.webContents.openDevTools({ mode: "detach" });
      }
    }
  }, 3000);
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
