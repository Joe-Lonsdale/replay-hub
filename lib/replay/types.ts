export type Playlist = "duel" | "doubles" | "standard" | "extra" | "unknown";

export type GoalTag =
  | "kickoff"
  | "open_net"
  | "double_commit"
  | "last_man_out"
  | "low_boost"
  | "counterattack"
  | "overcommit"
  | "late_game"
  | "first_minute"
  | "overtime"
  | "demo"
  | "fast_break";

export interface DeepStats {
  boostCollected: number;
  boostStolen: number;
  bigPads: number;
  smallPads: number;
  boostUsed: number;
  timeZeroBoost: number;
  timeFullBoost: number;
  timeLowBoost: number;
  bpm: number;
  avgSpeed: number;
  timeSupersonic: number;
  timeBoostSpeed: number;
  timeSlow: number;
  timeGround: number;
  timeLowAir: number;
  timeHighAir: number;
  distance: number;
  avgDistanceToBall: number;
  avgDistanceToMate: number | null;
  timeDefensiveThird: number;
  timeNeutralThird: number;
  timeOffensiveThird: number;
  timeBehindBall: number;
  timeInFrontBall: number;
  timeMostBack: number;
  percentDefensiveThird: number;
  percentOffensiveThird: number;
  percentBehindBall: number;
  percentSupersonic: number;
  percentZeroBoost: number;
  goalsAgainstWhileLast: number;
  demosInflicted: number;
  demosTaken: number;
}

export interface StoredPlayer {
  name: string;
  platform: string | null;
  onlineId: string | null;
  team: 0 | 1;
  bot: boolean;
  score: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  shootingPct: number | null;
  deep: DeepStats | null;
}

export interface BoostSnapshot {
  name: string;
  team: 0 | 1;
  boost: number;
}

export interface StoredGoal {
  time: number;
  frame: number;
  secondsRemaining: number | null;
  scorer: string;
  team: 0 | 1;
  tags: GoalTag[];
  detail: string;
  lastMan: string | null;
  boosts: BoostSnapshot[];
}

export type FieldThird = "defensive" | "neutral" | "offensive";
export type FieldHalf = "own" | "their";

/** Where one car was when an event happened. Thirds are from that car's own goal. */
export interface PlayCar {
  name: string;
  team: 0 | 1;
  third: FieldThird;
  half: FieldHalf;
  boost: number;
  lastMan: boolean;
}

/** One thing that happened in a replay. Facts are about `player`. `cars` is everyone at that moment. */
export interface PlayEvent {
  t: number;
  kind: string;
  player?: string;
  other?: string;
  team?: 0 | 1;
  otherTeam?: 0 | 1;
  boost?: number;
  speed?: number;
  ballSpeed?: number;
  height?: number;
  ballHeight?: number;
  distBall?: number;
  third?: FieldThird;
  half?: FieldHalf;
  air?: boolean;
  lastMan?: boolean;
  clock?: number;
  score0: number;
  score1: number;
  cars?: PlayCar[];
}

export interface StoredReplay {
  parserVersion: 1 | 2;
  depth: "header" | "frames";
  matchGuid: string | null;
  name: string;
  mapName: string;
  mapLabel: string;
  playedAt: string | null;
  playlist: Playlist;
  matchType: string | null;
  gameType: string;
  buildVersion: string | null;
  teamSize: number;
  durationSeconds: number;
  overtime: boolean;
  forfeit: boolean;
  noContest: boolean;
  countable: boolean;
  team0Score: number;
  team1Score: number;
  players: StoredPlayer[];
  goals: StoredGoal[];
  warnings: string[];
  /** Present when parserVersion is 2. Empty means the replay was read and nothing was detected. */
  events?: PlayEvent[];
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface FramePlayer {
  name: string;
  team: 0 | 1;
  x: number;
  y: number;
  z: number;
  boost: number;
}

export interface FrameSample {
  time: number;
  secondsRemaining: number | null;
  kickoffCountdown: number | null;
  ball: Vec3;
  players: FramePlayer[];
}

export interface HeaderPlayer {
  name: string;
  platform: string | null;
  onlineId: string | null;
  team: 0 | 1;
  bot: boolean;
  score: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
}

export interface HeaderGoal {
  frame: number;
  scorer: string;
  team: 0 | 1;
}

export interface HeaderGame {
  matchGuid: string | null;
  name: string;
  mapName: string;
  mapLabel: string;
  playedAt: string | null;
  playlist: Playlist;
  matchType: string | null;
  gameType: string;
  buildVersion: string | null;
  teamSize: number;
  durationSeconds: number;
  recordFps: number;
  overtime: boolean;
  forfeit: boolean;
  noContest: boolean;
  team0Score: number;
  team1Score: number;
  players: HeaderPlayer[];
  goals: HeaderGoal[];
  warnings: string[];
}
