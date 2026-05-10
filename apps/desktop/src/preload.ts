import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("pulse", {
  // populated incrementally in later tasks
  ping: () => "pong",
});
