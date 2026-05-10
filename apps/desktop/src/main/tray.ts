import { app, Tray, Menu, nativeImage } from "electron";
import { join } from "node:path";
import { showQuickAddWindow } from "./window.js";

let tray: Tray | null = null;
let lastCount = 0;

export function setupTray(getWin: () => Electron.BrowserWindow | null): void {
  const iconPath = join(app.getAppPath(), "assets", "tray-default.png");
  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip("Pulse Project Planner");
  tray.on("click", () => {
    const win = getWin();
    if (!win) return;
    win.isVisible() ? win.hide() : win.show();
  });
  rebuildMenu(getWin);
}

export function updateTrayCount(todayCount: number): void {
  lastCount = todayCount;
  if (!tray) return;
  tray.setToolTip(`Pulse Project Planner · ${todayCount} Task${todayCount === 1 ? "" : "s"} heute`);
}

function rebuildMenu(getWin: () => Electron.BrowserWindow | null): void {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: "Pulse Project Planner öffnen", click: () => getWin()?.show() },
    { label: "Quick Add (Ctrl+Shift+Space)", click: () => showQuickAddWindow() },
    { type: "separator" },
    { label: `Today (${lastCount})`, click: () => { const w = getWin(); if (w) { w.show(); w.webContents.send("nav.today"); } } },
    { type: "separator" },
    { label: "Beenden", click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}
