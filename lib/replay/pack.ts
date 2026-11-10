import type { FieldHalf, FieldThird, PlayCar, PlayEvent, StoredReplay } from "./types";

const THIRDS: FieldThird[] = ["defensive", "neutral", "offensive"];
const HALVES: FieldHalf[] = ["own", "their"];

interface PackedEvent {
  t: number;
  k: string;
  p?: number;
  o?: number;
  tm?: 0 | 1;
  ot?: 0 | 1;
  b?: number;
  s?: number;
  bs?: number;
  h?: number;
  bh?: number;
  d?: number;
  r?: number;
  f?: number;
  a?: 0 | 1;
  l?: 0 | 1;
  c?: number;
  s0: number;
  s1: number;
  cars?: Array<[number, 0 | 1, number, number, number, 0 | 1]>;
}

export interface PackedReplay extends Omit<StoredReplay, "events"> {
  pack: 1;
  names: string[];
  events?: PackedEvent[];
}

export function packReplay(replay: StoredReplay): PackedReplay {
  const names = roster(replay);
  const index = new Map(names.map((name, position) => [name, position]));
  const { events, ...rest } = replay;
  return {
    ...rest,
    pack: 1,
    names,
    events: events?.map((event) => packEvent(event, index)),
  };
}

export function unpackReplay(value: unknown): StoredReplay | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Partial<PackedReplay> & Partial<StoredReplay>;
  if (!Array.isArray(body.players) || !Array.isArray(body.goals)) return null;
  if (body.pack !== 1 || !Array.isArray(body.names)) return body as StoredReplay;
  const names = body.names.filter((name): name is string => typeof name === "string");
  const { pack: _pack, names: _names, events, ...rest } = body;
  return {
    ...(rest as StoredReplay),
    events: Array.isArray(events) ? events.map((event) => unpackEvent(event, names)) : undefined,
  };
}

function roster(replay: StoredReplay): string[] {
  const names: string[] = [];
  const add = (name?: string) => {
    if (name && !names.includes(name)) names.push(name);
  };
  for (const player of replay.players) add(player.name);
  for (const goal of replay.goals) add(goal.scorer);
  for (const event of replay.events ?? []) {
    add(event.player);
    add(event.other);
    for (const car of event.cars ?? []) add(car.name);
  }
  return names;
}

function packEvent(event: PlayEvent, index: Map<string, number>): PackedEvent {
  const packed: PackedEvent = { t: event.t, k: event.kind, s0: event.score0, s1: event.score1 };
  const player = index.get(event.player ?? "");
  const other = index.get(event.other ?? "");
  if (player != null) packed.p = player;
  if (other != null) packed.o = other;
  if (event.team != null) packed.tm = event.team;
  if (event.otherTeam != null) packed.ot = event.otherTeam;
  if (event.boost != null) packed.b = event.boost;
  if (event.speed != null) packed.s = event.speed;
  if (event.ballSpeed != null) packed.bs = event.ballSpeed;
  if (event.height != null) packed.h = event.height;
  if (event.ballHeight != null) packed.bh = event.ballHeight;
  if (event.distBall != null) packed.d = event.distBall;
  const third = THIRDS.indexOf(event.third ?? "defensive");
  const half = HALVES.indexOf(event.half ?? "own");
  if (event.third) packed.r = third;
  if (event.half) packed.f = half;
  if (typeof event.air === "boolean") packed.a = event.air ? 1 : 0;
  if (typeof event.lastMan === "boolean") packed.l = event.lastMan ? 1 : 0;
  if (event.clock != null) packed.c = event.clock;
  if (event.cars?.length) {
    packed.cars = event.cars.flatMap((car) => {
      const name = index.get(car.name);
      if (name == null) return [];
      return [[
        name,
        car.team,
        Math.max(0, THIRDS.indexOf(car.third)),
        Math.max(0, HALVES.indexOf(car.half)),
        car.boost,
        car.lastMan ? 1 : 0,
      ]];
    });
  }
  return packed;
}

function unpackEvent(value: unknown, names: string[]): PlayEvent {
  const event = value as PackedEvent;
  const player = names[event.p ?? -1];
  const other = names[event.o ?? -1];
  const unpacked: PlayEvent = {
    t: event.t,
    kind: event.k,
    score0: event.s0,
    score1: event.s1,
  };
  if (player) unpacked.player = player;
  if (other) unpacked.other = other;
  if (event.tm != null) unpacked.team = event.tm;
  if (event.ot != null) unpacked.otherTeam = event.ot;
  if (event.b != null) unpacked.boost = event.b;
  if (event.s != null) unpacked.speed = event.s;
  if (event.bs != null) unpacked.ballSpeed = event.bs;
  if (event.h != null) unpacked.height = event.h;
  if (event.bh != null) unpacked.ballHeight = event.bh;
  if (event.d != null) unpacked.distBall = event.d;
  if (event.r != null) unpacked.third = THIRDS[event.r];
  if (event.f != null) unpacked.half = HALVES[event.f];
  if (event.a != null) unpacked.air = event.a === 1;
  if (event.l != null) unpacked.lastMan = event.l === 1;
  if (event.c != null) unpacked.clock = event.c;
  if (event.cars?.length) {
    unpacked.cars = event.cars.flatMap((car): PlayCar[] => {
      const name = names[car[0]];
      const third = THIRDS[car[2]];
      const half = HALVES[car[3]];
      if (!name || (car[1] !== 0 && car[1] !== 1) || !third || !half) return [];
      return [{ name, team: car[1], third, half, boost: car[4], lastMan: car[5] === 1 }];
    });
  }
  return unpacked;
}
