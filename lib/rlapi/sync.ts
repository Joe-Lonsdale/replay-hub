import "server-only";

import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { importReplayBytes } from "@/lib/replay/import-server";
import { getRlApiConnection, listReplayMatchGuids, saveRlApiConnection } from "@/lib/repo";
import { downloadReplay, getMatchHistoryForEpicAccount, refreshEpicEosToken } from "./client";

export interface RlApiSyncResult {
  seen: number;
  imported: number;
  duplicates: number;
  stored: number;
  skipped: number;
  failed: number;
}

export async function syncRlapiReplays(userId: string, limit: number): Promise<RlApiSyncResult> {
  const connection = await getRlApiConnection(userId);
  if (!connection) throw new Error("Connect your Epic/RLAPI account before syncing replays.");
  const existingMatchGuids = await listReplayMatchGuids(userId);

  const token = await refreshEpicEosToken(decryptSecret(connection.refreshTokenCiphertext));
  if (!token.accessToken || !token.refreshToken || !token.accountId) {
    throw new Error("Epic auth did not return a usable EOS token.");
  }
  await saveRlApiConnection({
    userId,
    epicAccountId: token.accountId,
    displayName: connection.displayName,
    refreshTokenCiphertext: encryptSecret(token.refreshToken),
    refreshExpiresAt: token.refreshExpiresAt,
  });

  const matches = await getMatchHistoryForEpicAccount({
    eosToken: token.accessToken,
    epicAccountId: token.accountId,
    accountName: connection.displayName,
  });
  const result: RlApiSyncResult = {
    seen: 0,
    imported: 0,
    duplicates: 0,
    stored: 0,
    skipped: 0,
    failed: 0,
  };

  let unsyncedAttempted = 0;
  for (const match of matches) {
    const matchGuid = match.Match?.MatchGUID ?? null;
    if (matchGuid && existingMatchGuids.has(matchGuid)) {
      result.seen += 1;
      result.skipped += 1;
      continue;
    }
    if (unsyncedAttempted >= limit) break;
    result.seen += 1;
    unsyncedAttempted += 1;
    if (!match.ReplayUrl) {
      result.skipped += 1;
      continue;
    }
    try {
      const bytes = await downloadReplay(match.ReplayUrl);
      const imported = await importReplayBytes(userId, bytes);
      if (imported.duplicate) result.duplicates += 1;
      else result.imported += 1;
      if (imported.stored) result.stored += 1;
      if (matchGuid) existingMatchGuids.add(matchGuid);
    } catch (error) {
      result.failed += 1;
      console.error("RLAPI replay sync failed", {
        matchGuid,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
