import { BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(join(__dirname, "..", "..", "renderer", "index.html"));
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
      preload: join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    void quickAddWin.loadURL(process.env.VITE_DEV_SERVER_URL + "src/renderer/quick-add/index.html");
  } else {
    void quickAddWin.loadFile(join(__dirname, "..", "..", "renderer", "quick-add", "index.html"));
  }
  quickAddWin.once("ready-to-show", () => { quickAddWin?.show(); quickAddWin?.focus(); });
  quickAddWin.on("blur", () => { quickAddWin?.hide(); });
  quickAddWin.on("closed", () => { quickAddWin = null; });
  return quickAddWin;
}

export function hideQuickAdd(): void {
  if (quickAddWin && !quickAddWin.isDestroyed()) quickAddWin.hide();
}
