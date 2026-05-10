import { test, expect } from "./electron-fixture.js";

test("start timer → top-bar pill appears, stop hides it", async ({ electronApp }) => {
  const win = await electronApp.firstWindow();
  await win.getByText("E2E task").click();
  await win.getByRole("button", { name: /Start/ }).click();
  await expect(win.locator("text=⏱")).toBeVisible({ timeout: 5_000 });
  await win.getByLabel("Stop").click();
  await expect(win.locator("text=⏱")).not.toBeVisible({ timeout: 5_000 });
});
