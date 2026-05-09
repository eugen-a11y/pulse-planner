export interface TokenStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  clear(): Promise<void>;
}

export const REFRESH_TOKEN_KEY = "pulse.refresh_token";
