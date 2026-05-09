import { describe, expect, it } from "vitest";
import { createPulseSupabaseClient } from "../../src/index.js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./helpers/supabase-test.js";

describe("RLS — unauthenticated access", () => {
  it("anonymous select returns zero rows", async () => {
    const supa = createPulseSupabaseClient({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });
    const { data, error } = await supa.from("projects").select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("anonymous insert is rejected", async () => {
    const supa = createPulseSupabaseClient({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });
    const { error } = await supa.from("projects").insert({
      id: "00000000-0000-7000-8000-000000000000",
      user_id: "00000000-0000-7000-8000-000000000001",
      name: "x",
    });
    expect(error).not.toBeNull();
  });
});
