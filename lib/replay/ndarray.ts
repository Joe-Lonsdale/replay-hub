import type { FrameSample } from "./types";

export interface NamedPlayer {
  name: string;
  team: 0 | 1;
}

export interface NdResult {
  metadata?: {
    replay_meta?: unknown;
    column_headers?: {
      global_headers?: string[];
      player_headers?: string[];
    };
  };
  array_data?: number[][] | number[];
  shape?: number[];
}

const FIELD_SCALE = 5120;

export function ndarrayToSamples(result: NdResult, fallback: NamedPlayer[]): FrameSample[] {
  const headers = fullHeaders(result);
  const rows = rowsOf(result);
  if (!headers.length || !rows.length) {
    throw new Error("Frame export did not include a matrix");
  }
  const ballX = column(headers, 0, headers.length, /ball/, /position x/);
  const ballY = column(headers, 0, headers.length, /ball/, /position y/);
  const ballZ = column(headers, 0, headers.length, /ball/, /position z/);
  const timeCol = column(headers, 0, headers.length, /current time/);
  const remainingCol = column(headers, 0, headers.length, /seconds remaining/);
  const countdownCol = column(headers, 0, headers.length, /kickoff countdown/);
  const starts = playerStarts(headers);
  if (!starts.length) throw new Error(`No player columns in: ${headers.join(" | ")}`);

  const names = namesFromMeta(result.metadata?.replay_meta) ?? fallback;
  if (names.length !== starts.length) {
    throw new Error(`Frame export has ${starts.length} players and the header has ${names.length}`);
  }

  const chunks = starts.map((start, index) => ({
    start,
    end: starts[index + 1] ?? headers.length,
    player: names[index],
  }));
  const boostCols = chunks.map((chunk) => column(headers, chunk.start, chunk.end, /boost/));
  const px = chunks.map((chunk) => column(headers, chunk.start, chunk.end, /position x/, /^(?!.*ball)(?!.*relative)/));
  const py = chunks.map((chunk) => column(headers, chunk.start, chunk.end, /position y/, /^(?!.*ball)(?!.*relative)/));
  const pz = chunks.map((chunk) => column(headers, chunk.start, chunk.end, /position z/, /^(?!.*ball)(?!.*relative)/));

  const scale = fieldScale(rows, [ballY, ...py]);
  const boostScale = boostUnit(rows, boostCols);

  return rows.map((row, index) => {
    const time = timeCol >= 0 && Number.isFinite(row[timeCol]) ? row[timeCol] : index / 10;
    return {
      time,
      secondsRemaining: remainingCol >= 0 ? row[remainingCol] : null,
      kickoffCountdown: countdownCol >= 0 ? row[countdownCol] : null,
      ball: {
        x: row[ballX] * scale,
        y: row[ballY] * scale,
        z: row[ballZ] * scale,
      },
      players: chunks.map((chunk, playerIndex) => ({
        name: chunk.player.name,
        team: chunk.player.team,
        x: row[px[playerIndex]] * scale,
        y: row[py[playerIndex]] * scale,
        z: row[pz[playerIndex]] * scale,
        boost: clampBoost(row[boostCols[playerIndex]] * boostScale),
      })),
    };
  });
}

function fullHeaders(result: NdResult): string[] {
  const global = result.metadata?.column_headers?.global_headers ?? [];
  const player = result.metadata?.column_headers?.player_headers ?? [];
  const width = matrixWidth(result);
  if (!width) return [];
  if (global.length + player.length === width) return [...global, ...player];
  if (player.length > 0 && (width - global.length) % player.length === 0) {
    const count = (width - global.length) / player.length;
    return [...global, ...Array.from({ length: count }, () => player).flat()];
  }
  throw new Error(
    `Could not line up ${width} columns with ${global.length} global and ${player.length} player headers`,
  );
}

function matrixWidth(result: NdResult): number {
  const rows = rowsOf(result);
  if (rows[0]?.length) return rows[0].length;
  return result.shape?.[1] ?? 0;
}

function rowsOf(result: NdResult): number[][] {
  const data = result.array_data;
  if (!data) return [];
  if (Array.isArray(data[0])) return data as number[][];
  const [frames, cols] = result.shape ?? [];
  if (!frames || !cols) return [];
  const flat = data as number[];
  const rows: number[][] = [];
  for (let index = 0; index < frames; index += 1) {
    rows.push(flat.slice(index * cols, (index + 1) * cols));
  }
  return rows;
}

function playerStarts(headers: string[]): number[] {
  const starts: number[] = [];
  headers.forEach((header, index) => {
    const name = header.toLowerCase();
    if (name.includes("position x") && !name.includes("ball") && !name.includes("relative")) {
      starts.push(index);
    }
  });
  return starts;
}

function column(headers: string[], start: number, end: number, ...patterns: RegExp[]): number {
  for (let index = start; index < end; index += 1) {
    const name = headers[index].toLowerCase();
    if (patterns.every((pattern) => pattern.test(name))) return index;
  }
  throw new Error(`Missing ${patterns.map(String).join(" ")} in ${headers.slice(start, end).join(", ")}`);
}

function namesFromMeta(meta: unknown): NamedPlayer[] | null {
  const root = asRecord(meta);
  if (!root) return null;
  const replay = asRecord(root.replay_meta) ?? root;
  const blue = asList(replay.team_zero ?? replay.teamZero);
  const orange = asList(replay.team_one ?? replay.teamOne);
  if (!blue || !orange) return null;
  const players = [
    ...blue.map((item) => ({ name: playerName(item), team: 0 as const })),
    ...orange.map((item) => ({ name: playerName(item), team: 1 as const })),
  ];
  if (players.some((player) => !player.name)) return null;
  return players as NamedPlayer[];
}

function playerName(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  const record = asRecord(value);
  if (!record) return null;
  const name = record.name ?? record.player_name ?? record.PlayerName;
  return typeof name === "string" && name.trim() ? name : null;
}

function fieldScale(rows: number[][], columns: number[]): number {
  let max = 0;
  for (const row of rows) {
    for (const columnIndex of columns) max = Math.max(max, Math.abs(row[columnIndex] ?? 0));
  }
  return max > 0 && max < 8 ? FIELD_SCALE : 1;
}

function boostUnit(rows: number[][], columns: number[]): number {
  let max = 0;
  for (const row of rows) {
    for (const columnIndex of columns) max = Math.max(max, row[columnIndex] ?? 0);
  }
  if (max > 100) return 100 / 255;
  if (max <= 1.5) return 100;
  return 1;
}

function clampBoost(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asList(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}
