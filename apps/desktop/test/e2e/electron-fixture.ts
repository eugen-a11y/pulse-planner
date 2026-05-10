import { _electron as electron, type ElectronApplication } from "playwright";
import { join } from "node:path";
import { test as base, expect } from "@playwright/test";

interface PulseFixture {
  electronApp: ElectronApplication;
}

export const test = base.extend<PulseFixture>({
  electronApp: async ({}, use) => {
    const app = await electron.launch({
      args: [join(process.cwd(), "dist-electron/main/index.js")],
      env: {
        ...process.env,
        NODE_ENV: "test",
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? "",
      },
    });
    await use(app);
    await app.close();
  },
});

export { expect };
