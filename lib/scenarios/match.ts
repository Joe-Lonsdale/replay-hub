import { eventLabel, outcomeWindowOf } from "./catalog";
import type { PlayCar, PlayEvent } from "../replay/types";
import type {
  OutcomeBoard,
  ScenarioDefinition,
  ScenarioFilter,
  ScenarioGame,
  ScenarioHit,
  ScenarioReport,
  ScenarioStep,
} from "./types";

const OPEN_GAP = 20;
const SAME_MOMENT = 0.05;
const HIT_LIMIT = 200;

type TouchRole = "me" | "teammate" | "opponent" | "none" | "unknown";
type GoalSide = "us" | "them" | "none" | "unknown";

interface FactBag {
  t: number;
  boost?: number;
  speed?: number;
  ballSpeed?: number;
  height?: number;
  ballHeight?: number;
  distBall?: number;
  third?: PlayEvent["third"];
  half?: PlayEvent["half"];
  air?: boolean;
  lastMan?: boolean;
  clock?: number;
  score0: number;
  score1: number;
}

export function matchScenario(game: ScenarioGame, definition: ScenarioDefinition): ScenarioHit[] {
  const steps = definition.steps;
  if (!steps.length || !game.tracked) return [];
  const hits: ScenarioHit[] = [];
  for (let start = 0; start < game.events.length; start += 1) {
    if (!stepFits(game.events[start], steps[0], game)) continue;
    const indexes = [start];
    let previous = start;
    let matched = true;
    for (let stepIndex = 1; stepIndex < steps.length; stepIndex += 1) {
      const found = findLater(game, steps[stepIndex], previous + 1, game.events[previous].t);
      if (found < 0) {
        matched = false;
        break;
      }
      indexes.push(found);
      previous = found;
    }
    if (!matched) continue;
    const first = game.events[indexes[0]];
    const last = game.events[indexes[indexes.length - 1]];
    const windowSec = outcomeWindowOf(definition);
    const touch = firstAfter(game.events, last.t, "touch", windowSec);
    const goalSoon = firstAfter(game.events, last.t, "goal", windowSec);
    const goalLater = firstAfter(game.events, last.t, "goal", null);
    const nextTouch = touchRole(touch, game);
    const nextGoalSoon = goalSide(goalSoon, game);
    const nextGoal = goalSide(goalLater, game);
    hits.push({
      replayId: game.id,
      playedAt: game.playedAt,
      map: game.map,
      won: game.userWon,
      ours: sideScore(game, true),
      theirs: sideScore(game, false),
      start: first.t,
      end: last.t,
      clock: first.clock ?? null,
      text: indexes
        .map((index) => {
          const event = game.events[index];
          const who = event.player ?? "Someone";
          const when = formatMmss(event.clock ?? event.t);
          return `${who} ${eventLabel(event.kind).toLowerCase()} ${when}`;
        })
        .join(" → "),
      nextTouch,
      nextTouchText: touchText(touch, nextTouch, windowSec),
      nextGoalSoon,
      nextGoalSoonText: goalText(goalSoon, nextGoalSoon, windowSec),
      nextGoal,
      nextGoalText: goalText(goalLater, nextGoal, null),
    });
  }
  return hits;
}

export function buildScenarioReport(games: ScenarioGame[], definition: ScenarioDefinition): ScenarioReport {
  let tracked = 0;
  let stale = 0;
  let occurrences = 0;
  let gamesHit = 0;
  let hitsInWins = 0;
  let hitsInLosses = 0;
  const hits: ScenarioHit[] = [];
  for (const game of games) {
    if (!game.tracked) {
      stale += 1;
      continue;
    }
    tracked += 1;
    const found = matchScenario(game, definition);
    if (!found.length) continue;
    gamesHit += 1;
    occurrences += found.length;
    if (game.userWon === true) hitsInWins += found.length;
    if (game.userWon === false) hitsInLosses += found.length;
    hits.push(...found);
  }
  const windowSec = outcomeWindowOf(definition);
  return {
    games: games.length,
    tracked,
    stale,
    occurrences,
    gamesHit,
    hitsInWins,
    hitsInLosses,
    perGame: tracked ? Math.round((occurrences / tracked) * 10) / 10 : 0,
    hits: hits.slice(0, HIT_LIMIT),
    outcomes: outcomeBoards(hits, windowSec),
  };
}

function findLater(game: ScenarioGame, step: ScenarioStep, from: number, previousTime: number): number {
  const minGap = step.after ?? 0;
  const maxGap = step.within ?? OPEN_GAP;
  for (let index = from; index < game.events.length; index += 1) {
    const event = game.events[index];
    const gap = event.t - previousTime;
    if (gap <= SAME_MOMENT) continue;
    if (gap > maxGap) return -1;
    if (step.next) {
      if (event.kind !== step.kind) continue;
      if (gap < minGap) return -1;
      return stepFits(event, step, game) ? index : -1;
    }
    if (gap < minGap) continue;
    if (stepFits(event, step, game)) return index;
  }
  return -1;
}

function stepFits(event: PlayEvent, step: ScenarioStep, game: ScenarioGame): boolean {
  if (event.kind !== step.kind) return false;
  if (!actorFits(event, step, game)) return false;
  return step.filters.every((filter) => filterFits(event, filter, game));
}

function actorFits(event: PlayEvent, step: ScenarioStep, game: ScenarioGame): boolean {
  if (step.actor === "anyone") return true;
  if (!game.userName || game.userTeam == null || event.team == null) return false;
  const mine = event.player === game.userName;
  const same = event.team === game.userTeam;
  if (step.actor === "me") return mine;
  if (step.actor === "teammate") return same && !mine;
  if (step.actor === "us") return same;
  return !same;
}

function filterFits(event: PlayEvent, filter: ScenarioFilter, game: ScenarioGame): boolean {
  const bags = subjects(event, filter.who ?? "actor", game);
  return bags.some((bag) => compare(readFact(bag, filter.field, game.userTeam), filter));
}

function subjects(event: PlayEvent, who: string, game: ScenarioGame): FactBag[] {
  if (who === "actor") return [event];
  if (!game.userName || game.userTeam == null) return [];
  const cars = event.cars ?? [];
  const picked =
    who === "me"
      ? cars.filter((car) => car.name === game.userName)
      : who === "teammate"
        ? cars.filter((car) => car.team === game.userTeam && car.name !== game.userName)
        : cars.filter((car) => car.team !== game.userTeam);
  return picked.map((car) => carBag(event, car));
}

function carBag(event: PlayEvent, car: PlayCar): FactBag {
  return {
    t: event.t,
    boost: car.boost,
    ballSpeed: event.ballSpeed,
    ballHeight: event.ballHeight,
    third: car.third,
    half: car.half,
    lastMan: car.lastMan,
    clock: event.clock,
    score0: event.score0,
    score1: event.score1,
  };
}

function compare(actual: number | string | null, filter: ScenarioFilter): boolean {
  if (actual == null) return false;
  if (typeof actual === "string" || typeof filter.value === "string") {
    const same = String(actual) === String(filter.value);
    return filter.op === "eq" ? same : filter.op === "neq" ? !same : false;
  }
  const expected = Number(filter.value);
  if (filter.op === "lt") return actual < expected;
  if (filter.op === "lte") return actual <= expected;
  if (filter.op === "gt") return actual > expected;
  if (filter.op === "gte") return actual >= expected;
  if (filter.op === "eq") return actual === expected;
  return actual !== expected;
}

function readFact(event: FactBag, field: string, userTeam: 0 | 1 | null): number | string | null {
  if (field === "time") return event.t;
  if (field === "scoreDiff") {
    if (userTeam == null) return null;
    const mine = userTeam === 0 ? event.score0 : event.score1;
    const theirs = userTeam === 0 ? event.score1 : event.score0;
    return mine - theirs;
  }
  if (field === "air") {
    if (event.air == null) return null;
    return event.air ? "air" : "ground";
  }
  if (field === "lastMan") {
    if (event.lastMan == null) return null;
    return event.lastMan ? "yes" : "no";
  }
  const value = event[field as keyof FactBag];
  if (typeof value === "number" || typeof value === "string") return value;
  return null;
}

function sideScore(game: ScenarioGame, ours: boolean): number | null {
  if (game.userTeam == null) return null;
  const team0 = ours ? game.userTeam === 0 : game.userTeam === 1;
  return team0 ? game.team0Score : game.team1Score;
}

function firstAfter(events: PlayEvent[], after: number, kind: string, windowSec: number | null): PlayEvent | null {
  for (const event of events) {
    const gap = event.t - after;
    if (gap <= SAME_MOMENT) continue;
    if (windowSec != null && gap > windowSec) return null;
    if (event.kind === kind) return event;
  }
  return null;
}

function touchRole(event: PlayEvent | null, game: ScenarioGame): TouchRole {
  if (!event) return "none";
  if (!game.userName || game.userTeam == null || event.team == null) return "unknown";
  if (event.player === game.userName) return "me";
  if (event.team === game.userTeam) return "teammate";
  return "opponent";
}

function goalSide(event: PlayEvent | null, game: ScenarioGame): GoalSide {
  if (!event) return "none";
  if (game.userTeam == null || event.team == null) return "unknown";
  return event.team === game.userTeam ? "us" : "them";
}

function touchText(event: PlayEvent | null, role: TouchRole, windowSec: number): string {
  if (!event || role === "none") return `Nobody touches it within ${trim(windowSec)}s`;
  const name = event.player ?? "Someone";
  const side = role === "me" ? "you" : role === "teammate" ? "teammate" : role === "opponent" ? "opponents" : "someone";
  return `${name} (${side}) touches next at ${formatMmss(event.clock ?? event.t)}`;
}

function goalText(event: PlayEvent | null, side: GoalSide, windowSec: number | null): string {
  if (!event || side === "none") {
    return windowSec == null ? "No goal after this" : `Nobody scores within ${trim(windowSec)}s`;
  }
  const name = event.player ?? "Someone";
  if (side === "us") return `${name} scores for you at ${formatMmss(event.clock ?? event.t)}`;
  if (side === "them") return `${name} scores against you at ${formatMmss(event.clock ?? event.t)}`;
  return `${name} scores at ${formatMmss(event.clock ?? event.t)}`;
}

function outcomeBoards(hits: ScenarioHit[], windowSec: number): OutcomeBoard[] {
  const touch = countSlices(hits, (hit) => hit.nextTouch, [
    ["me", "You"],
    ["teammate", "Teammate"],
    ["opponent", "Opponents"],
    ["none", "Nobody"],
  ]);
  const soon = countSlices(hits, (hit) => hit.nextGoalSoon, [
    ["them", "They score"],
    ["us", "You score"],
    ["none", "Neither"],
  ]);
  const later = countSlices(hits, (hit) => hit.nextGoal, [
    ["them", "Opponents"],
    ["us", "Your team"],
    ["none", "No goal"],
  ]);
  const theyScore = soon.find((slice) => slice.id === "them")?.count ?? 0;
  const theyDont = hits.length - theyScore;
  return [
    { id: "next-touch", title: `Who touches it next, within ${trim(windowSec)}s`, note: null, slices: touch },
    {
      id: "next-goal-soon",
      title: `Who scores within ${trim(windowSec)}s`,
      note: hits.length ? `${theyScore} times they score. ${theyDont} times they don't.` : null,
      slices: soon,
    },
    { id: "next-goal", title: "Which team scores next", note: null, slices: later },
  ];
}

function countSlices(
  hits: ScenarioHit[],
  read: (hit: ScenarioHit) => string,
  rows: [string, string][],
): OutcomeBoard["slices"] {
  const counts = new Map<string, number>();
  for (const hit of hits) counts.set(read(hit), (counts.get(read(hit)) ?? 0) + 1);
  const known = new Set(rows.map(([id]) => id));
  const slices = rows.map(([id, label]) => ({ id, label, count: counts.get(id) ?? 0 }));
  for (const [id, count] of counts) {
    if (!known.has(id) && count > 0) slices.push({ id, label: id, count });
  }
  return slices;
}

function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

function formatMmss(seconds: number): string {
  const sign = seconds < 0 ? "-" : "";
  const whole = Math.abs(Math.round(seconds));
  return `${sign}${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
