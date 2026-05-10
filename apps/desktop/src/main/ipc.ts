import { ipcMain } from "electron";
import type { AppDeps } from "./deps.js";

export function registerIpc(deps: AppDeps): void {
  ipcMain.handle("auth.signIn", async (_e, email: string, password: string) => {
    const session = await deps.auth.signIn(email, password);
    deps.setUserId(session.user.id);
    return session;
  });

  ipcMain.handle("auth.signUp", async (_e, email: string, password: string) => {
    const session = await deps.auth.signUp(email, password);
    deps.setUserId(session.user.id);
    return session;
  });

  ipcMain.handle("auth.signOut", async () => {
    await deps.auth.signOut();
    deps.engine = null;
  });

  ipcMain.handle("auth.restoreSession", async () => {
    const session = await deps.auth.restoreSession();
    if (session) deps.setUserId(session.user.id);
    return session;
  });
}
