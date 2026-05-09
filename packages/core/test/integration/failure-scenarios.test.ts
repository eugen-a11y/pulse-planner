import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeProject, makeTask, nowIso } from "../../src/index.js";
import { createTestUser, deleteTestUser, uniqueEmail } from "./helpers/supabase-test.js";
import { buildSignedInClient } from "./helpers/client.js";

const PASSWORD = "test-password-123";
let userId: string;
const email = uniqueEmail("failures");

beforeAll(async () => { userId = await createTestUser(email, PASSWORD); });
afterAll(async () => { await deleteTestUser(userId); });

describe("initial sync on a fresh device", () => {
  it("pulls all non-deleted rows for the user", async () => {
    const a = await buildSignedInClient(email, PASSWORD);
    const project = makeProject({ userId, name: "Init" });
    await a.outbox.enqueue({
      entityTable: "projects", entityId: project.id, op: "insert",
      changedFields: {
        id: project.id, name: project.name, color: project.color,
        archived: project.archived, sortOrder: project.sortOrder,
        createdAt: project.createdAt, updatedAt: project.updatedAt,
        deletedAt: project.deletedAt,
      },
      clientTs: project.updatedAt,
    });
    await a.engine.push();

    // Fresh client
    const b = await buildSignedInClient(email, PASSWORD);
    expect(await b.store.findById("projects", project.id)).toBeNull();
    await b.engine.pull(null);
    const got = await b.store.findById<any>("projects", project.id);
    expect(got?.name).toBe("Init");
  });

  it("does not pull other users' rows", async () => {
    const otherEmail = uniqueEmail("other");
    const otherUser = await createTestUser(otherEmail, PASSWORD);
    try {
      const o = await buildSignedInClient(otherEmail, PASSWORD);
      const project = makeProject({ userId: otherUser, name: "secret" });
      await o.outbox.enqueue({
        entityTable: "projects", entityId: project.id, op: "insert",
        changedFields: {
          id: project.id, name: project.name, color: project.color,
          archived: project.archived, sortOrder: project.sortOrder,
          createdAt: project.createdAt, updatedAt: project.updatedAt,
          deletedAt: project.deletedAt,
        },
        clientTs: project.updatedAt,
      });
      await o.engine.push();

      const me = await buildSignedInClient(email, PASSWORD);
      await me.engine.pull(null);
      expect(await me.store.findById("projects", project.id)).toBeNull();
    } finally {
      await deleteTestUser(otherUser);
    }
  });
});
