import { describe, expect, it } from "vitest";
import { ProjectSchema, makeProject } from "../../src/domain/project.js";

describe("Project", () => {
  it("makeProject populates defaults", () => {
    const p = makeProject({ userId: "user-uuid", name: "Website" });
    expect(p.id).toBeTypeOf("string");
    expect(p.userId).toBe("user-uuid");
    expect(p.name).toBe("Website");
    expect(p.color).toBe("#2563eb");
    expect(p.archived).toBe(false);
    expect(p.sortOrder).toBe(0);
    expect(p.createdAt).toBe(p.updatedAt);
    expect(p.deletedAt).toBeNull();
  });

  it("ProjectSchema rejects empty name", () => {
    const r = ProjectSchema.safeParse({
      id: "00000000-0000-7000-8000-000000000000",
      userId: "00000000-0000-7000-8000-000000000001",
      name: "",
      color: "#2563eb",
      archived: false,
      sortOrder: 0,
      createdAt: "2026-05-09T00:00:00.000Z",
      updatedAt: "2026-05-09T00:00:00.000Z",
      deletedAt: null,
    });
    expect(r.success).toBe(false);
  });

  it("ProjectSchema accepts a valid project", () => {
    const r = ProjectSchema.safeParse(
      makeProject({ userId: "00000000-0000-7000-8000-000000000001", name: "X" }),
    );
    expect(r.success).toBe(true);
  });
});
