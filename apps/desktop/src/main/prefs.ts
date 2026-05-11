import { app } from "electron";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export interface Prefs {
  rememberMe: boolean;
}

const DEFAULTS: Prefs = { rememberMe: false };

function file(): string {
  return join(app.getPath("userData"), "prefs.json");
}

export function loadPrefs(): Prefs {
  const p = file();
  if (!existsSync(p)) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...(JSON.parse(readFileSync(p, "utf8")) as Partial<Prefs>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(partial: Partial<Prefs>): Prefs {
  const next = { ...loadPrefs(), ...partial };
  mkdirSync(dirname(file()), { recursive: true });
  writeFileSync(file(), JSON.stringify(next), { mode: 0o600 });
  return next;
}
