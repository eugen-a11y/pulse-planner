import * as SecureStore from "expo-secure-store";
import type { TokenStorage } from "@pulse/core";
import { REFRESH_TOKEN_KEY } from "@pulse/core";

/**
 * Key-namespacing: bare key (no prefix).
 *
 * Rationale: `pulse.refresh_token` already satisfies SecureStore's
 * allowed charset (`^[A-Za-z0-9._-]+$`). Using the bare key stays
 * consistent with FileTokenStorage (desktop), which also uses the bare key
 * as the JSON property name. A prefix would cause clear() on desktop vs.
 * mobile to diverge and could break cross-platform sign-out flows.
 */

/** Keys ever written by AuthService — must all be deleted in clear(). */
const KNOWN_KEYS: string[] = [REFRESH_TOKEN_KEY];

export class SecureStoreTokenStorage implements TokenStorage {
  async get(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  }

  async set(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
  }

  async clear(): Promise<void> {
    // SecureStore has no enumeration API, so we delete every key that
    // AuthService ever writes. Currently that is only REFRESH_TOKEN_KEY.
    // If auth-service.ts gains new storage.set() calls, add the key here.
    await Promise.all(KNOWN_KEYS.map((k) => SecureStore.deleteItemAsync(k)));
  }
}
