import assert from "node:assert/strict";
import test from "node:test";
import { PRESETS, parseDefinition } from "./catalog";
import { demoGames } from "./demo";
import { buildScenarioReport } from "./match";
import type { PlayEvent } from "../replay/types";
import type { ScenarioGame } from "./types";

test("the three starter scenarios each fire once on the demo game", () => {
  const games = demoGames();
  const log = games[0].events.map(
    (event) =>
      `${event.t.toFixed(1)} ${event.kind} ${event.player ?? ""} boost=${event.boost ?? "-"} third=${event.third ?? "-"}`,
  );
  const giveaway = buildScenarioReport(games, preset("giveaway"));
  const fifty = buildScenarioReport(games, preset("lost-fifty"));
  const commit = buildScenarioReport(games, preset("low-commit"));
  assert.equal(giveaway.occurrences, 1, log.join("\n"));
  assert.equal(fifty.occurrences, 1, log.join("\n"));
  assert.equal(fifty.hits[0]?.nextTouch, "opponent", fifty.hits[0]?.nextTouchText);
  assert.equal(commit.occurrences, 1, log.join("\n"));
  assert.equal(commit.hits[0]?.nextGoalSoon, "them", commit.hits[0]?.nextGoalSoonText);
  assert.equal(slice(commit, "next-goal-soon", "them"), 1);
  assert.equal(slice(commit, "next-goal-soon", "none"), 0);
});

test("raising the boost bar drops the low-boost commit", () => {
  const games = demoGames();
  const definition = structuredClone(preset("low-commit"));
  const boost = definition.steps[0].filters.find((filter) => filter.field === "boost");
  assert.ok(boost);
  boost.value = 5;
  const report = buildScenarioReport(games, definition);
  assert.equal(report.occurrences, 0);
});

test("a teammate touch in between is not their next touch", () => {
  const games = demoGames();
  const definition = parseDefinition({
    steps: [
      { actor: "me", kind: "touch", filters: [], within: null, after: null, next: false },
      { actor: "teammate", kind: "touch", filters: [], within: 2, after: null, next: true },
      { actor: "opponent", kind: "goal", filters: [], within: 12, after: null, next: false },
    ],
  });
  assert.ok(definition);
  assert.equal(buildScenarioReport(games, definition).occurrences, 0);
});

test("rejects a scenario step the catalog does not know", () => {
  assert.equal(parseDefinition({ steps: [{ actor: "me", kind: "pinch", filters: [], within: null, after: null, next: false }] }), null);
});

test("splits who touches next, and whether the next goal is theirs", () => {
  const game = syntheticGame([
    event(10, "fifty", "Alpha", 0, { boost: 40, third: "defensive", cars: homeCars() }),
    event(12, "touch", "Charlie", 1),
    event(18, "goal", "Charlie", 1),
    event(40, "fifty", "Alpha", 0, { boost: 55, third: "defensive", cars: homeCars() }),
    event(42, "touch", "Bravo", 0),
    event(50, "commit", "Alpha", 0, { boost: 12, third: "offensive" }),
    event(55, "goal", "Charlie", 1),
    event(70, "commit", "Alpha", 0, { boost: 8, third: "offensive" }),
  ]);
  const fifties = buildScenarioReport([game], preset("lost-fifty"));
  assert.equal(fifties.occurrences, 2);
  assert.equal(slice(fifties, "next-touch", "opponent"), 1);
  assert.equal(slice(fifties, "next-touch", "teammate"), 1);
  assert.equal(slice(fifties, "next-goal", "them"), 2);

  const commits = buildScenarioReport([game], preset("low-commit"));
  assert.equal(commits.occurrences, 2);
  assert.equal(slice(commits, "next-goal-soon", "them"), 1);
  assert.equal(slice(commits, "next-goal-soon", "none"), 1);
  assert.match(commits.outcomes.find((board) => board.id === "next-goal-soon")?.note ?? "", /1 times they score/);
});

test("a 50 only counts when you are home and your teammate is in their third", () => {
  const game = syntheticGame([
    event(10, "fifty", "Bravo", 0, { third: "offensive", cars: homeCars() }),
    event(14, "goal", "Charlie", 1),
    event(30, "fifty", "Bravo", 0, {
      third: "offensive",
      cars: [
        { name: "Alpha", team: 0, third: "offensive", half: "their", boost: 40, lastMan: false },
        { name: "Bravo", team: 0, third: "offensive", half: "their", boost: 30, lastMan: false },
        { name: "Charlie", team: 1, third: "defensive", half: "own", boost: 50, lastMan: true },
      ],
    }),
  ]);
  const report = buildScenarioReport([game], preset("home-fifty"));
  assert.equal(report.occurrences, 1);
  assert.equal(report.hits[0]?.nextGoal, "them");
  assert.equal(slice(report, "next-goal", "them"), 1);
  assert.equal(slice(report, "next-goal", "us"), 0);
});

function preset(id: string) {
  const found = PRESETS.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found.definition;
}

function slice(report: { outcomes: { id: string; slices: { id: string; count: number }[] }[] }, board: string, id: string) {
  return report.outcomes.find((item) => item.id === board)?.slices.find((item) => item.id === id)?.count;
}

function homeCars(): NonNullable<PlayEvent["cars"]> {
  return [
    { name: "Alpha", team: 0, third: "defensive", half: "own", boost: 40, lastMan: true },
    { name: "Bravo", team: 0, third: "offensive", half: "their", boost: 33, lastMan: false },
    { name: "Charlie", team: 1, third: "neutral", half: "own", boost: 50, lastMan: false },
    { name: "Delta", team: 1, third: "defensive", half: "own", boost: 44, lastMan: true },
  ];
}

function event(
  t: number,
  kind: string,
  player: string,
  team: 0 | 1,
  extra?: Partial<PlayEvent>,
): PlayEvent {
  return {
    t,
    kind,
    player,
    team,
    score0: 0,
    score1: 0,
    clock: 300 - t,
    ...extra,
  };
}

function syntheticGame(events: PlayEvent[]): ScenarioGame {
  return {
    id: "synthetic",
    playedAt: null,
    map: "DFH Stadium",
    team0Score: 0,
    team1Score: 2,
    userTeam: 0,
    userName: "Alpha",
    userWon: false,
    tracked: true,
    events,
  };
}
