import "server-only";
import { attachIdentity, buildReport, type Report } from "./coaching/report";
import { listReplays } from "./repo";
import type { User } from "./types";

const PLAYLISTS = new Set(["duel", "doubles", "standard", "extra"]);

export async function loadReport(
  user: User,
  playlistParam?: string,
  limitParam?: string,
): Promise<{ report: Report; playlist: string; limit: number }> {
  const requested = playlistParam === "all" ? null : playlistParam || "doubles";
  const playlist = requested && PLAYLISTS.has(requested) ? requested : requested === null ? null : "doubles";
  const limit = [20, 50, 100].includes(Number(limitParam)) ? Number(limitParam) : 50;
  const rows = await listReplays(user.id, playlist, limit);
  const games = rows.map((row) => attachIdentity(row.id, row.analysis, user.id, user.rlName));
  return { report: buildReport(games), playlist: playlist ?? "all", limit };
}
