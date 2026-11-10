import "server-only";
import { mkdir } from "node:fs/promises";
import path from "node:path";

export interface Database {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

const SCHEMA = `
create table if not exists users (
  id text primary key,
  persona_name text not null,
  avatar_url text,
  profile_url text,
  rl_name text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

create table if not exists api_tokens (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  token_prefix text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists replays (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  sha256 text not null,
  played_at timestamptz,
  playlist text not null,
  map_label text not null,
  team0_score integer not null,
  team1_score integer not null,
  storage_key text,
  storage_status text not null,
  byte_length integer not null,
  analysis jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, sha256)
);

create index if not exists replays_user_played_idx on replays (user_id, played_at desc);

create table if not exists scenarios (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  name text not null,
  definition jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scenarios_user_idx on scenarios (user_id, updated_at desc);
`;

const globalForDb = globalThis as { replayLabDb?: Promise<Database> };

export function getDatabase(): Promise<Database> {
  if (!globalForDb.replayLabDb) globalForDb.replayLabDb = createDatabase();
  return globalForDb.replayLabDb;
}

export async function createDatabase(options?: { dataDir?: string; url?: string }): Promise<Database> {
  const url = options?.url ?? (options?.dataDir ? undefined : process.env.DATABASE_URL);
  const database = url
    ? await connectPostgres(url)
    : await connectPglite(options?.dataDir ?? path.join(process.cwd(), "data", "pglite"));
  for (const statement of SCHEMA.split(";").map((part) => part.trim()).filter(Boolean)) {
    await database.query(statement);
  }
  return database;
}

async function connectPostgres(url: string): Promise<Database> {
  const { Pool } = await import("@neondatabase/serverless");
  const pool = new Pool({ connectionString: url });
  return {
    async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const result = await pool.query(sql, params);
      return result.rows as T[];
    },
    async close() {
      await pool.end();
    },
  };
}

async function connectPglite(dataDir: string): Promise<Database> {
  await mkdir(dataDir, { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite(dataDir);
  return {
    async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const result = await client.query<T>(sql, params);
      return result.rows;
    },
    async close() {
      await client.close();
    },
  };
}
