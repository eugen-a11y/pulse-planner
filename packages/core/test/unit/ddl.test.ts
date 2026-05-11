import { describe, it, expect } from "vitest";
import { TABLE_DDL, SYNC_STATE_DDL, ALL_DDL } from "../../src/sql/ddl.js";

describe("DDL exports", () => {
  it("exports CREATE TABLE statements for every domain entity", () => {
    expect(TABLE_DDL.tasks).toMatch(/CREATE TABLE IF NOT EXISTS tasks/);
    expect(TABLE_DDL.projects).toMatch(/CREATE TABLE IF NOT EXISTS projects/);
    expect(TABLE_DDL.tags).toMatch(/CREATE TABLE IF NOT EXISTS tags/);
    expect(TABLE_DDL.task_tags).toMatch(/CREATE TABLE IF NOT EXISTS task_tags/);
    expect(TABLE_DDL.comments).toMatch(/CREATE TABLE IF NOT EXISTS comments/);
    expect(TABLE_DDL.notes).toMatch(/CREATE TABLE IF NOT EXISTS notes/);
    expect(TABLE_DDL.time_entries).toMatch(/CREATE TABLE IF NOT EXISTS time_entries/);
    expect(TABLE_DDL.attachments).toMatch(/CREATE TABLE IF NOT EXISTS attachments/);
  });

  it("includes sync_state table", () => {
    expect(SYNC_STATE_DDL).toMatch(/CREATE TABLE IF NOT EXISTS sync_state/);
  });

  it("ALL_DDL concatenates all statements in dependency order", () => {
    const i = (s: string) => ALL_DDL.indexOf(s);
    expect(i("CREATE TABLE IF NOT EXISTS projects")).toBeLessThan(i("CREATE TABLE IF NOT EXISTS tasks"));
    expect(i("CREATE TABLE IF NOT EXISTS tasks")).toBeLessThan(i("CREATE TABLE IF NOT EXISTS task_tags"));
    expect(i("CREATE TABLE IF NOT EXISTS tags")).toBeLessThan(i("CREATE TABLE IF NOT EXISTS task_tags"));
  });
});
