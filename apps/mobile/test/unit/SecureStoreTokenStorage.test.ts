import { SecureStoreTokenStorage } from "@/platform/SecureStoreTokenStorage";
import { REFRESH_TOKEN_KEY } from "@pulse/core";
import { __reset, __store } from "../__mocks__/expo-secure-store";

beforeEach(() => {
  __reset();
});

describe("SecureStoreTokenStorage", () => {
  let storage: SecureStoreTokenStorage;

  beforeEach(() => {
    storage = new SecureStoreTokenStorage();
  });

  // 1. get() returns null when key not set
  it("returns null for an unknown key", async () => {
    const result = await storage.get("some.unknown.key");
    expect(result).toBeNull();
  });

  // 2. set() then get() returns the saved value
  it("stores a value and retrieves it", async () => {
    await storage.set("mykey", "myvalue");
    const result = await storage.get("mykey");
    expect(result).toBe("myvalue");
  });

  // 3. set() then set() with new value → get() returns the new value (overwrite)
  it("overwrites an existing value", async () => {
    await storage.set("mykey", "original");
    await storage.set("mykey", "updated");
    const result = await storage.get("mykey");
    expect(result).toBe("updated");
  });

  // 4. set() then clear() → get() returns null
  it("clear() removes all known keys", async () => {
    await storage.set(REFRESH_TOKEN_KEY, "some-refresh-token");
    await storage.clear();
    const result = await storage.get(REFRESH_TOKEN_KEY);
    expect(result).toBeNull();
  });

  // 5. Round-trip with REFRESH_TOKEN_KEY constant from @pulse/core
  it("round-trips REFRESH_TOKEN_KEY from @pulse/core", async () => {
    const token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test-refresh";
    await storage.set(REFRESH_TOKEN_KEY, token);
    const result = await storage.get(REFRESH_TOKEN_KEY);
    expect(result).toBe(token);
  });

  // 6. Bare key: verify the value is stored under the exact key (no prefix transformation)
  it("stores under the bare key (no prefix added)", async () => {
    await storage.set(REFRESH_TOKEN_KEY, "token-value");
    // SecureStore's Map should have the key exactly as passed, not prefixed
    expect(__store.has(REFRESH_TOKEN_KEY)).toBe(true);
    expect(__store.get(REFRESH_TOKEN_KEY)).toBe("token-value");
  });

  // 7. get() returns null after clear() for each known key individually
  it("clear() does not leave the refresh token in the backing store", async () => {
    await storage.set(REFRESH_TOKEN_KEY, "must-be-wiped");
    await storage.clear();
    expect(__store.has(REFRESH_TOKEN_KEY)).toBe(false);
  });
});
