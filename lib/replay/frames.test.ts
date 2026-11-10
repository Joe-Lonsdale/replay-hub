import assert from "node:assert/strict";
import test from "node:test";
import { buildReplay } from "./frames";
import type { FrameSample, HeaderGame, HeaderPlayer } from "./types";

test("tags an empty net when both defenders are in the opponent half", () => {
  const game = buildReplay(header([{ frame: 2400, scorer: "Charlie", team: 1 }]), [
    sample(79.6, -2000, [
      car("Alpha", 0, -400, 2200, 80),
      car("Bravo", 0, 400, 2400, 70),
      car("Charlie", 1, -200, -1000, 40),
      car("Delta", 1, 200, -2800, 55),
    ]),
  ]);
  const tags = game.goals[0].tags;
  assert.ok(tags.includes("double_commit"));
  assert.ok(tags.includes("open_net"));
  assert.ok(tags.includes("overcommit"));
  assert.ok(tags.includes("last_man_out"));
  assert.equal(tags.includes("kickoff"), false);
});

test("a kickoff goal does not get punished as a double commit", () => {
  const game = buildReplay(header([{ frame: 240, scorer: "Charlie", team: 1 }]), [
    sample(0, 0, [
      car("Alpha", 0, -500, -3000, 33),
      car("Bravo", 0, 500, -2000, 33),
    ]),
    sample(2, 800, [
      car("Alpha", 0, -200, 500, 33),
      car("Bravo", 0, 200, 1800, 33),
    ]),
    sample(7.6, 1200, [
      car("Alpha", 0, -200, 2200, 20),
      car("Bravo", 0, 200, 2400, 20),
    ]),
  ]);
  assert.deepEqual(game.goals[0].tags, ["kickoff"]);
});

test("counts a big boost pad taken in the opponent half", () => {
  const samples: FrameSample[] = [];
  for (let i = 0; i < 5; i += 1) {
    samples.push(
      sample(20 + i * 0.1, 0, [
        car("Alpha", 0, 0, 2000, i === 0 ? 0 : 100),
        car("Bravo", 0, 0, -2000, 40),
      ]),
    );
  }
  const game = buildReplay(header([]), samples);
  const alpha = game.players.find((player) => player.name === "Alpha");
  assert.ok(alpha?.deep);
  assert.equal(alpha.deep.bigPads, 1);
  assert.ok(alpha.deep.boostStolen >= 90);
  assert.equal(game.depth, "frames");
});

function header(goals: HeaderGame["goals"]): HeaderGame {
  const players: HeaderPlayer[] = [
    player("Alpha", 0),
    player("Bravo", 0),
    player("Charlie", 1),
    player("Delta", 1),
  ];
  return {
    matchGuid: "game",
    name: "Test",
    mapName: "Stadium_P",
    mapLabel: "DFH Stadium",
    playedAt: "2026-11-10T21:04:00.000Z",
    playlist: "doubles",
    matchType: "Online",
    gameType: "TAGame.Replay_Soccar_TA",
    buildVersion: null,
    teamSize: 2,
    durationSeconds: 300,
    recordFps: 30,
    overtime: false,
    forfeit: false,
    noContest: false,
    team0Score: 1,
    team1Score: 2,
    players,
    goals,
    warnings: [],
  };
}

function player(name: string, team: 0 | 1): HeaderPlayer {
  return {
    name,
    platform: "Steam",
    onlineId: name === "Alpha" ? "76561198000000001" : null,
    team,
    bot: false,
    score: 100,
    goals: 0,
    assists: 0,
    saves: 0,
    shots: 1,
  };
}

function sample(time: number, ballY: number, players: FrameSample["players"]): FrameSample {
  return {
    time,
    secondsRemaining: 300 - time,
    kickoffCountdown: 0,
    ball: { x: 0, y: ballY, z: 93 },
    players,
  };
}

function car(name: string, team: 0 | 1, x: number, y: number, boost: number): FrameSample["players"][number] {
  return { name, team, x, y, z: 40, boost };
}
