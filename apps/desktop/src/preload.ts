import { contextBridge, ipcRenderer } from "electron";
import type { PulseEvent } from "./main/ipc-types.js";

const invoke = (channel: string) => (...args: unknown[]) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld("pulse", {
  auth: {
    signIn: invoke("auth.signIn"),
    signUp: invoke("auth.signUp"),
    signOut: invoke("auth.signOut"),
    restoreSession: invoke("auth.restoreSession"),
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
    create: invoke("tasks.create"),
    update: invoke("tasks.update"),
    delete: invoke("tasks.delete"),
    complete: invoke("tasks.complete"),
  },
  tags: {
    list: invoke("tags.list"),
    create: invoke("tags.create"),
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
});
