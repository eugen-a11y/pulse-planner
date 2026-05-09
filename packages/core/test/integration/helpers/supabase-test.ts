import { config } from "dotenv";
import { resolve } from "node:path";
// Load from repo root — vitest cwd is packages/core, root is two levels up.
config({ path: resolve(process.cwd(), "../../.env"), override: false });
config({ path: resolve(process.cwd(), ".env"), override: false });

export const SUPABASE_URL = process.env.SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  throw new Error(
    "Integration tests need SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Run `supabase start` and copy keys into .env.",
  );
}

import { createClient } from "@supabase/supabase-js";

/** Service-role client used to provision and clean up per-test users. */
export function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function createTestUser(email: string, password: string): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw error;
  return data.user!.id;
}

export async function deleteTestUser(userId: string): Promise<void> {
  const admin = adminClient();
  await admin.auth.admin.deleteUser(userId);
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@pulse.test`;
}
