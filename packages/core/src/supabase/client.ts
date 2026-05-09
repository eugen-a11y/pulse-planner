import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from "@supabase/supabase-js";

export interface CreateSupabaseInput {
  url: string;
  anonKey: string;
  options?: SupabaseClientOptions<"public">;
}

export function createPulseSupabaseClient(
  input: CreateSupabaseInput,
): SupabaseClient {
  return createClient(input.url, input.anonKey, {
    auth: {
      persistSession: false,           // host injects token storage
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: { params: { eventsPerSecond: 5 } },
    ...input.options,
  });
}

export type { SupabaseClient };
