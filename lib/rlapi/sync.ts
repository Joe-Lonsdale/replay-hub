import "server-only";

import { importReplayBytes } from "@/lib/replay/import-server";
import { downloadReplay, getMatchHistory } from "./client";

export interface RlApiSyncResult {
  seen: number;
  imported: number;
  duplicates: number;
  stored: number;
  skipped: number;
  failed: number;
}

export async function syncRlapiReplays(userId: string, limit: number): Promise<RlApiSyncResult> {
  const matches = await getMatchHistory(limit);
  const result: RlApiSyncResult = {
    seen: matches.length,
    imported: 0,
    duplicates: 0,
    stored: 0,
    skipped: 0,
    failed: 0,
  };

  for (const match of matches) {
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
    } catch (error) {
      result.failed += 1;
      console.error("RLAPI replay sync failed", {
        matchGuid: match.Match?.MatchGUID,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
