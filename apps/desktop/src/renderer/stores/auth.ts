import { create } from "zustand";
import type { PulseSession } from "@pulse/core";
import { api } from "../api.js";

interface AuthState {
  session: PulseSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  restore: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  session: null,
  loading: true,
  async signIn(email, password) {
    const session = await api.auth.signIn(email, password);
    set({ session, loading: false });
  },
  async signUp(email, password) {
    const session = await api.auth.signUp(email, password);
    set({ session, loading: false });
  },
  async signOut() {
    await api.auth.signOut();
    set({ session: null });
  },
  async restore() {
    const session = await api.auth.restoreSession();
    set({ session, loading: false });
  },
}));
