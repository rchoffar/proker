import type { HandHistory } from '../types/hand';

// Pure reconciliation between the local hand cache and the server's per-user list.
// The server wins for EXISTENCE: a local hand the server doesn't know about — and that
// isn't waiting to be pushed — was deleted elsewhere (or belongs to a stale cache) and gets
// dropped; a server hand missing locally gets fetched. There is no content merge by
// updatedAt: pending local versions win until pushed (single-device is the realistic case).
export interface ReconcileResult {
  // Server hands whose payload we don't have locally — fetch to keep offline replay whole.
  toFetch: string[];
  // Local hands the server no longer has (and that aren't pending upload) — drop.
  toDrop: string[];
}

export function reconcile(
  localIds: string[],
  pendingUpserts: string[],
  pendingDeletes: string[],
  serverIds: string[]
): ReconcileResult {
  const local = new Set(localIds);
  const pendingUp = new Set(pendingUpserts);
  const pendingDel = new Set(pendingDeletes);
  const server = new Set(serverIds);

  // A hand we deleted offline may still be on the server until the DELETE lands — never
  // re-fetch it, the pending delete wins.
  const toFetch = serverIds.filter((id) => !local.has(id) && !pendingDel.has(id));
  const toDrop = localIds.filter((id) => !server.has(id) && !pendingUp.has(id));
  return { toFetch, toDrop };
}

export function sortHandsNewestFirst(hands: HandHistory[]): HandHistory[] {
  return [...hands].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
