import type { PulseApi } from "../main/ipc-types.js";

declare global {
  interface Window {
    pulse: PulseApi;
  }
}

export const api: PulseApi = window.pulse;
