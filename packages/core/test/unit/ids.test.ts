import { describe, expect, it } from "vitest";
import { newId, isValidId } from "../../src/domain/ids.js";

describe("ids", () => {
  it("newId returns a 36-char uuid string", () => {
    const id = newId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("newId values are sortable by creation time", async () => {
    const a = newId();
    await new Promise((r) => setTimeout(r, 5));
    const b = newId();
    expect(a < b).toBe(true);
  });

  it("isValidId accepts uuidv7", () => {
    expect(isValidId(newId())).toBe(true);
  });

  it("isValidId rejects garbage", () => {
    expect(isValidId("not-a-uuid")).toBe(false);
    expect(isValidId("")).toBe(false);
  });
});
