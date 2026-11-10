import { extractEvents } from "../scenarios/extract";
import type {
  DeepStats,
  FramePlayer,
  FrameSample,
  GoalTag,
  HeaderGame,
  HeaderPlayer,
  StoredGoal,
  StoredPlayer,
  StoredReplay,
} from "./types";

const FIELD_HALF = 5120;
const THIRD = FIELD_HALF / 3;
const REGULATION_SECONDS = 300;
const SUPERSONIC = 2200;
const BOOST_SPEED = 1410;
const GROUND_Z = 120;
const LOW_AIR_Z = 400;

const TAG_DETAIL: Record<GoalTag, string> = {
  kickoff: "Kickoff goal",
  open_net: "nobody was home",
  double_commit: "both players committed",
  last_man_out: "last man was past the ball",
  low_boost: "last man was low on boost",
  counterattack: "it came straight back from their half",
  overcommit: "both players were in the opponent third",
  late_game: "under a minute left",
  first_minute: "inside the first minute",
  overtime: "overtime",
  demo: "a demo was part of the play",
  fast_break: "the ball travelled the length of the field",
};

export function buildReplay(header: HeaderGame, samples: FrameSample[] | null): StoredReplay {
  const usable = samples && samples.length > 0 ? samples : null;
  const demos = usable ? detectDemos(usable) : [];
  const deepByName = usable ? summarizePlayers(header, usable, demos) : new Map<string, DeepStats>();
  const players = header.players.map((player) => toStoredPlayer(player, deepByName.get(player.name) ?? null));
  const goals = tagGoals(header, usable, demos);
  const countable = !header.noContest && header.durationSeconds >= 20;

  return {
    parserVersion: 2,
    depth: usable ? "frames" : "header",
    matchGuid: header.matchGuid,
    name: header.name,
    mapName: header.mapName,
    mapLabel: header.mapLabel,
    playedAt: header.playedAt,
    playlist: header.playlist,
    matchType: header.matchType,
    gameType: header.gameType,
    buildVersion: header.buildVersion,
    teamSize: header.teamSize,
    durationSeconds: header.durationSeconds,
    overtime: header.overtime || goals.some((goal) => goal.tags.includes("overtime")),
    forfeit: header.forfeit,
    noContest: header.noContest,
    countable,
    team0Score: header.team0Score,
    team1Score: header.team1Score,
    players,
    goals,
    warnings: header.warnings,
    events: extractEvents(header, usable, demos),
  };
}

function toStoredPlayer(player: HeaderPlayer, deep: DeepStats | null): StoredPlayer {
  return {
    ...player,
    shootingPct: player.shots > 0 ? (player.goals / player.shots) * 100 : null,
    deep,
  };
}

function tagGoals(
  header: HeaderGame,
  samples: FrameSample[] | null,
  demos: DemoEvent[],
): StoredGoal[] {
  const kickoffs = samples ? kickoffTouchTimes(samples) : [];
  return header.goals.map((goal) => {
    const time = header.recordFps > 0 ? goal.frame / header.recordFps : 0;
    const snapshot = samples ? nearestAtOrBefore(samples, time - 0.35) : null;
    const secondsRemaining = snapshot?.secondsRemaining ?? inferredRemaining(header, time);
    const tags = new Set<GoalTag>();
    const kickoff = isKickoff(time, kickoffs, samples);

    if (kickoff) tags.add("kickoff");
    if (secondsRemaining != null && secondsRemaining <= 0) tags.add("overtime");
    else if (secondsRemaining != null && secondsRemaining <= 60 && time > 12) tags.add("late_game");
    if (time <= 60 && !kickoff) tags.add("first_minute");

    let lastMan: string | null = null;
    let boosts: StoredGoal["boosts"] = [];

    if (snapshot && !kickoff) {
      const conceding = (goal.team === 0 ? 1 : 0) as 0 | 1;
      const mates = snapshot.players.filter((player) => player.team === conceding);
      const ball = snapshot.ball;
      lastMan = mostBack(mates, conceding)?.name ?? null;
      boosts = snapshot.players.map((player) => ({
        name: player.name,
        team: player.team,
        boost: Math.round(player.boost),
      }));

      if (mates.length >= 2 && mates.every((player) => pastBall(player, ball.y, conceding))) {
        tags.add("double_commit");
        tags.add("last_man_out");
      } else if (lastMan) {
        const defender = mates.find((player) => player.name === lastMan);
        if (defender && !betweenBallAndGoal(defender, ball.y, conceding)) tags.add("last_man_out");
      }

      if (mates.length >= 2 && mates.every((player) => inOpponentHalf(player, conceding))) {
        tags.add("open_net");
      }
      if (mates.length >= 2 && mates.every((player) => inOffensiveThird(player, conceding))) {
        tags.add("overcommit");
      }

      const defender = mates.find((player) => player.name === lastMan);
      if (defender && defender.boost < 12) tags.add("low_boost");

      const earlier = nearestAtOrBefore(samples!, snapshot.time - 2.5);
      if (earlier && inOffensiveThird({ y: earlier.ball.y }, conceding)) tags.add("counterattack");

      const oneSecond = nearestAtOrBefore(samples!, snapshot.time - 1);
      if (oneSecond) {
        const travel = towardOwnGoal(oneSecond.ball.y, ball.y, conceding);
        if (travel > 2500) tags.add("fast_break");
      }

      const recentDemo = demos.some(
        (demo) =>
          demo.victimTeam === conceding && demo.time <= time && time - demo.time < 2.5,
      );
      if (recentDemo) tags.add("demo");
    } else if (!samples && time < 12) {
      tags.add("kickoff");
    }

    const ordered = orderTags([...tags]);
    return {
      time,
      frame: goal.frame,
      secondsRemaining,
      scorer: goal.scorer,
      team: goal.team,
      tags: ordered,
      detail: ordered.length ? ordered.map((tag) => TAG_DETAIL[tag]).join(". ") : "Scored",
      lastMan,
      boosts,
    };
  });
}

function orderTags(tags: GoalTag[]): GoalTag[] {
  const rank: GoalTag[] = [
    "kickoff",
    "open_net",
    "double_commit",
    "last_man_out",
    "overcommit",
    "counterattack",
    "fast_break",
    "low_boost",
    "demo",
    "first_minute",
    "late_game",
    "overtime",
  ];
  return rank.filter((tag) => tags.includes(tag));
}

function inferredRemaining(header: HeaderGame, time: number): number | null {
  if (header.playlist === "extra") return null;
  return REGULATION_SECONDS - time;
}

function isKickoff(time: number, touches: number[], samples: FrameSample[] | null): boolean {
  if (touches.some((touch) => time - touch >= 0 && time - touch <= 12)) return true;
  if (!samples && time < 12) return true;
  return false;
}

function kickoffTouchTimes(samples: FrameSample[]): number[] {
  const times: number[] = [];
  let centered = false;
  for (const sample of samples) {
    const countdown = sample.kickoffCountdown ?? 0;
    const atCenter = Math.hypot(sample.ball.x, sample.ball.y) < 250;
    if (countdown > 0.4 || atCenter) centered = true;
    if (centered && Math.hypot(sample.ball.x, sample.ball.y) > 450) {
      times.push(sample.time);
      centered = false;
    }
  }
  return times;
}

interface DemoEvent {
  time: number;
  attacker: string;
  victim: string;
  victimTeam: 0 | 1;
}

function detectDemos(samples: FrameSample[]): DemoEvent[] {
  const events: DemoEvent[] = [];
  const cooled = new Map<string, number>();
  for (let i = 1; i < samples.length - 1; i += 1) {
    const prev = samples[i - 1];
    const current = samples[i];
    const next = samples[i + 1];
    const dt = current.time - prev.time;
    if (dt <= 0 || dt > 0.4) continue;
    for (const victim of next.players) {
      const before = prev.players.find((player) => player.name === victim.name);
      const now = current.players.find((player) => player.name === victim.name);
      if (!before || !now) continue;
      const beforeSpeed = speedBetween(before, now, dt);
      const afterSpeed = speedBetween(now, victim, next.time - current.time);
      if (beforeSpeed < 500 || afterSpeed > 350) continue;
      const attacker = current.players.find((player) => {
        if (player.name === victim.name || player.team === victim.team) return false;
        const previous = prev.players.find((item) => item.name === player.name);
        if (!previous) return false;
        const attackerSpeed = speedBetween(previous, player, dt);
        const distance = Math.hypot(player.x - now.x, player.y - now.y, player.z - now.z);
        return attackerSpeed > 2100 && distance < 280;
      });
      if (!attacker) continue;
      const last = cooled.get(victim.name) ?? -10;
      if (current.time - last < 3) continue;
      cooled.set(victim.name, current.time);
      events.push({
        time: current.time,
        attacker: attacker.name,
        victim: victim.name,
        victimTeam: victim.team,
      });
    }
  }
  return events;
}

function summarizePlayers(
  header: HeaderGame,
  samples: FrameSample[],
  demos: DemoEvent[],
): Map<string, DeepStats> {
  const names = header.players.map((player) => player.name);
  const acc = new Map<string, Accumulator>(names.map((name) => [name, emptyAccum()]));

  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1];
    const current = samples[i];
    const dt = current.time - prev.time;
    if (dt <= 0 || dt > 0.5) continue;
    if ((current.kickoffCountdown ?? 0) > 0.4) continue;

    for (const player of current.players) {
      const bucket = acc.get(player.name);
      const before = prev.players.find((item) => item.name === player.name);
      if (!bucket || !before || despawned(player) || despawned(before)) continue;
      const presentSpeed = speedBetween(before, player, dt);
      bucket.present += dt;
      bucket.distance += presentSpeed * dt;
      bucket.speedSum += presentSpeed * dt;
      if (presentSpeed >= SUPERSONIC) bucket.supersonic += dt;
      else if (presentSpeed >= BOOST_SPEED) bucket.boostSpeed += dt;
      else bucket.slow += dt;

      if (player.z < GROUND_Z) bucket.ground += dt;
      else if (player.z < LOW_AIR_Z) bucket.lowAir += dt;
      else bucket.highAir += dt;

      if (player.boost < 1) bucket.zero += dt;
      if (player.boost >= 99) bucket.full += dt;
      if (player.boost < 25) bucket.lowBoost += dt;

      const boostDelta = player.boost - before.boost;
      if (boostDelta > 6) {
        bucket.collected += boostDelta;
        if (boostDelta >= 40) bucket.big += 1;
        else bucket.small += 1;
        if (inOpponentHalf(player, player.team)) bucket.stolen += boostDelta;
      } else if (boostDelta < 0) {
        bucket.used += -boostDelta;
      }

      const ballDistance = Math.hypot(
        player.x - current.ball.x,
        player.y - current.ball.y,
        player.z - current.ball.z,
      );
      bucket.ballDistance += ballDistance * dt;
      const mates = current.players.filter(
        (mate) => mate.team === player.team && mate.name !== player.name && !despawned(mate),
      );
      if (mates.length) {
        const mateDistance =
          mates.reduce(
            (sum, mate) => sum + Math.hypot(player.x - mate.x, player.y - mate.y, player.z - mate.z),
            0,
          ) / mates.length;
        bucket.mateDistance += mateDistance * dt;
        bucket.mateTime += dt;
      }

      if (inDefensiveThird(player, player.team)) bucket.defensive += dt;
      else if (inOffensiveThird(player, player.team)) bucket.offensive += dt;
      else bucket.neutral += dt;

      if (behindBall(player, current.ball.y)) bucket.behind += dt;
      else bucket.inFront += dt;

      const back = mostBack(
        current.players.filter((mate) => mate.team === player.team && !despawned(mate)),
        player.team,
      );
      if (back?.name === player.name) bucket.mostBack += dt;
    }
  }

  const goalsAgainst = buildReplayGoalsForLastMan(header, samples);
  const result = new Map<string, DeepStats>();
  for (const player of header.players) {
    const bucket = acc.get(player.name) ?? emptyAccum();
    const minutes = bucket.present / 60;
    const lastGoals = goalsAgainst.filter((goal) => goal.lastMan === player.name).length;
    result.set(player.name, {
      boostCollected: round(bucket.collected),
      boostStolen: round(bucket.stolen),
      bigPads: bucket.big,
      smallPads: bucket.small,
      boostUsed: round(bucket.used),
      timeZeroBoost: round(bucket.zero),
      timeFullBoost: round(bucket.full),
      timeLowBoost: round(bucket.lowBoost),
      bpm: minutes > 0 ? round(bucket.used / minutes) : 0,
      avgSpeed: bucket.present > 0 ? round(bucket.speedSum / bucket.present) : 0,
      timeSupersonic: round(bucket.supersonic),
      timeBoostSpeed: round(bucket.boostSpeed),
      timeSlow: round(bucket.slow),
      timeGround: round(bucket.ground),
      timeLowAir: round(bucket.lowAir),
      timeHighAir: round(bucket.highAir),
      distance: round(bucket.distance),
      avgDistanceToBall: bucket.present > 0 ? round(bucket.ballDistance / bucket.present) : 0,
      avgDistanceToMate: bucket.mateTime > 0 ? round(bucket.mateDistance / bucket.mateTime) : null,
      timeDefensiveThird: round(bucket.defensive),
      timeNeutralThird: round(bucket.neutral),
      timeOffensiveThird: round(bucket.offensive),
      timeBehindBall: round(bucket.behind),
      timeInFrontBall: round(bucket.inFront),
      timeMostBack: round(bucket.mostBack),
      percentDefensiveThird: percent(bucket.defensive, bucket.present),
      percentOffensiveThird: percent(bucket.offensive, bucket.present),
      percentBehindBall: percent(bucket.behind, bucket.present),
      percentSupersonic: percent(bucket.supersonic, bucket.present),
      percentZeroBoost: percent(bucket.zero, bucket.present),
      goalsAgainstWhileLast: lastGoals,
      demosInflicted: demos.filter((demo) => demo.attacker === player.name).length,
      demosTaken: demos.filter((demo) => demo.victim === player.name).length,
    });
  }
  return result;
}

function buildReplayGoalsForLastMan(header: HeaderGame, samples: FrameSample[]): { lastMan: string | null }[] {
  return header.goals.map((goal) => {
    const time = header.recordFps > 0 ? goal.frame / header.recordFps : 0;
    const snapshot = nearestAtOrBefore(samples, time - 0.35);
    if (!snapshot) return { lastMan: null };
    const conceding = (goal.team === 0 ? 1 : 0) as 0 | 1;
    const mates = snapshot.players.filter((player) => player.team === conceding);
    return { lastMan: mostBack(mates, conceding)?.name ?? null };
  });
}

interface Accumulator {
  present: number;
  distance: number;
  speedSum: number;
  supersonic: number;
  boostSpeed: number;
  slow: number;
  ground: number;
  lowAir: number;
  highAir: number;
  zero: number;
  full: number;
  lowBoost: number;
  collected: number;
  stolen: number;
  used: number;
  big: number;
  small: number;
  ballDistance: number;
  mateDistance: number;
  mateTime: number;
  defensive: number;
  neutral: number;
  offensive: number;
  behind: number;
  inFront: number;
  mostBack: number;
}

function emptyAccum(): Accumulator {
  return {
    present: 0,
    distance: 0,
    speedSum: 0,
    supersonic: 0,
    boostSpeed: 0,
    slow: 0,
    ground: 0,
    lowAir: 0,
    highAir: 0,
    zero: 0,
    full: 0,
    lowBoost: 0,
    collected: 0,
    stolen: 0,
    used: 0,
    big: 0,
    small: 0,
    ballDistance: 0,
    mateDistance: 0,
    mateTime: 0,
    defensive: 0,
    neutral: 0,
    offensive: 0,
    behind: 0,
    inFront: 0,
    mostBack: 0,
  };
}

function nearestAtOrBefore(samples: FrameSample[], time: number): FrameSample | null {
  let best: FrameSample | null = null;
  for (const sample of samples) {
    if (sample.time <= time + 0.02 && (!best || sample.time > best.time)) best = sample;
  }
  return best;
}

function mostBack(players: FramePlayer[], team: 0 | 1): FramePlayer | null {
  if (!players.length) return null;
  return [...players].sort((a, b) => (team === 0 ? a.y - b.y : b.y - a.y))[0];
}

function pastBall(player: { y: number }, ballY: number, team: 0 | 1): boolean {
  return team === 0 ? player.y > ballY + 200 : player.y < ballY - 200;
}

function betweenBallAndGoal(player: { y: number }, ballY: number, team: 0 | 1): boolean {
  return team === 0 ? player.y < ballY : player.y > ballY;
}

function inOpponentHalf(player: { y: number }, team: 0 | 1): boolean {
  return team === 0 ? player.y > 800 : player.y < -800;
}

function inOffensiveThird(player: { y: number }, team: 0 | 1): boolean {
  return team === 0 ? player.y > THIRD : player.y < -THIRD;
}

function inDefensiveThird(player: { y: number }, team: 0 | 1): boolean {
  return team === 0 ? player.y < -THIRD : player.y > THIRD;
}

function behindBall(player: { y: number; team: 0 | 1 }, ballY: number): boolean {
  return player.team === 0 ? player.y < ballY : player.y > ballY;
}

function towardOwnGoal(fromY: number, toY: number, team: 0 | 1): number {
  return team === 0 ? fromY - toY : toY - fromY;
}

function despawned(player: FramePlayer): boolean {
  return Math.hypot(player.x, player.y) < 40 && player.z < 20;
}

function speedBetween(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, dt: number): number {
  if (dt <= 0) return 0;
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / dt;
}

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function round(value: number): number {
  return Math.round(value);
}
