import { test, expect } from "./electron-fixture.js";

test("signup → today is empty", async ({ electronApp }) => {
  const win = await electronApp.firstWindow();
  await win.waitForSelector("input[type=email]");
  const email = `e2e-${Date.now()}@pulse.test`;
  await win.fill("input[type=email]", email);
  await win.fill("input[type=password]", "pulse-e2e-pw-12345");
  await win.click("button[type=submit]:not(:has-text('Konto'))"); // signup toggle then submit
  await expect(win.getByText(/Heute|Today/)).toBeVisible({ timeout: 15_000 });
});
