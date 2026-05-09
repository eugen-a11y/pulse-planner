export type IsoTimestamp = string;

export function nowIso(): IsoTimestamp {
  return new Date().toISOString();
}

export function parseIso(s: IsoTimestamp): Date {
  const d = new Date(s);
  if (isNaN(d.getTime())) {
    throw new Error(`invalid ISO timestamp: ${s}`);
  }
  return d;
}

export function isValidIso(s: unknown): s is IsoTimestamp {
  return typeof s === "string" && !isNaN(Date.parse(s));
}

export function maxIso(a: IsoTimestamp, b: IsoTimestamp): IsoTimestamp {
  return parseIso(a).getTime() >= parseIso(b).getTime() ? a : b;
}
