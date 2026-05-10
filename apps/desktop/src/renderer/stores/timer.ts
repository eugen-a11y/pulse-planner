import { create } from "zustand";
import { api } from "../api.js";

interface TimerState {
  current: { taskId: string; startedAt: string } | null;
  refresh(): Promise<void>;
}

export const useTimer = create<TimerState>((set) => ({
  current: null,
  async refresh() {
    set({ current: await api.timer.current() });
  },
}));

api.events.on("timer.current", (data) => {
  useTimer.setState({ current: data as TimerState["current"] });
});
