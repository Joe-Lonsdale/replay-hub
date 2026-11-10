import { ReplayReader } from "./binary";
import { mapLabel } from "./maps";
import type { HeaderGame, HeaderGoal, HeaderPlayer, Playlist } from "./types";

type Prop =
  | { t: "int"; v: number }
  | { t: "bool"; v: boolean }
  | { t: "float"; v: number }
  | { t: "str"; v: string }
  | { t: "qword"; v: string }
  | { t: "byte"; kind: string; value: string | null }
  | { t: "array"; v: Record<string, Prop>[] }
  | { t: "struct"; name: string; v: Record<string, Prop> };

const REGULATION_SECONDS = 300;

export function parseReplayHeader(buffer: Uint8Array): HeaderGame {
  const reader = new ReplayReader(buffer);
  const headerSize = reader.i32();
  if (headerSize < 16 || headerSize > buffer.length) {
    throw new Error("Replay header size is invalid");
  }
  reader.u32();
  const major = reader.i32();
  const minor = reader.i32();
  if (major > 865 && minor > 17) reader.i32();
  const gameType = reader.text();
  const warnings: string[] = [];
  const properties = parseDict(reader, warnings);
  return headerToGame(gameType, properties, warnings);
}

function parseDict(reader: ReplayReader, warnings: string[]): Record<string, Prop> {
  const out: Record<string, Prop> = {};
  for (let guard = 0; guard < 10_000; guard += 1) {
    const key = reader.text();
    if (key === "None") return out;
    const kind = reader.text();
    const size = reader.u32();
    reader.bytes(4);
    if (kind === "ByteProperty") {
      const byteKind = reader.text();
      if (byteKind === "None") {
        reader.bytes(1);
        continue;
      }
      out[key] = { t: "byte", kind: byteKind, value: reader.text() };
      continue;
    }
    const value = parseValue(reader, kind, size, warnings);
    if (value) out[key] = value;
    else warnings.push(`Skipped ${key} (${kind})`);
  }
  throw new Error("Header property list did not end");
}

function parseValue(
  reader: ReplayReader,
  kind: string,
  size: number,
  warnings: string[],
): Prop | null {
  switch (kind) {
    case "IntProperty":
      return { t: "int", v: reader.i32() };
    case "FloatProperty":
      return { t: "float", v: reader.f32() };
    case "BoolProperty":
      return { t: "bool", v: reader.bytes(1)[0] === 1 };
    case "StrProperty":
    case "NameProperty":
      return { t: "str", v: reader.text() };
    case "QWordProperty":
      return { t: "qword", v: reader.u64().toString() };
    case "ArrayProperty": {
      const count = reader.i32();
      if (count < 0 || count > 10_000) throw new Error(`Array length ${count} is implausible`);
      const items: Record<string, Prop>[] = [];
      for (let i = 0; i < count; i += 1) items.push(parseDict(reader, warnings));
      return { t: "array", v: items };
    }
    case "StructProperty":
      return { t: "struct", name: reader.text(), v: parseDict(reader, warnings) };
    default:
      if (size > 5_000_000) throw new Error(`Unknown property ${kind} is too large to skip`);
      reader.bytes(size);
      return null;
  }
}

function headerToGame(
  gameType: string,
  props: Record<string, Prop>,
  warnings: string[],
): HeaderGame {
  const teamSize = intProp(props, "TeamSize") ?? 0;
  const recordFps = floatProp(props, "RecordFPS") || 30;
  const numFrames = intProp(props, "NumFrames") ?? 0;
  const durationSeconds = numFrames > 0 ? numFrames / recordFps : REGULATION_SECONDS;
  const matchType = strProp(props, "MatchType");
  const mapName = strProp(props, "MapName") ?? "";
  const overtime = boolProp(props, "bOverTime") || durationSeconds > REGULATION_SECONDS + 20;
  const noContest = boolProp(props, "bNoContest");
  const forfeit = boolProp(props, "bForfeit");
  const players = playerStats(props);
  const goals = goalList(props);

  return {
    matchGuid: strProp(props, "MatchGUID"),
    name: strProp(props, "ReplayName") ?? strProp(props, "Id") ?? "Replay",
    mapName,
    mapLabel: mapLabel(mapName),
    playedAt: parseReplayDate(strProp(props, "Date")),
    playlist: playlistOf(gameType, teamSize),
    matchType,
    gameType,
    buildVersion: strProp(props, "BuildVersion"),
    teamSize: teamSize || inferTeamSize(players),
    durationSeconds,
    recordFps,
    overtime,
    forfeit,
    noContest,
    team0Score: intProp(props, "Team0Score") ?? 0,
    team1Score: intProp(props, "Team1Score") ?? 0,
    players,
    goals,
    warnings,
  };
}

function playerStats(props: Record<string, Prop>): HeaderPlayer[] {
  const rows = arrayProp(props, "PlayerStats");
  return rows.map((row) => {
    const shots = intOf(row, "Shots") ?? 0;
    const goals = intOf(row, "Goals") ?? 0;
    return {
      name: strOf(row, "Name") ?? strOf(row, "PlayerName") ?? "Player",
      platform: platformOf(row.Platform),
      onlineId: idOf(row.OnlineID),
      team: (intOf(row, "Team") ?? 0) === 1 ? 1 : 0,
      bot: boolOf(row, "bBot"),
      score: intOf(row, "Score") ?? 0,
      goals,
      assists: intOf(row, "Assists") ?? 0,
      saves: intOf(row, "Saves") ?? 0,
      shots,
    };
  });
}

function goalList(props: Record<string, Prop>): HeaderGoal[] {
  return arrayProp(props, "Goals").map((row) => ({
    frame: intOf(row, "frame") ?? intOf(row, "Frame") ?? 0,
    scorer: strOf(row, "PlayerName") ?? strOf(row, "Name") ?? "Player",
    team: (intOf(row, "PlayerTeam") ?? intOf(row, "Team") ?? 0) === 1 ? 1 : 0,
  }));
}

function playlistOf(gameType: string, teamSize: number): Playlist {
  const kind = gameType.toLowerCase();
  if (
    kind.includes("basketball") ||
    kind.includes("hockey") ||
    kind.includes("breakout") ||
    kind.includes("heatseeker")
  ) {
    return "extra";
  }
  if (teamSize <= 1) return "duel";
  if (teamSize === 2) return "doubles";
  if (teamSize >= 3) return "standard";
  return "unknown";
}

function inferTeamSize(players: HeaderPlayer[]): number {
  const counts = [0, 0];
  for (const player of players) {
    if (!player.bot) counts[player.team] += 1;
  }
  return Math.max(counts[0], counts[1], 1);
}

export function parseReplayDate(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/(\d{4})-(\d{2})-(\d{2})[: T](\d{2})-(\d{2})-(\d{2})/);
  if (!match) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function arrayProp(props: Record<string, Prop>, key: string): Record<string, Prop>[] {
  const value = props[key];
  return value?.t === "array" ? value.v : [];
}

function intProp(props: Record<string, Prop>, key: string): number | null {
  const value = props[key];
  return value?.t === "int" ? value.v : null;
}

function floatProp(props: Record<string, Prop>, key: string): number | null {
  const value = props[key];
  if (value?.t === "float") return value.v;
  if (value?.t === "int") return value.v;
  return null;
}

function strProp(props: Record<string, Prop>, key: string): string | null {
  const value = props[key];
  return value?.t === "str" && value.v ? value.v : null;
}

function boolProp(props: Record<string, Prop>, key: string): boolean {
  const value = props[key];
  return value?.t === "bool" ? value.v : false;
}

function intOf(row: Record<string, Prop>, key: string): number | null {
  const value = row[key];
  return value?.t === "int" ? value.v : null;
}

function strOf(row: Record<string, Prop>, key: string): string | null {
  const value = row[key];
  return value?.t === "str" && value.v ? value.v : null;
}

function boolOf(row: Record<string, Prop>, key: string): boolean {
  const value = row[key];
  return value?.t === "bool" ? value.v : false;
}

function idOf(value: Prop | undefined): string | null {
  if (!value) return null;
  if (value.t === "qword") return value.v;
  if (value.t === "str") return value.v;
  if (value.t === "int") return String(value.v);
  return null;
}

function platformOf(value: Prop | undefined): string | null {
  if (!value) return null;
  if (value.t === "byte") {
    const raw = value.value ?? value.kind;
    return raw.replace(/^OnlinePlatform_/, "") || raw;
  }
  if (value.t === "str") return value.v.replace(/^OnlinePlatform_/, "");
  return null;
}
