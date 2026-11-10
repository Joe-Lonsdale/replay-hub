import "server-only";
import { identifyUser } from "../coaching/report";
import { listReplays } from "../repo";
import type { User } from "../types";
import { buildScenarioReport } from "./match";
import type { ScenarioDefinition, ScenarioGame, ScenarioReport } from "./types";

export async function loadScenarioGames(user: User, playlist: string | null, limit: number): Promise<ScenarioGame[]> {
  const rows = await listReplays(user.id, playlist, limit);
  return rows.map((row) => {
    const identity = identifyUser(row.analysis, user.id, user.rlName);
    const ours = identity.team == null ? null : identity.team === 0 ? row.team0Score : row.team1Score;
    const theirs = identity.team == null ? null : identity.team === 0 ? row.team1Score : row.team0Score;
    return {
      id: row.id,
      playedAt: row.playedAt,
      map: row.mapLabel,
      team0Score: row.team0Score,
      team1Score: row.team1Score,
      userTeam: identity.team,
      userName: identity.name,
      userWon: ours == null || theirs == null || ours === theirs ? null : ours > theirs,
      tracked: row.analysis.parserVersion >= 2 && Array.isArray(row.analysis.events),
      events: row.analysis.events ?? [],
    };
  });
}

export async function runScenario(
  user: User,
  definition: ScenarioDefinition,
  playlist: string | null,
  limit = 80,
): Promise<ScenarioReport> {
  return buildScenarioReport(await loadScenarioGames(user, playlist, limit), definition);
}
