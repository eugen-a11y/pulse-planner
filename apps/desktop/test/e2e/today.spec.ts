import { test, expect } from "./electron-fixture.js";

test("create project, create task, today shows task", async ({ electronApp }) => {
  const win = await electronApp.firstWindow();
  const email = `e2e-${Date.now()}@pulse.test`;
  await win.fill("input[type=email]", email);
  await win.fill("input[type=password]", "pulse-e2e-pw-12345");
  await win.getByText("Konto erstellen").first().click();
  await win.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(win.getByText(/Heute/)).toBeVisible({ timeout: 15_000 });

  await win.getByLabel("Neues Projekt").click();
  await win.locator("input[placeholder='Projektname']").fill("E2E");
  await win.locator("input[placeholder='Projektname']").press("Enter");
  await win.getByText("E2E").click();

  await win.locator("input[placeholder*='Neue Task']").fill("E2E task");
  await win.locator("input[placeholder*='Neue Task']").press("Enter");

  await win.getByText("E2E task").click();
  const today = new Date().toISOString().slice(0, 10);
  await win.locator("input[type=date]").fill(today);

  await win.getByText("Today").first().click();
  await expect(win.getByText("E2E task")).toBeVisible({ timeout: 5_000 });
});
