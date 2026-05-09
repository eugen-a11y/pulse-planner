// Minimal hand-written type for sync_upsert RPC. Full Database type
// is generated later via `supabase gen types typescript`.

export type SyncOp = "insert" | "update" | "delete";

export interface SyncUpsertArgs {
  p_table: string;
  p_id: string;
  p_op: SyncOp;
  p_changes: Record<string, unknown>;
  p_client_ts: string;
}
