import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";
import type { TokenStorage } from "@pulse/core";

export class FileTokenStorage implements TokenStorage {
  private readonly path: string;

  constructor() {
    this.path = join(app.getPath("userData"), "tokens.json");
  }

  async get(key: string): Promise<string | null> {
    if (!existsSync(this.path)) return null;
    try {
      const data = JSON.parse(readFileSync(this.path, "utf8")) as Record<string, string>;
      return data[key] ?? null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    mkdirSync(dirname(this.path), { recursive: true });
    const data = existsSync(this.path)
      ? (JSON.parse(readFileSync(this.path, "utf8")) as Record<string, string>)
      : {};
    data[key] = value;
    writeFileSync(this.path, JSON.stringify(data), { mode: 0o600 });
  }

  async clear(): Promise<void> {
    if (existsSync(this.path)) {
      writeFileSync(this.path, "{}", { mode: 0o600 });
    }
  }
}
