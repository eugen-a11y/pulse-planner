import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  AuthService,
  createPulseSupabaseClient,
  InMemoryStore,
  Outbox,
  REFRESH_TOKEN_KEY,
  SyncEngine,
  type TokenStorage,
} from "@pulse/core";

const cliDir = join(homedir(), ".pulse-cli");
mkdirSync(cliDir, { recursive: true });
const tokenPath = join(cliDir, "token.json");

class FileTokenStorage implements TokenStorage {
  async get(key: string): Promise<string | null> {
    if (!existsSync(tokenPath)) return null;
    const data = JSON.parse(readFileSync(tokenPath, "utf8"));
    return data[key] ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    const data = existsSync(tokenPath) ? JSON.parse(readFileSync(tokenPath, "utf8")) : {};
    data[key] = value;
    writeFileSync(tokenPath, JSON.stringify(data), { mode: 0o600 });
  }
  async clear(): Promise<void> {
    if (existsSync(tokenPath)) writeFileSync(tokenPath, "{}", { mode: 0o600 });
  }
}

export interface CliContext {
  supabase: ReturnType<typeof createPulseSupabaseClient>;
  auth: AuthService;
  store: InMemoryStore;
  outbox: Outbox;
  engine: SyncEngine;
  refreshTokenKey: string;
}

export async function restoreOrFail(ctx: CliContext): Promise<{ userId: string }> {
  const session = await ctx.auth.restoreSession();
  if (!session) throw new Error("not signed in; run `pulse-cli signin <email> <password>`");
  // rebuild engine with the right userId
  (ctx.engine as any).deps.userId = session.user.id;
  return { userId: session.user.id };
}

export function buildContext(userId = "anon"): CliContext {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY in .env");

  const supabase = createPulseSupabaseClient({ url, anonKey });
  const auth = new AuthService(supabase, new FileTokenStorage());
  const store = new InMemoryStore();
  const outbox = new Outbox();
  const engine = new SyncEngine({ supabase, outbox, store, userId });
  return { supabase, auth, store, outbox, engine, refreshTokenKey: REFRESH_TOKEN_KEY };
}
