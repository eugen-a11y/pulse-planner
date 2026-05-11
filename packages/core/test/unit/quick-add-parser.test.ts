import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "../../src/quickAdd/parser.js";

const projects = [
  { id: "p1", name: "pulsehamburg" },
  { id: "p2", name: "Phase 2" },
  { id: "p3", name: "Personal" },
];

describe("parseQuickAdd", () => {
  it("plain text returns title only", () => {
    const r = parseQuickAdd("Storyboard schreiben", projects);
    expect(r.title).toBe("Storyboard schreiben");
    expect(r.projectId).toBeNull();
    expect(r.dueDate).toBeNull();
    expect(r.priority).toBe(3);
    expect(r.tagNames).toEqual([]);
  });

  it("parses @projectPrefix (case-insensitive, fuzzy)", () => {
    const r = parseQuickAdd("Newsletter @pulse", projects);
    expect(r.title).toBe("Newsletter");
    expect(r.projectId).toBe("p1");
  });

  it("parses !priority", () => {
    const r = parseQuickAdd("Wichtig !1", projects);
    expect(r.priority).toBe(1);
    expect(r.title).toBe("Wichtig");
  });

  it("parses #tag", () => {
    const r = parseQuickAdd("Mail #urgent #waiting", projects);
    expect(r.tagNames).toEqual(["urgent", "waiting"]);
    expect(r.title).toBe("Mail");
  });

  it("parses German natural date (heute)", () => {
    const r = parseQuickAdd("Mail heute", projects);
    expect(r.dueDate).not.toBeNull();
    const d = new Date(r.dueDate!);
    const now = new Date();
    expect(d.toDateString()).toBe(now.toDateString());
    expect(r.title).toBe("Mail");
  });

  it("combines all syntax", () => {
    const r = parseQuickAdd("Steuerb. mailen @personal !2 morgen #waiting", projects);
    expect(r.projectId).toBe("p3");
    expect(r.priority).toBe(2);
    expect(r.tagNames).toEqual(["waiting"]);
    expect(r.title).toBe("Steuerb. mailen");
    expect(r.dueDate).not.toBeNull();
  });
});
