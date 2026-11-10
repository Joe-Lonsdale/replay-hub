import assert from "node:assert/strict";
import test from "node:test";
import { packReplay, unpackReplay } from "./pack";
import type { PlayEvent, StoredReplay } from "./types";

test("packs the event log without dropping cars or scores", () => {
  const replay = sample();
  const packed = JSON.parse(JSON.stringify(packReplay(replay))) as unknown;
  const unpacked = unpackReplay(packed);
  assert.ok(unpacked);
  assert.deepEqual(unpacked.events, replay.events);
  assert.equal(unpacked.mapLabel, "DFH Stadium");
});

test("a full match stays under the upload limit", () => {
  const replay = sample();
  const names = ["AlphaExampleName", "BravoExampleName", "CharlieExample", "DeltaExampleName", "EchoExampleName", "FoxtrotExample"];
  replay.events = Array.from({ length: 2500 }, (_, index) => ({
    t: index / 10,
    kind: "small_pad",
    player: names[index % 4],
    team: index % 2 === 0 ? 0 : 1,
    boost: 40,
    speed: 1500,
    ballSpeed: 900,
    height: 40,
    ballHeight: 93,
    distBall: 800,
    third: "neutral",
    half: "own",
    air: false,
    lastMan: index % 4 === 0,
    clock: 200,
    score0: 1,
    score1: 0,
    cars: names.map((name, car) => ({
      name,
      team: car < 3 ? 0 : 1,
      third: "offensive" as const,
      half: "their" as const,
      boost: 33,
      lastMan: car === 0,
    })),
  }));
  const fat = JSON.stringify(replay).length;
  const packed = JSON.stringify(packReplay(replay)).length;
  assert.ok(fat > 1_500_000, `fat payload was ${fat}`);
  assert.ok(packed < 1_500_000, `packed payload was ${packed}`);
  const restored = unpackReplay(JSON.parse(JSON.stringify(packReplay(replay))));
  assert.equal(restored?.events?.length, 2500);
  assert.equal(restored?.events?.[10].cars?.[5].name, "FoxtrotExample");
  assert.equal(restored?.events?.[10].cars?.[5].team, 1);
});

test("older uploads without the packed event log still read", () => {
  const replay = sample();
  const unpacked = unpackReplay(replay);
  assert.deepEqual(unpacked?.events, replay.events);
});

function sample(): StoredReplay {
  const event: PlayEvent = {
    t: 12.5,
    kind: "fifty",
    player: "Alpha",
    other: "Charlie",
    team: 0,
    otherTeam: 1,
    boost: 20,
    speed: 1000,
    ballSpeed: 800,
    height: 40,
    ballHeight: 93,
    distBall: 100,
    third: "defensive",
    half: "own",
    air: false,
    lastMan: true,
    clock: 240,
    score0: 0,
    score1: 1,
    cars: [
      { name: "Alpha", team: 0, third: "defensive", half: "own", boost: 20, lastMan: true },
      { name: "Bravo", team: 0, third: "offensive", half: "their", boost: 50, lastMan: false },
    ],
  };
  return {
    parserVersion: 2,
    depth: "frames",
    matchGuid: null,
    name: "sample",
    mapName: "Stadium_P",
    mapLabel: "DFH Stadium",
    playedAt: null,
    playlist: "doubles",
    matchType: null,
    gameType: "TAGame.Replay_Soccar_TA",
    buildVersion: null,
    teamSize: 2,
    durationSeconds: 300,
    overtime: false,
    forfeit: false,
    noContest: false,
    countable: true,
    team0Score: 1,
    team1Score: 2,
    players: [],
    goals: [],
    warnings: [],
    events: [event, { t: 20, kind: "goal", player: "Charlie", team: 1, score0: 1, score1: 1 }],
  };
}
