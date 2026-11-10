import type {
  FieldHalf,
  FieldThird,
  FramePlayer,
  FrameSample,
  HeaderGame,
  PlayEvent,
} from "../replay/types";

const THIRD = 5120 / 3;
const TOUCH_RANGE = 320;
const FIFTY_RANGE = 380;
const MAX_EVENTS = 2500;

interface DemoLike {
  time: number;
  attacker: string;
  victim: string;
}

interface Vec {
  x: number;
  y: number;
  z: number;
  s: number;
}

interface Chase {
  farAt: number | null;
  farDist: number;
  close: boolean;
  touchedWhileClose: boolean;
}

export function extractEvents(header: HeaderGame, samples: FrameSample[] | null, demos: DemoLike[]): PlayEvent[] {
  const events: PlayEvent[] = [];
  const seen = new Set<string>();
  const lastTouch = new Map<string, number>();
  const chase = new Map<string, Chase>();
  const dribbleSince = new Map<string, number>();
  const dribbleSent = new Set<string>();
  let previousTouch: { t: number; player: string; team: 0 | 1; x: number; y: number } | null = null;
  let kickoffArmed = true;
  let kickoffUntil = 0;

  const push = (event: Omit<PlayEvent, "score0" | "score1">) => {
    if (events.length >= MAX_EVENTS) return;
    const key = `${event.t}|${event.kind}|${event.player ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    events.push({ ...event, score0: 0, score1: 0 });
  };

  if (samples && samples.length >= 2) {
    for (let index = 1; index < samples.length; index += 1) {
      const prev = samples[index - 1];
      const current = samples[index];
      const next = samples[index + 1] ?? null;
      const dt = current.time - prev.time;
      if (dt <= 0 || dt > 0.5) continue;
      if ((current.kickoffCountdown ?? 0) > 0.4) {
        kickoffArmed = true;
        kickoffUntil = current.time + 5;
        continue;
      }

      const incoming = ballVel(prev, current);
      const outgoing = next ? ballVel(current, next) : incoming;

      for (const player of current.players) {
        if (despawned(player)) continue;
        const before = prev.players.find((item) => item.name === player.name);
        if (!before || despawned(before)) continue;
        const speed = rate(before, player, dt);
        const distance = dist(player, current.ball);

        const boostDelta = player.boost - before.boost;
        if (boostDelta > 6) {
          const kind = boostDelta >= 40 ? "big_pad" : "small_pad";
          push(fact(current, player, speed, outgoing.s, kind));
          if (inTheirHalf(player)) push(fact(current, player, speed, outgoing.s, "boost_steal"));
        }
        if (before.boost >= 1 && player.boost < 1) push(fact(current, player, speed, outgoing.s, "zero_boost"));
        if (speed >= 2200 && rate(before, player, dt) >= 2200) {
          const earlier = samples[index - 2];
          const earlierPlayer = earlier?.players.find((item) => item.name === player.name);
          const earlierDt = earlier ? prev.time - earlier.time : 0;
          const earlierSpeed = earlierPlayer && earlierDt > 0 ? rate(earlierPlayer, before, earlierDt) : 0;
          if (earlierSpeed < 2200) push(fact(current, player, speed, outgoing.s, "supersonic"));
        }

        const state = chase.get(player.name) ?? {
          farAt: null,
          farDist: 0,
          close: false,
          touchedWhileClose: false,
        };
        if (distance > 950) {
          state.farAt = current.time;
          state.farDist = distance;
          state.close = false;
          state.touchedWhileClose = false;
          dribbleSince.delete(player.name);
          dribbleSent.delete(player.name);
        } else if (
          distance < 520 &&
          !state.close &&
          state.farAt != null &&
          current.time - state.farAt <= 1.6 &&
          state.farDist - distance > 400
        ) {
          state.close = true;
          const commit = fact(current, player, speed, outgoing.s, "commit");
          push(commit);
          if (commit.lastMan) push({ ...commit, kind: "last_man_commit" });
          const mate = current.players.find(
            (other) =>
              other.team === player.team &&
              other.name !== player.name &&
              !despawned(other) &&
              dist(other, current.ball) < 800,
          );
          if (mate) {
            push({
              ...commit,
              kind: "double_commit",
              other: mate.name,
              otherTeam: mate.team,
            });
          }
        } else if (distance < 520) {
          state.close = true;
        }
        if (state.close && distance > 1100 && !state.touchedWhileClose && state.farAt != null) {
          push(fact(current, player, speed, outgoing.s, "whiff"));
          state.close = false;
          state.touchedWhileClose = false;
        }
        chase.set(player.name, state);

        if (distance < 220 && player.z < 220 && current.ball.z < 280) {
          const since = dribbleSince.get(player.name) ?? current.time;
          dribbleSince.set(player.name, since);
          if (!dribbleSent.has(player.name) && current.time - since >= 0.8) {
            dribbleSent.add(player.name);
            push(fact(current, player, speed, outgoing.s, "dribble"));
          }
        } else if (distance > 320) {
          dribbleSince.delete(player.name);
          dribbleSent.delete(player.name);
        }
      }

      if (next && turned(incoming, outgoing)) {
        const candidates = current.players
          .filter((player) => !despawned(player))
          .map((player) => ({ player, distance: dist(player, current.ball) }))
          .filter((item) => item.distance <= TOUCH_RANGE)
          .sort((a, b) => a.distance - b.distance);
        const nearest = candidates[0];
        if (nearest) {
          const recent = lastTouch.get(nearest.player.name) ?? -10;
          if (current.time - recent >= 0.3) {
            lastTouch.set(nearest.player.name, current.time);
            const speed = playerSpeed(prev, current, nearest.player.name);
            const touch = fact(current, nearest.player, speed, outgoing.s, "touch");
            push(touch);
            const state = chase.get(nearest.player.name);
            if (state) state.touchedWhileClose = true;

            if (nearest.player.z > 300 || current.ball.z > 400) push({ ...touch, kind: "aerial" });
            const attack = attackSpeed(outgoing, nearest.player.team);
            if (attack > 700 && outgoing.s > 900 && touch.third !== "defensive") push({ ...touch, kind: "shot" });
            if (touch.third === "defensive" && attack > 800) push({ ...touch, kind: "clear" });
            const incomingAttack = attackSpeed(incoming, nearest.player.team);
            if (touch.half === "own" && incomingAttack < -700 && attack > 200) push({ ...touch, kind: "save" });
            if (Math.abs(current.ball.x) > 1400 && Math.abs(outgoing.x) > 400 && Math.sign(outgoing.x) !== Math.sign(current.ball.x)) {
              push({ ...touch, kind: "center" });
            }
            if ((kickoffArmed && ballNearCenter(samples, index)) || current.time <= kickoffUntil) {
              push({ ...touch, kind: "kickoff" });
              kickoffArmed = false;
            } else if (kickoffArmed) {
              kickoffArmed = false;
            }

            if (previousTouch && previousTouch.team === nearest.player.team && previousTouch.player !== nearest.player.name) {
              const gap = current.time - previousTouch.t;
              const travel = Math.hypot(current.ball.x - previousTouch.x, current.ball.y - previousTouch.y);
              if (gap <= 3.5 && travel >= 700) {
                const passer = current.players.find((player) => player.name === previousTouch?.player) ?? nearest.player;
                push({
                  ...fact(prev, passer, 0, incoming.s, "pass"),
                  t: roundTime(previousTouch.t),
                  other: nearest.player.name,
                  otherTeam: nearest.player.team,
                });
              }
            }
            if (!previousTouch || previousTouch.team !== nearest.player.team) {
              push({ ...touch, kind: "possession" });
            }
            previousTouch = {
              t: current.time,
              player: nearest.player.name,
              team: nearest.player.team,
              x: current.ball.x,
              y: current.ball.y,
            };

            const contest = candidates.find(
              (item) => item.player.team !== nearest.player.team && item.distance <= FIFTY_RANGE,
            );
            if (contest) {
              const otherSpeed = playerSpeed(prev, current, contest.player.name);
              push({
                ...touch,
                kind: "fifty",
                other: contest.player.name,
                otherTeam: contest.player.team,
              });
              push({
                ...fact(current, contest.player, otherSpeed, outgoing.s, "fifty"),
                other: nearest.player.name,
                otherTeam: nearest.player.team,
              });
              push({
                ...fact(current, contest.player, otherSpeed, outgoing.s, "touch"),
              });
              lastTouch.set(contest.player.name, current.time);
            }
          }
        }
      }
    }
  }

  const fps = header.recordFps > 0 ? header.recordFps : 30;
  for (const goal of header.goals) {
    const time = goal.frame / fps;
    const snapshot = samples ? nearest(samples, time) : null;
    const scorer = snapshot?.players.find((player) => player.name === goal.scorer);
    if (snapshot && scorer) {
      const prev = samples ? samples[Math.max(0, samples.indexOf(snapshot) - 1)] : null;
      const speed = prev ? playerSpeed(prev, snapshot, scorer.name) : 0;
      push({ ...fact(snapshot, scorer, speed, 0, "goal"), t: roundTime(time), team: goal.team, player: goal.scorer });
    } else {
      push({ t: roundTime(time), kind: "goal", player: goal.scorer, team: goal.team });
    }
  }

  for (const demo of demos) {
    const snapshot = samples ? nearest(samples, demo.time) : null;
    const attacker = snapshot?.players.find((player) => player.name === demo.attacker);
    const victim = snapshot?.players.find((player) => player.name === demo.victim);
    if (snapshot && attacker) {
      push({
        ...fact(snapshot, attacker, 0, 0, "demo"),
        t: roundTime(demo.time),
        other: demo.victim,
        otherTeam: victim?.team,
      });
    } else {
      push({ t: roundTime(demo.time), kind: "demo", player: demo.attacker, other: demo.victim });
    }
    if (snapshot && victim) {
      push({
        ...fact(snapshot, victim, 0, 0, "demoed"),
        t: roundTime(demo.time),
        other: demo.attacker,
        otherTeam: attacker?.team,
      });
    } else {
      push({ t: roundTime(demo.time), kind: "demoed", player: demo.victim, other: demo.attacker });
    }
  }

  events.sort((a, b) => a.t - b.t || a.kind.localeCompare(b.kind));
  let score0 = 0;
  let score1 = 0;
  let index = 0;
  while (index < events.length) {
    const time = events[index].t;
    let end = index;
    while (end < events.length && events[end].t === time) {
      events[end].score0 = score0;
      events[end].score1 = score1;
      end += 1;
    }
    for (let cursor = index; cursor < end; cursor += 1) {
      if (events[cursor].kind !== "goal") continue;
      if (events[cursor].team === 0) score0 += 1;
      else score1 += 1;
    }
    index = end;
  }
  return events;
}

function fact(
  sample: FrameSample,
  player: FramePlayer,
  speed: number,
  ballSpeed: number,
  kind: string,
): Omit<PlayEvent, "score0" | "score1"> {
  const mates = sample.players.filter((item) => item.team === player.team && !despawned(item));
  const back = [...mates].sort((a, b) => (player.team === 0 ? a.y - b.y : b.y - a.y))[0];
  return {
    t: roundTime(sample.time),
    kind,
    player: player.name,
    team: player.team,
    boost: Math.round(player.boost),
    speed: Math.round(speed),
    ballSpeed: Math.round(ballSpeed),
    height: Math.round(player.z),
    ballHeight: Math.round(sample.ball.z),
    distBall: Math.round(dist(player, sample.ball)),
    third: thirdOf(player),
    half: halfOf(player),
    air: player.z >= 120,
    lastMan: back?.name === player.name,
    clock: sample.secondsRemaining == null ? undefined : Math.round(sample.secondsRemaining),
    cars: carsAt(sample),
  };
}

function carsAt(sample: FrameSample): PlayEvent["cars"] {
  const alive = sample.players.filter((player) => !despawned(player));
  return alive.map((player) => {
    const mates = alive.filter((item) => item.team === player.team);
    const back = [...mates].sort((a, b) => (player.team === 0 ? a.y - b.y : b.y - a.y))[0];
    return {
      name: player.name,
      team: player.team,
      third: thirdOf(player),
      half: halfOf(player),
      boost: Math.round(player.boost),
      lastMan: back?.name === player.name,
    };
  });
}

function thirdOf(player: { y: number; team: 0 | 1 }): FieldThird {
  const forward = player.team === 0 ? player.y : -player.y;
  if (forward > THIRD) return "offensive";
  if (forward < -THIRD) return "defensive";
  return "neutral";
}

function halfOf(player: { y: number; team: 0 | 1 }): FieldHalf {
  const forward = player.team === 0 ? player.y : -player.y;
  return forward > 0 ? "their" : "own";
}

function inTheirHalf(player: { y: number; team: 0 | 1 }): boolean {
  return halfOf(player) === "their";
}

function turned(incoming: Vec, outgoing: Vec): boolean {
  if (incoming.s < 80 && outgoing.s < 80) return false;
  if (Math.abs(outgoing.s - incoming.s) > 700) return true;
  if (incoming.s < 200 || outgoing.s < 200) return Math.abs(outgoing.s - incoming.s) > 500;
  const dot = (incoming.x * outgoing.x + incoming.y * outgoing.y + incoming.z * outgoing.z) / (incoming.s * outgoing.s);
  return dot < 0.82;
}

function attackSpeed(velocity: Vec, team: 0 | 1): number {
  return team === 0 ? velocity.y : -velocity.y;
}

function ballVel(from: FrameSample, to: FrameSample): Vec {
  const dt = to.time - from.time;
  if (dt <= 0) return { x: 0, y: 0, z: 0, s: 0 };
  const x = (to.ball.x - from.ball.x) / dt;
  const y = (to.ball.y - from.ball.y) / dt;
  const z = (to.ball.z - from.ball.z) / dt;
  return { x, y, z, s: Math.hypot(x, y, z) };
}

function playerSpeed(prev: FrameSample, current: FrameSample, name: string): number {
  const before = prev.players.find((player) => player.name === name);
  const after = current.players.find((player) => player.name === name);
  if (!before || !after) return 0;
  return rate(before, after, current.time - prev.time);
}

function rate(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, dt: number): number {
  if (dt <= 0) return 0;
  return Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) / dt;
}

function dist(player: { x: number; y: number; z: number }, ball: { x: number; y: number; z: number }): number {
  return Math.hypot(player.x - ball.x, player.y - ball.y, player.z - ball.z);
}

function despawned(player: FramePlayer): boolean {
  return Math.hypot(player.x, player.y) < 40 && player.z < 20;
}

function ballNearCenter(samples: FrameSample[], index: number): boolean {
  const target = samples[index].time - 1;
  let best = samples[Math.max(0, index - 1)];
  for (let cursor = 0; cursor <= index; cursor += 1) {
    if (Math.abs(samples[cursor].time - target) < Math.abs(best.time - target)) best = samples[cursor];
  }
  return Math.hypot(best.ball.x, best.ball.y) < 450;
}

function nearest(samples: FrameSample[], time: number): FrameSample | null {
  let best: FrameSample | null = null;
  let gap = Number.POSITIVE_INFINITY;
  for (const sample of samples) {
    const delta = Math.abs(sample.time - time);
    if (delta < gap) {
      gap = delta;
      best = sample;
    }
  }
  return best;
}

function roundTime(time: number): number {
  return Math.round(time * 100) / 100;
}
