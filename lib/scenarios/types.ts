import type { PlayEvent } from "../replay/types";

export type ScenarioActor = "me" | "teammate" | "us" | "opponent" | "anyone";

export type FilterOp = "lt" | "lte" | "gt" | "gte" | "eq" | "neq";

export type FilterWho = "actor" | "me" | "teammate" | "opponent";

export interface ScenarioFilter {
  field: string;
  op: FilterOp;
  value: number | string;
  /** Whose car the condition reads. `actor` is the player in the step. */
  who?: FilterWho;
}

export interface ScenarioStep {
  actor: ScenarioActor;
  kind: string;
  filters: ScenarioFilter[];
  /** Max seconds after the previous step. Blank means 20. Ignored on the first step. */
  within: number | null;
  /** Min seconds after the previous step. Ignored on the first step. */
  after: number | null;
  /**
   * The first later event of this kind has to be the one that matches.
   * A teammate touch in between means an "opponents' next touch" chain fails.
   */
  next: boolean;
}

export interface ScenarioDefinition {
  steps: ScenarioStep[];
  /** Seconds after the chain to judge the next touch and the next goal. */
  outcomeWindow?: number;
}

export interface ScenarioGame {
  id: string;
  playedAt: string | null;
  map: string;
  team0Score: number;
  team1Score: number;
  userTeam: 0 | 1 | null;
  userName: string | null;
  userWon: boolean | null;
  tracked: boolean;
  events: PlayEvent[];
}

export interface ScenarioHit {
  replayId: string;
  playedAt: string | null;
  map: string;
  won: boolean | null;
  ours: number | null;
  theirs: number | null;
  start: number;
  end: number;
  clock: number | null;
  text: string;
  nextTouch: string;
  nextTouchText: string;
  nextGoalSoon: string;
  nextGoalSoonText: string;
  nextGoal: string;
  nextGoalText: string;
}

export interface OutcomeSlice {
  id: string;
  label: string;
  count: number;
}

export interface OutcomeBoard {
  id: string;
  title: string;
  note: string | null;
  slices: OutcomeSlice[];
}

export interface ScenarioReport {
  games: number;
  tracked: number;
  stale: number;
  occurrences: number;
  gamesHit: number;
  hitsInWins: number;
  hitsInLosses: number;
  perGame: number;
  hits: ScenarioHit[];
  outcomes: OutcomeBoard[];
}
