import { app, globalShortcut } from "electron";
import { showQuickAddWindow } from "./window.js";
import { useToastViaIpc } from "./hotkey-toast.js";

const HOTKEY = "Control+Shift+Space";

export function registerHotkeys(getWin: () => Electron.BrowserWindow | null): void {
  app.whenReady().then(() => {
    const ok = globalShortcut.register(HOTKEY, () => showQuickAddWindow());
    if (!ok) {
      const win = getWin();
      win?.webContents.send("toast.show", `Hotkey ${HOTKEY} ist belegt — öffne Pulse Project Planner über das Tray-Icon.`);
    }
    useToastViaIpc();
  });
  app.on("will-quit", () => globalShortcut.unregisterAll());
}
