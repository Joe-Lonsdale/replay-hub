import { attachIdentity, type ReviewGame } from "./report";
import type { GoalTag, StoredReplay } from "../replay/types";

export function previewGames(): ReviewGame[] {
  const specs: { hours: number; won: boolean; tags: GoalTag[][]; scored: GoalTag[] }[] = [
    { hours: 0.3, won: false, tags: [["double_commit", "open_net"], ["double_commit"]], scored: [] },
    { hours: 0.6, won: false, tags: [["counterattack", "overcommit"], ["low_boost"]], scored: [] },
    { hours: 0.9, won: true, tags: [["kickoff"]], scored: ["counterattack"] },
    { hours: 1.2, won: false, tags: [["double_commit", "last_man_out"]], scored: [] },
    { hours: 5, won: true, tags: [], scored: ["open_net"] },
    { hours: 5.4, won: false, tags: [["kickoff"], ["fast_break"]], scored: [] },
  ];
  return specs.map((spec) => {
    const playedAt = new Date(Date.now() - spec.hours * 3600 * 1000).toISOString();
    return attachIdentity(
      playedAt,
      replay(playedAt, spec.won, spec.tags, spec.scored),
      "76561198000000001",
      "Alpha",
    );
  });
}

function replay(playedAt: string, won: boolean, conceded: GoalTag[][], scored: GoalTag[]): StoredReplay {
  const goals = [
    ...conceded.map((tags, index) => ({
      time: 30 + index * 70,
      frame: (30 + index * 70) * 30,
      secondsRemaining: 270 - index * 70,
      scorer: "Charlie",
      team: 1 as const,
      tags,
      detail: tags.join(". "),
      lastMan: "Alpha",
      boosts: [
        { name: "Alpha", team: 0 as const, boost: tags.includes("low_boost") ? 4 : 36 },
        { name: "Bravo", team: 0 as const, boost: 62 },
      ],
    })),
    ...(won
      ? [
          {
            time: 140,
            frame: 140 * 30,
            secondsRemaining: 160,
            scorer: "Alpha",
            team: 0 as const,
            tags: scored,
            detail: scored.join(". ") || "Scored",
            lastMan: "Charlie",
            boosts: [],
          },
        ]
      : []),
  ];
  return {
    parserVersion: 1,
    depth: "frames",
    matchGuid: playedAt,
    name: "Doubles",
    mapName: "Stadium_P",
    mapLabel: indexMap(playedAt),
    playedAt,
    playlist: "doubles",
    matchType: "Online",
    gameType: "TAGame.Replay_Soccar_TA",
    buildVersion: null,
    teamSize: 2,
    durationSeconds: 312,
    overtime: false,
    forfeit: false,
    noContest: false,
    countable: true,
    team0Score: won ? 3 : 1,
    team1Score: won ? 1 : 3,
    players: [
      player("Alpha", "76561198000000001", 0, won),
      player("Bravo", "2", 0, won),
      player("Charlie", "3", 1, !won),
      player("Delta", "4", 1, !won),
    ],
    goals,
    warnings: [],
  };
}

function player(name: string, onlineId: string, team: 0 | 1, bright: boolean) {
  return {
    name,
    platform: "Steam",
    onlineId,
    team,
    bot: false,
    score: bright ? 640 : 280,
    goals: bright ? 2 : 0,
    assists: bright ? 1 : 0,
    saves: bright ? 3 : 1,
    shots: bright ? 5 : 3,
    shootingPct: bright ? 40 : 0,
    deep: {
      boostCollected: bright ? 420 : 280,
      boostStolen: bright ? 140 : 40,
      bigPads: bright ? 4 : 2,
      smallPads: 18,
      boostUsed: 360,
      timeZeroBoost: bright ? 8 : 22,
      timeFullBoost: 14,
      timeLowBoost: bright ? 20 : 40,
      bpm: 380,
      avgSpeed: 1450,
      timeSupersonic: 28,
      timeBoostSpeed: 70,
      timeSlow: 140,
      timeGround: 200,
      timeLowAir: 30,
      timeHighAir: 8,
      distance: 90000,
      avgDistanceToBall: 2700,
      avgDistanceToMate: 3200,
      timeDefensiveThird: 90,
      timeNeutralThird: 80,
      timeOffensiveThird: bright ? 50 : 90,
      timeBehindBall: 160,
      timeInFrontBall: 60,
      timeMostBack: 120,
      percentDefensiveThird: 38,
      percentOffensiveThird: bright ? 22 : 41,
      percentBehindBall: 68,
      percentSupersonic: 16,
      percentZeroBoost: bright ? 4 : 12,
      goalsAgainstWhileLast: bright ? 0 : 1,
      demosInflicted: 0,
      demosTaken: bright ? 0 : 1,
    },
  };
}

function indexMap(playedAt: string): string {
  const maps = ["DFH Stadium", "Mannfield", "Champions Field", "Forbidden Temple"];
  return maps[playedAt.length % maps.length];
}
