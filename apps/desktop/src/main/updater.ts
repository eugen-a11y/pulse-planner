import * as updaterPkg from "electron-updater";
// CJS-interop: depending on bundler/runtime, `autoUpdater` may live on
// the namespace object or on `default`.
const autoUpdater =
  (updaterPkg as { autoUpdater?: typeof updaterPkg.autoUpdater }).autoUpdater
  ?? ((updaterPkg as unknown as { default: { autoUpdater: typeof updaterPkg.autoUpdater } }).default?.autoUpdater);
import type { BrowserWindow } from "electron";
import type { UpdateInfo as PulseUpdateInfo } from "./ipc-types.js";

export function setupUpdater(getWin: () => BrowserWindow | null): {
  check: () => Promise<PulseUpdateInfo | null>;
  installAndRestart: () => void;
} {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("download-progress", (progress) => {
    getWin()?.webContents.send("updater.progress", progress.percent);
  });

  autoUpdater.on("update-downloaded", (info) => {
    getWin()?.webContents.send("updater.downloaded", info.version);
  });

  autoUpdater.on("error", (err) => {
    getWin()?.webContents.send("toast.show", `Update-Fehler: ${err.message}`);
  });

  // Poll every 6 hours
  setInterval(() => {
    void autoUpdater.checkForUpdates().catch(() => {});
  }, 6 * 3600 * 1000);
  // Initial check shortly after start
  setTimeout(() => { void autoUpdater.checkForUpdates().catch(() => {}); }, 30_000);

  return {
    check: async () => {
      try {
        const result = await autoUpdater.checkForUpdates();
        if (!result?.updateInfo) return null;
        const notes = typeof result.updateInfo.releaseNotes === "string"
          ? result.updateInfo.releaseNotes
          : undefined;
        const info: PulseUpdateInfo = { version: result.updateInfo.version };
        if (notes !== undefined) info.releaseNotes = notes;
        return info;
      } catch { return null; }
    },
    installAndRestart: () => {
      autoUpdater.quitAndInstall();
    },
  };
}
