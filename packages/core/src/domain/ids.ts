import { uuidv7 } from "uuidv7";

const UUID_V7_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function newId(): string {
  return uuidv7();
}

export function isValidId(s: string): boolean {
  return UUID_V7_RE.test(s);
}
