/**
 * Integration smoke test for buildDeps() wiring.
 *
 * Mocks: expo-sqlite (better-sqlite3 in-memory), expo-secure-store (Map),
 *        expo-constants (stub config), react-native-mmkv (Map), @supabase/supabase-js (stub).
 */

import { buildDeps } from "@/wiring/deps";
import { SyncEngine } from "@pulse/core";

describe("buildDeps()", () => {
  it("resolves without throwing", async () => {
    await expect(buildDeps()).resolves.toBeDefined();
  });

  it("returns non-null core services", async () => {
    const deps = await buildDeps();
    expect(deps.db).toBeTruthy();
    expect(deps.store).toBeTruthy();
    expect(deps.stateRepo).toBeTruthy();
    expect(deps.outbox).toBeTruthy();
    expect(deps.supabase).toBeTruthy();
    expect(deps.auth).toBeTruthy();
  });

  it("engine is null before setUserId", async () => {
    const deps = await buildDeps();
    expect(deps.engine).toBeNull();
  });

  it("engine is a SyncEngine instance after setUserId", async () => {
    const deps = await buildDeps();
    deps.setUserId("u1");
    expect(deps.engine).not.toBeNull();
    expect(deps.engine).toBeInstanceOf(SyncEngine);
  });

  it("store.upsert works end-to-end (schema bootstrapped)", async () => {
    const deps = await buildDeps();
    const now = new Date().toISOString();
    await expect(
      deps.store.upsert("projects", {
        id: "proj-smoke-1",
        userId: "u1",
        name: "Smoke Project",
        color: "#4F46E5",
        archived: false,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }),
    ).resolves.not.toThrow();
  });
});
