// Minimal Electron stub for unit tests running in Node (no Electron binary)

export class Notification {
  constructor(_opts?: unknown) {}
  on(_event: string, _fn: unknown) { return this; }
  show() {}
}

export const powerMonitor = {
  on: (_event: string, _fn: unknown) => {},
  off: (_event: string, _fn: unknown) => {},
};

export const app = {
  getPath: () => "/tmp",
  quit: () => {},
};

export const ipcMain = {
  handle: () => {},
  on: () => {},
};

export const BrowserWindow = class {
  show() {}
  webContents = { send: () => {} };
};
