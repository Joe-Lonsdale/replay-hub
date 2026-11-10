import { buildReplay } from "../replay/frames";
import type { FrameSample, HeaderGame, HeaderPlayer } from "../replay/types";
import type { ScenarioGame } from "./types";

interface Car {
  x: number;
  y: number;
  z: number;
  boost: number;
}

interface Beat {
  t: number;
  ball?: [number, number, number];
  cars?: Record<string, Partial<Car>>;
}

const ROSTER: [string, 0 | 1][] = [
  ["Alpha", 0],
  ["Bravo", 0],
  ["Charlie", 1],
  ["Delta", 1],
];

/** A short doubles game that contains the three starter scenarios once each. */
export function demoGames(): ScenarioGame[] {
  const replay = buildReplay(demoHeader(), demoSamples());
  return [
    {
      id: "demo",
      playedAt: replay.playedAt,
      map: replay.mapLabel,
      team0Score: replay.team0Score,
      team1Score: replay.team1Score,
      userTeam: 0,
      userName: "Alpha",
      userWon: false,
      tracked: replay.parserVersion >= 2,
      events: replay.events ?? [],
    },
  ];
}

export function demoSamples(): FrameSample[] {
  const beats: Beat[] = [
    { t: 9.6, ball: [0, -900, 93], cars: { Alpha: { x: 0, y: -900, boost: 40 } } },
    { t: 10.2, ball: [0, -300, 93], cars: { Alpha: { x: 0, y: -300, boost: 40 } } },
    { t: 10.6, ball: [0, -700, 93], cars: { Alpha: { x: 0, y: -280, boost: 38 } } },
    {
      t: 11.0,
      ball: [0, -200, 93],
      cars: { Alpha: { x: 0, y: -900, boost: 36 }, Charlie: { x: 0, y: -200, boost: 50 } },
    },
    {
      t: 11.4,
      ball: [0, 200, 93],
      cars: { Alpha: { x: 200, y: -1200, boost: 36 }, Charlie: { x: 0, y: 200, boost: 50 } },
    },
    { t: 11.8, ball: [0, -100, 93], cars: { Charlie: { x: 0, y: 180, boost: 48 } } },
    { t: 13.6, ball: [0, -1800, 93], cars: { Alpha: { y: -1400 }, Charlie: { y: 1600 } } },
    { t: 19.6, ball: [0, 100, 93], cars: { Alpha: { x: 0, y: 100, boost: 33 }, Charlie: { x: 40, y: 140, boost: 40 } } },
    { t: 20.2, ball: [0, 500, 93], cars: { Alpha: { x: 0, y: 500, boost: 33 }, Charlie: { x: 30, y: 530, boost: 40 } } },
    { t: 20.6, ball: [0, 150, 93], cars: { Alpha: { x: 0, y: 470, boost: 30 }, Charlie: { x: 40, y: 490, boost: 38 } } },
    {
      t: 22.2,
      ball: [0, 800, 93],
      cars: { Alpha: { y: -1500 }, Charlie: { y: 2200 }, Delta: { x: 0, y: 800, boost: 60 } },
    },
    { t: 22.6, ball: [0, 1100, 93], cars: { Delta: { x: 0, y: 1100, boost: 60 } } },
    { t: 23.0, ball: [0, 700, 93], cars: { Delta: { x: 0, y: 1060, boost: 55 } } },
    { t: 24.0, ball: [0, 900, 93], cars: { Delta: { y: 1800 } } },
    { t: 30.0, ball: [0, 4200, 93], cars: { Alpha: { x: 0, y: 2200, boost: 12 } } },
    { t: 30.4, ball: [0, 4200, 93], cars: { Alpha: { x: 0, y: 3850, boost: 12 } } },
    { t: 31.2, ball: [0, 4200, 93], cars: { Alpha: { x: 0, y: 3850, boost: 12 } } },
    { t: 34.0, ball: [0, -3000, 120], cars: { Alpha: { y: 3000 }, Charlie: { x: 0, y: -2400, boost: 40 } } },
  ];
  return sampleBeats(beats);
}

function sampleBeats(beats: Beat[]): FrameSample[] {
  const cars = new Map<string, Car>(
    ROSTER.map(([name]) => [name, { x: name === "Alpha" || name === "Charlie" ? -400 : 400, y: name === "Alpha" || name === "Bravo" ? -2500 : 2500, z: 40, boost: 45 }]),
  );
  let ball: [number, number, number] = [0, 0, 93];
  const keys = beats.map((beat) => {
    if (beat.ball) ball = beat.ball;
    for (const [name, patch] of Object.entries(beat.cars ?? {})) {
      const current = cars.get(name);
      if (!current) continue;
      cars.set(name, { ...current, ...patch });
    }
    return {
      t: beat.t,
      ball: [...ball] as [number, number, number],
      cars: new Map(Array.from(cars, ([name, car]) => [name, { ...car }])),
    };
  });

  const frames: FrameSample[] = [];
  const start = Math.round(keys[0].t * 10);
  const end = Math.round(keys[keys.length - 1].t * 10);
  for (let step = start; step <= end; step += 1) {
    const time = step / 10;
    let right = keys.findIndex((key) => key.t >= time);
    if (right < 0) right = keys.length - 1;
    const next = keys[right];
    const prev = keys[Math.max(0, right - 1)];
    const span = next.t - prev.t || 1;
    const blend = prev === next ? 0 : (time - prev.t) / span;
    const point = mix3(prev.ball, next.ball, blend);
    frames.push({
      time,
      secondsRemaining: 300 - time,
      kickoffCountdown: 0,
      ball: { x: point[0], y: point[1], z: point[2] },
      players: ROSTER.map(([name, team]) => {
        const from = prev.cars.get(name) ?? { x: 0, y: 0, z: 40, boost: 40 };
        const to = next.cars.get(name) ?? from;
        return {
          name,
          team,
          x: mix(from.x, to.x, blend),
          y: mix(from.y, to.y, blend),
          z: mix(from.z, to.z, blend),
          boost: mix(from.boost, to.boost, blend),
        };
      }),
    });
  }
  return frames;
}

function demoHeader(): HeaderGame {
  const players: HeaderPlayer[] = ROSTER.map(([name, team]) => ({
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
  }));
  return {
    matchGuid: "demo",
    name: "Doubles",
    mapName: "Stadium_P",
    mapLabel: "DFH Stadium",
    playedAt: "2026-11-10T12:00:00.000Z",
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
    team0Score: 0,
    team1Score: 2,
    players,
    goals: [
      { frame: 14 * 30, scorer: "Charlie", team: 1 },
      { frame: Math.round(33.5 * 30), scorer: "Charlie", team: 1 },
    ],
    warnings: [],
  };
}

function mix(from: number, to: number, blend: number): number {
  return from + (to - from) * blend;
}

function mix3(from: [number, number, number], to: [number, number, number], blend: number): [number, number, number] {
  return [mix(from[0], to[0], blend), mix(from[1], to[1], blend), mix(from[2], to[2], blend)];
}
