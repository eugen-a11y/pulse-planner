import type { PulseApi } from "../main/ipc-types.js";

declare global {
  interface Window {
    pulse: PulseApi;
  }
}

export const api: PulseApi = window.pulse;

api.events.on("toast.show", (text) => {
  // Lazy import to avoid cycles
  void import("./components/ui/toast.js").then(({ useToasts }) => useToasts.getState().push(String(text), "info"));
});
