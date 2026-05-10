import type { PulseApi } from "../main/ipc-types.js";

declare global {
  interface Window {
    pulse: PulseApi;
  }
}

export const api: PulseApi = window.pulse;

export function reportTodayCount(n: number): void {
  void (window as any).pulse._tray?.setCount?.(n);
}

api.events.on("toast.show", (text) => {
  // Lazy import to avoid cycles
  void import("./components/ui/toast.js").then(({ useToasts }) => useToasts.getState().push(String(text), "info"));
});

api.events.on("nav.today", () => {
  void import("./stores/ui.js").then(({ useUi }) => useUi.getState().setView({ kind: "today" }));
});
