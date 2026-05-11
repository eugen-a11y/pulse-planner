/**
 * Manual mock for @supabase/supabase-js.
 *
 * Returns a stub client that never talks to a server — safe for unit tests.
 */

const stubAuthResponse = { data: null, error: { message: "stub" } };

export const createClient = jest.fn((_url: string, _key: string, _opts?: unknown) => ({
  auth: {
    signUp: jest.fn().mockResolvedValue(stubAuthResponse),
    signInWithPassword: jest.fn().mockResolvedValue(stubAuthResponse),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    refreshSession: jest.fn().mockResolvedValue(stubAuthResponse),
    onAuthStateChange: jest.fn().mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    }),
  },
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: [], error: null }),
  }),
  channel: jest.fn().mockReturnValue({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
    unsubscribe: jest.fn(),
  }),
}));
