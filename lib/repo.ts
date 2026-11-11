import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getDatabase, type Database } from "./db";
import { blankScenario, parseDefinition } from "./scenarios/catalog";
import type { ScenarioDefinition } from "./scenarios/types";
import { packReplay, unpackReplay } from "./replay/pack";
import type { StoredReplay } from "./replay/types";
import type { ApiToken, ReplayRow, RlApiConnection, RlApiDeviceAuth, User } from "./types";

async function db(): Promise<Database> {
  return getDatabase();
}

export async function upsertUser(input: {
  id: string;
  personaName: string;
  avatarUrl: string | null;
  profileUrl: string | null;
}): Promise<User> {
  const database = await db();
  await database.query(
    `insert into users (id, persona_name, avatar_url, profile_url)
     values ($1, $2, $3, $4)
     on conflict (id) do update set
       persona_name = excluded.persona_name,
       avatar_url = excluded.avatar_url,
       profile_url = excluded.profile_url,
       last_login_at = now()`,
    [input.id, input.personaName, input.avatarUrl, input.profileUrl],
  );
  const user = await findUser(input.id);
  if (!user) throw new Error("User was not saved");
  return user;
}

export async function findUser(id: string): Promise<User | null> {
  const database = await db();
  const rows = await database.query<UserRow>(`select * from users where id = $1`, [id]);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function setRlName(userId: string, rlName: string | null): Promise<void> {
  const database = await db();
  await database.query(`update users set rl_name = $2 where id = $1`, [userId, rlName]);
}

export async function createToken(userId: string, name: string): Promise<{ token: ApiToken; secret: string }> {
  const database = await db();
  const secret = `rpl_${randomBytes(24).toString("base64url")}`;
  const id = randomUUID();
  const prefix = secret.slice(0, 12);
  await database.query(
    `insert into api_tokens (id, user_id, name, token_hash, token_prefix) values ($1, $2, $3, $4, $5)`,
    [id, userId, name, hashToken(secret), prefix],
  );
  return {
    secret,
    token: { id, name, prefix, createdAt: new Date().toISOString(), lastUsedAt: null },
  };
}

export async function listTokens(userId: string): Promise<ApiToken[]> {
  const database = await db();
  const rows = await database.query<TokenRow>(
    `select id, name, token_prefix, created_at, last_used_at from api_tokens where user_id = $1 order by created_at desc`,
    [userId],
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    prefix: row.token_prefix,
    createdAt: asIso(row.created_at) ?? "",
    lastUsedAt: asIso(row.last_used_at),
  }));
}

export async function deleteToken(userId: string, id: string): Promise<void> {
  const database = await db();
  await database.query(`delete from api_tokens where user_id = $1 and id = $2`, [userId, id]);
}

export async function findUserByToken(secret: string): Promise<User | null> {
  const database = await db();
  const rows = await database.query<UserRow & { token_id: string }>(
    `select users.*, api_tokens.id as token_id
     from api_tokens join users on users.id = api_tokens.user_id
     where api_tokens.token_hash = $1`,
    [hashToken(secret)],
  );
  const row = rows[0];
  if (!row) return null;
  await database.query(`update api_tokens set last_used_at = now() where id = $1`, [row.token_id]);
  return mapUser(row);
}

export async function saveRlApiDeviceAuth(input: RlApiDeviceAuth): Promise<void> {
  const database = await db();
  await database.query(
    `insert into rlapi_device_auth (
      user_id, device_code, user_code, verification_uri, interval_seconds, expires_at
    ) values ($1, $2, $3, $4, $5, $6)
    on conflict (user_id) do update set
      device_code = excluded.device_code,
      user_code = excluded.user_code,
      verification_uri = excluded.verification_uri,
      interval_seconds = excluded.interval_seconds,
      expires_at = excluded.expires_at,
      created_at = now()`,
    [input.userId, input.deviceCode, input.userCode, input.verificationUri, input.intervalSeconds, input.expiresAt],
  );
}

export async function getRlApiDeviceAuth(userId: string): Promise<RlApiDeviceAuth | null> {
  const database = await db();
  const rows = await database.query<RlApiDeviceAuthSql>(`select * from rlapi_device_auth where user_id = $1`, [userId]);
  return rows[0] ? mapRlApiDeviceAuth(rows[0]) : null;
}

export async function deleteRlApiDeviceAuth(userId: string): Promise<void> {
  const database = await db();
  await database.query(`delete from rlapi_device_auth where user_id = $1`, [userId]);
}

export async function saveRlApiConnection(input: {
  userId: string;
  epicAccountId: string;
  displayName: string;
  refreshTokenCiphertext: string;
  refreshExpiresAt: string | null;
}): Promise<void> {
  const database = await db();
  await database.query(
    `insert into rlapi_connections (
      user_id, epic_account_id, display_name, refresh_token_ciphertext, refresh_expires_at
    ) values ($1, $2, $3, $4, $5)
    on conflict (user_id) do update set
      epic_account_id = excluded.epic_account_id,
      display_name = excluded.display_name,
      refresh_token_ciphertext = excluded.refresh_token_ciphertext,
      refresh_expires_at = excluded.refresh_expires_at,
      updated_at = now()`,
    [
      input.userId,
      input.epicAccountId,
      input.displayName,
      input.refreshTokenCiphertext,
      input.refreshExpiresAt,
    ],
  );
}

export async function getRlApiConnection(userId: string): Promise<RlApiConnection | null> {
  const database = await db();
  const rows = await database.query<RlApiConnectionSql>(`select * from rlapi_connections where user_id = $1`, [userId]);
  return rows[0] ? mapRlApiConnection(rows[0]) : null;
}

export async function deleteRlApiConnection(userId: string): Promise<void> {
  const database = await db();
  await database.query(`delete from rlapi_connections where user_id = $1`, [userId]);
}

export async function findReplayByHash(userId: string, sha256: string): Promise<ReplayRow | null> {
  const database = await db();
  const rows = await database.query<ReplaySql>(
    `select * from replays where user_id = $1 and sha256 = $2`,
    [userId, sha256],
  );
  return rows[0] ? mapReplay(rows[0]) : null;
}

export async function insertReplay(input: {
  userId: string;
  sha256: string;
  replay: StoredReplay;
  byteLength: number;
  storageKey: string | null;
  storageStatus: string;
}): Promise<ReplayRow> {
  const database = await db();
  const id = randomUUID();
  await database.query(
    `insert into replays (
      id, user_id, sha256, played_at, playlist, map_label, team0_score, team1_score,
      storage_key, storage_status, byte_length, analysis
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)`,
    [
      id,
      input.userId,
      input.sha256,
      input.replay.playedAt,
      input.replay.playlist,
      input.replay.mapLabel,
      input.replay.team0Score,
      input.replay.team1Score,
      input.storageKey,
      input.storageStatus,
      input.byteLength,
      JSON.stringify(packReplay(input.replay)),
    ],
  );
  const saved = await getReplay(input.userId, id);
  if (!saved) throw new Error("Replay was not saved");
  return saved;
}

export async function getReplay(userId: string, id: string): Promise<ReplayRow | null> {
  const database = await db();
  const rows = await database.query<ReplaySql>(`select * from replays where user_id = $1 and id = $2`, [
    userId,
    id,
  ]);
  return rows[0] ? mapReplay(rows[0]) : null;
}

export async function listReplays(userId: string, playlist: string | null, limit: number): Promise<ReplayRow[]> {
  const database = await db();
  const rows = await database.query<ReplaySql>(
    `select * from replays
     where user_id = $1 and ($2::text is null or playlist = $2)
     order by played_at desc nulls last, created_at desc
     limit $3`,
    [userId, playlist, limit],
  );
  return rows.map(mapReplay);
}

export async function setReplayStorage(
  userId: string,
  id: string,
  storageKey: string | null,
  storageStatus: string,
): Promise<void> {
  const database = await db();
  await database.query(
    `update replays set storage_status = $4, storage_key = $3 where user_id = $1 and id = $2`,
    [userId, id, storageKey, storageStatus],
  );
}

export async function replaceReplayAnalysis(
  userId: string,
  id: string,
  replay: StoredReplay,
  byteLength: number,
): Promise<void> {
  const database = await db();
  await database.query(
    `update replays set analysis = $3::jsonb, byte_length = $4, played_at = $5, playlist = $6,
      map_label = $7, team0_score = $8, team1_score = $9
     where user_id = $1 and id = $2`,
    [
      userId,
      id,
      JSON.stringify(packReplay(replay)),
      byteLength,
      replay.playedAt,
      replay.playlist,
      replay.mapLabel,
      replay.team0Score,
      replay.team1Score,
    ],
  );
}

export async function deleteReplay(userId: string, id: string): Promise<ReplayRow | null> {
  const existing = await getReplay(userId, id);
  if (!existing) return null;
  const database = await db();
  await database.query(`delete from replays where user_id = $1 and id = $2`, [userId, id]);
  return existing;
}

export interface SavedScenario {
  id: string;
  name: string;
  definition: ScenarioDefinition;
  updatedAt: string;
}

export async function listScenarios(userId: string): Promise<SavedScenario[]> {
  const database = await db();
  const rows = await database.query<ScenarioSql>(
    `select id, name, definition, updated_at from scenarios where user_id = $1 order by updated_at desc`,
    [userId],
  );
  return rows.map(mapScenario);
}

export async function getScenario(userId: string, id: string): Promise<SavedScenario | null> {
  const database = await db();
  const rows = await database.query<ScenarioSql>(
    `select id, name, definition, updated_at from scenarios where user_id = $1 and id = $2`,
    [userId, id],
  );
  return rows[0] ? mapScenario(rows[0]) : null;
}

export async function insertScenario(userId: string, name: string, definition: ScenarioDefinition): Promise<string> {
  const database = await db();
  const id = randomUUID();
  await database.query(
    `insert into scenarios (id, user_id, name, definition) values ($1, $2, $3, $4::jsonb)`,
    [id, userId, name, JSON.stringify(definition)],
  );
  return id;
}

export async function updateScenario(
  userId: string,
  id: string,
  name: string,
  definition: ScenarioDefinition,
): Promise<void> {
  const database = await db();
  await database.query(
    `update scenarios set name = $3, definition = $4::jsonb, updated_at = now() where user_id = $1 and id = $2`,
    [userId, id, name, JSON.stringify(definition)],
  );
}

export async function deleteScenario(userId: string, id: string): Promise<void> {
  const database = await db();
  await database.query(`delete from scenarios where user_id = $1 and id = $2`, [userId, id]);
}

function mapScenario(row: ScenarioSql): SavedScenario {
  const raw = typeof row.definition === "string" ? JSON.parse(row.definition) : row.definition;
  return {
    id: row.id,
    name: row.name,
    definition: parseDefinition(raw) ?? blankScenario(),
    updatedAt: asIso(row.updated_at) ?? "",
  };
}

interface ScenarioSql {
  id: string;
  name: string;
  definition: unknown;
  updated_at: unknown;
}

function hashToken(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

interface UserRow {
  id: string;
  persona_name: string;
  avatar_url: string | null;
  profile_url: string | null;
  rl_name: string | null;
}

interface TokenRow {
  id: string;
  name: string;
  token_prefix: string;
  created_at: unknown;
  last_used_at: unknown;
}

interface RlApiDeviceAuthSql {
  user_id: string;
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval_seconds: number;
  expires_at: unknown;
}

interface RlApiConnectionSql {
  user_id: string;
  epic_account_id: string;
  display_name: string;
  refresh_token_ciphertext: string;
  refresh_expires_at: unknown;
  connected_at: unknown;
  updated_at: unknown;
}

interface ReplaySql {
  id: string;
  user_id: string;
  sha256: string;
  played_at: unknown;
  playlist: string;
  map_label: string;
  team0_score: number;
  team1_score: number;
  storage_key: string | null;
  storage_status: string;
  byte_length: number;
  analysis: unknown;
  created_at: unknown;
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    personaName: row.persona_name,
    avatarUrl: row.avatar_url,
    profileUrl: row.profile_url,
    rlName: row.rl_name,
  };
}

function mapRlApiDeviceAuth(row: RlApiDeviceAuthSql): RlApiDeviceAuth {
  return {
    userId: row.user_id,
    deviceCode: row.device_code,
    userCode: row.user_code,
    verificationUri: row.verification_uri,
    intervalSeconds: row.interval_seconds,
    expiresAt: asIso(row.expires_at) ?? "",
  };
}

function mapRlApiConnection(row: RlApiConnectionSql): RlApiConnection {
  return {
    userId: row.user_id,
    epicAccountId: row.epic_account_id,
    displayName: row.display_name,
    refreshTokenCiphertext: row.refresh_token_ciphertext,
    refreshExpiresAt: asIso(row.refresh_expires_at),
    connectedAt: asIso(row.connected_at) ?? "",
    updatedAt: asIso(row.updated_at) ?? "",
  };
}

function mapReplay(row: ReplaySql): ReplayRow {
  return {
    id: row.id,
    userId: row.user_id,
    sha256: row.sha256,
    playedAt: asIso(row.played_at),
    playlist: row.playlist,
    mapLabel: row.map_label,
    team0Score: row.team0_score,
    team1Score: row.team1_score,
    storageKey: row.storage_key,
    storageStatus: row.storage_status,
    byteLength: row.byte_length,
    analysis: unpackReplay(typeof row.analysis === "string" ? JSON.parse(row.analysis) : row.analysis) ?? emptyAnalysis(),
    createdAt: asIso(row.created_at) ?? "",
  };
}

function emptyAnalysis(): StoredReplay {
  return {
    parserVersion: 1,
    depth: "header",
    matchGuid: null,
    name: "Replay",
    mapName: "",
    mapLabel: "Unknown",
    playedAt: null,
    playlist: "unknown",
    matchType: null,
    gameType: "",
    buildVersion: null,
    teamSize: 0,
    durationSeconds: 0,
    overtime: false,
    forfeit: false,
    noContest: false,
    countable: false,
    team0Score: 0,
    team1Score: 0,
    players: [],
    goals: [],
    warnings: ["Stored stats could not be read."],
  };
}

function asIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}
