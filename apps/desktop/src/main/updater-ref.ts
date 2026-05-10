let ref: { check: () => Promise<unknown>; installAndRestart: () => void } | null = null;
export function setUpdater(u: typeof ref): void { ref = u; }
export function getUpdater(): typeof ref { return ref; }
