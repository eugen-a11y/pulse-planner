import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { PulseEvent } from "./main/ipc-types.js";

const invoke = (channel: string) => (...args: unknown[]) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld("pulse", {
  // Electron 32+ removed File.path. Renderers must call webUtils.getPathForFile
  // (which exists only in main/preload context) to resolve a dropped file's
  // absolute path, then send it through IPC to the main process.
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  auth: {
    signIn: invoke("auth.signIn"),
    signUp: invoke("auth.signUp"),
    signOut: invoke("auth.signOut"),
    restoreSession: invoke("auth.restoreSession"),
    deleteAccount: invoke("auth.deleteAccount"),
    resetPasswordForEmail: invoke("auth.resetPasswordForEmail"),
  },
  prefs: {
    get: invoke("prefs.get"),
    set: invoke("prefs.set"),
  },
  projects: {
    list: invoke("projects.list"),
    create: invoke("projects.create"),
    update: invoke("projects.update"),
    delete: invoke("projects.delete"),
  },
  tasks: {
    list: invoke("tasks.list"),
    listToday: invoke("tasks.listToday"),
    listUpcoming: invoke("tasks.listUpcoming"),
    listInbox: invoke("tasks.listInbox"),
    tagsForTask: invoke("tasks.tagsForTask"),
    create: invoke("tasks.create"),
    update: invoke("tasks.update"),
    delete: invoke("tasks.delete"),
    complete: invoke("tasks.complete"),
  },
  tags: {
    list: invoke("tags.list"),
    create: invoke("tags.create"),
    delete: invoke("tags.delete"),
    attach: invoke("tags.attach"),
    detach: invoke("tags.detach"),
  },
  notes: {
    listForTask: invoke("notes.listForTask"),
    listForProject: invoke("notes.listForProject"),
    create: invoke("notes.create"),
    update: invoke("notes.update"),
    delete: invoke("notes.delete"),
  },
  comments: {
    listForTask: invoke("comments.listForTask"),
    create: invoke("comments.create"),
    update: invoke("comments.update"),
    delete: invoke("comments.delete"),
  },
  attachments: {
    listForTask: invoke("attachments.listForTask"),
    upload: invoke("attachments.upload"),
    openLocally: invoke("attachments.openLocally"),
    delete: invoke("attachments.delete"),
  },
  time_entries: {
    listForTask: invoke("time_entries.listForTask"),
    start: invoke("time_entries.start"),
    stop: invoke("time_entries.stop"),
  },
  sync: {
    pushNow: invoke("sync.pushNow"),
    pullNow: invoke("sync.pullNow"),
  },
  timer: {
    current: invoke("timer.current"),
  },
  quickAdd: {
    show: () => ipcRenderer.send("quickAdd.show"),
    parse: invoke("quickAdd.parse"),
    submit: invoke("quickAdd.submit"),
  },
  notifications: {
    snooze: invoke("notifications.snooze"),
  },
  updater: {
    check: invoke("updater.check"),
    installAndRestart: () => ipcRenderer.send("updater.installAndRestart"),
  },
  events: {
    on: (channel: PulseEvent, cb: (data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => cb(data);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
  },
  _tray: {
    setCount: invoke("tray.setCount"),
  },
});
