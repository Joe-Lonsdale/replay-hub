import assert from "node:assert/strict";
import test from "node:test";
import { attachIdentity, buildReport, identifyUser } from "./report";
import type { ReviewGame } from "./report";
import type { GoalTag, StoredReplay } from "../replay/types";

test("names the double commit as the thing to fix", () => {
  const report = buildReport(fixtureGames());
  assert.equal(report.wins, 2);
  assert.equal(report.losses, 4);
  assert.equal(report.workOn[0]?.id, "double_commit");
  assert.equal(report.latestSession?.wins, 1);
  assert.equal(report.latestSession?.losses, 1);
  assert.ok(report.concedeFactors.some((factor) => factor.id === "double_commit"));
});

test("matches a replay by steam id and falls back to the in-game name", () => {
  const replay = gameReplay("2026-11-10T21:00:00.000Z", true, []);
  assert.equal(identifyUser(replay, "76561198000000001", null).name, "Alpha");
  assert.equal(identifyUser(replay, "not-me", "Alpha").team, 0);
  assert.equal(identifyUser(replay, "not-me", "Nobody").team, null);
});

function fixtureGames(): ReviewGame[] {
  const losses = [0, 1, 2].map((index) =>
    review(false, new Date(Date.UTC(2026, 10, 10, 21, index * 8)).toISOString(), [
      ["double_commit", "open_net"],
      ["double_commit"],
    ]),
  );
  const earlyWin = review(true, "2026-11-10T21:30:00.000Z", [["first_minute"]]);
  const laterLoss = review(false, "2026-11-10T23:10:00.000Z", [
    ["double_commit"],
    ["double_commit", "low_boost"],
  ]);
  const laterWin = review(true, "2026-11-10T23:20:00.000Z", []);
  return [...losses, earlyWin, laterLoss, laterWin];
}

function review(won: boolean, playedAt: string, concededTags: GoalTag[][]): ReviewGame {
  const replay = gameReplay(playedAt, won, concededTags);
  return attachIdentity(playedAt, replay, "76561198000000001", null);
}

function gameReplay(playedAt: string, won: boolean, concededTags: GoalTag[][]): StoredReplay {
  const team0 = won ? 3 : 1;
  const team1 = won ? 1 : 3;
  const against = concededTags.map((tags, index) => ({
    time: 40 + index * 40,
    frame: (40 + index * 40) * 30,
    secondsRemaining: 260 - index * 40,
    scorer: "Charlie",
    team: 1 as const,
    tags,
    detail: tags.join(", "),
    lastMan: "Alpha",
    boosts: [],
  }));
  const scored = won
    ? [0, 1].map((index) => ({
        time: 80 + index * 50,
        frame: (80 + index * 50) * 30,
        secondsRemaining: 200,
        scorer: "Alpha",
        team: 0 as const,
        tags: [] as GoalTag[],
        detail: "Scored",
        lastMan: null,
        boosts: [],
      }))
    : [];
  return {
    parserVersion: 1,
    depth: "frames",
    matchGuid: playedAt,
    name: "Doubles",
    mapName: "Stadium_P",
    mapLabel: "DFH Stadium",
    playedAt,
    playlist: "doubles",
    matchType: "Online",
    gameType: "TAGame.Replay_Soccar_TA",
    buildVersion: null,
    teamSize: 2,
    durationSeconds: 300,
    overtime: false,
    forfeit: false,
    noContest: false,
    countable: true,
    team0Score: team0,
    team1Score: team1,
    players: [
      {
        name: "Alpha",
        platform: "Steam",
        onlineId: "76561198000000001",
        team: 0,
        bot: false,
        score: won ? 700 : 250,
        goals: won ? 2 : 0,
        assists: won ? 1 : 0,
        saves: won ? 3 : 1,
        shots: 4,
        shootingPct: won ? 50 : 0,
        deep: null,
      },
      {
        name: "Bravo",
        platform: "Steam",
        onlineId: "2",
        team: 0,
        bot: false,
        score: 200,
        goals: won ? 1 : 1,
        assists: 0,
        saves: 1,
        shots: 2,
        shootingPct: 50,
        deep: null,
      },
    ],
    goals: [...against, ...scored].sort((a, b) => a.time - b.time),
    warnings: [],
  };
}
