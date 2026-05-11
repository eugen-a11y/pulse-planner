/**
 * Manual mock for expo-secure-store.
 *
 * Backed by an in-memory Map so unit tests run in plain Node without
 * any native Keychain / Keystore bindings.
 */

const store = new Map<string, string>();

export async function getItemAsync(key: string): Promise<string | null> {
  return store.has(key) ? store.get(key)! : null;
}

export async function setItemAsync(
  key: string,
  value: string,
  _opts?: unknown,
): Promise<void> {
  store.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  store.delete(key);
}

export const AFTER_FIRST_UNLOCK = "AFTER_FIRST_UNLOCK";

/** Expose the backing store for white-box assertions in tests. */
export const __store = store;

/** Call between tests to reset state. */
export const __reset = (): void => {
  store.clear();
};
