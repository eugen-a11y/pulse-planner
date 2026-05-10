import { test, expect } from "./electron-fixture.js";

test("quit and relaunch — task still visible", async ({ electronApp }) => {
  const win = await electronApp.firstWindow();
  await win.waitForSelector("text=Today", { timeout: 15_000 });
  await expect(win.getByText("E2E task")).toBeVisible();
});
