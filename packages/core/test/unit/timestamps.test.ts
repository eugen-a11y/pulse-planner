import { describe, expect, it } from "vitest";
import { nowIso, parseIso, isValidIso, maxIso } from "../../src/domain/timestamps.js";

describe("timestamps", () => {
  it("nowIso returns parseable ISO 8601 with Z suffix", () => {
    const s = nowIso();
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(isNaN(Date.parse(s))).toBe(false);
  });

  it("parseIso round-trips", () => {
    const s = "2026-05-09T12:34:56.789Z";
    expect(parseIso(s).toISOString()).toBe(s);
  });

  it("isValidIso accepts/rejects", () => {
    expect(isValidIso("2026-05-09T00:00:00.000Z")).toBe(true);
    expect(isValidIso("not a date")).toBe(false);
    expect(isValidIso("")).toBe(false);
  });

  it("maxIso returns the later of two ISO strings", () => {
    const a = "2026-05-09T00:00:00.000Z";
    const b = "2026-05-10T00:00:00.000Z";
    expect(maxIso(a, b)).toBe(b);
    expect(maxIso(b, a)).toBe(b);
    expect(maxIso(a, a)).toBe(a);
  });
});
