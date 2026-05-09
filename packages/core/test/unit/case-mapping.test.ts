import { describe, expect, it } from "vitest";
import { camelToSnake, snakeToCamel, snakifyKeys, snakeToCamelRow } from "../../src/sync/case-mapping.js";

describe("case-mapping", () => {
  it("camelToSnake handles single + multi-segment camelCase", () => {
    expect(camelToSnake("dueDate")).toBe("due_date");
    expect(camelToSnake("parentTaskId")).toBe("parent_task_id");
    expect(camelToSnake("id")).toBe("id");
  });

  it("snakeToCamel reverses camelToSnake for known field names", () => {
    expect(snakeToCamel("due_date")).toBe("dueDate");
    expect(snakeToCamel("parent_task_id")).toBe("parentTaskId");
    expect(snakeToCamel("updated_at")).toBe("updatedAt");
  });

  it("snakifyKeys converts all top-level keys", () => {
    expect(snakifyKeys({ dueDate: "x", parentTaskId: null, sortOrder: 1 }))
      .toEqual({ due_date: "x", parent_task_id: null, sort_order: 1 });
  });

  it("snakeToCamelRow converts top-level keys, leaves values untouched", () => {
    expect(snakeToCamelRow({ user_id: "u", payload: { from: "todo" } }))
      .toEqual({ userId: "u", payload: { from: "todo" } });
  });
});
