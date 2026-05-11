/**
 * Manual mock for react-native-mmkv.
 *
 * Backed by an in-memory Map — no native bindings needed in Node tests.
 */

export class MMKV {
  private store = new Map<string, string | number | boolean | Uint8Array>();

  constructor(_opts?: { id?: string; encryptionKey?: string }) {}

  getBoolean(key: string): boolean | undefined {
    const v = this.store.get(key);
    return typeof v === "boolean" ? v : undefined;
  }

  getString(key: string): string | undefined {
    const v = this.store.get(key);
    return typeof v === "string" ? v : undefined;
  }

  getNumber(key: string): number | undefined {
    const v = this.store.get(key);
    return typeof v === "number" ? v : undefined;
  }

  set(key: string, value: string | number | boolean | Uint8Array): void {
    this.store.set(key, value);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clearAll(): void {
    this.store.clear();
  }

  contains(key: string): boolean {
    return this.store.has(key);
  }

  getAllKeys(): string[] {
    return Array.from(this.store.keys());
  }
}
