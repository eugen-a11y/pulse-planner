
export function mergeRemoteWithOutbox<T extends Record<string, unknown>>(
  local: T,
  remote: T,
  outstandingFields: readonly string[],
): T {
  if (outstandingFields.length === 0) {
    return { ...remote };
  }
  const out = { ...remote };
  for (const k of outstandingFields) {
    if (k in local) {
      (out as Record<string, unknown>)[k] = local[k];
    }
  }
  return out;
}

export function collectOutstandingFields(
  outbox: readonly { entityTable: string; entityId: string; changedFields: Record<string, unknown> }[],
  table: string,
  id: string,
): string[] {
  const fields = new Set<string>();
  for (const e of outbox) {
    if (e.entityTable !== table || e.entityId !== id) continue;
    for (const k of Object.keys(e.changedFields)) {
      fields.add(k);
    }
  }
  return [...fields];
}
