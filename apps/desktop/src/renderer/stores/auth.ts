import { create } from "zustand";
import type { PulseSession } from "@pulse/core";
import { api } from "../api.js";

interface AuthState {
  session: PulseSession | null;
  loading: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signUp: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  restore: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  session: null,
  loading: true,
  async signIn(email, password, rememberMe = false) {
    const session = await api.auth.signIn(email, password, rememberMe);
    set({ session, loading: false });
  },
  async signUp(email, password, rememberMe = false) {
    const session = await api.auth.signUp(email, password, rememberMe);
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
