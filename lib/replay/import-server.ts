import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { samplesFromActor, type FrameActor } from "@/lib/replay/export-frames";
import { r2Configured } from "@/lib/env";
import { findReplayByHash, insertReplay, replaceReplayAnalysis, setReplayStorage } from "@/lib/repo";
import { buildReplay } from "@/lib/replay/frames";
import { parseReplayHeader } from "@/lib/replay/header";
import type { StoredReplay } from "@/lib/replay/types";
import { replayObjectKey, writeLocalReplay, writeReplayObject } from "@/lib/storage";

type ActorModule = FrameActor & {
  default(options: { module_or_path: Uint8Array }): Promise<unknown>;
};

let actorLoading: Promise<ActorModule> | null = null;
const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;

export interface ReplayImportResult {
  id: string;
  duplicate: boolean;
  stored: boolean;
  depth: StoredReplay["depth"];
}

export async function importReplayBytes(userId: string, bytes: Buffer): Promise<ReplayImportResult> {
  if (bytes.length < 1000 || bytes.length > 20_000_000) {
    throw new Error(`Replay file size looked wrong (${bytes.length} bytes).`);
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const replay = await parseReplay(bytes);
  const existing = await findReplayByHash(userId, sha256);

  const row =
    existing ??
    (await insertReplay({
      userId,
      sha256,
      replay,
      byteLength: bytes.length,
      storageKey: null,
      storageStatus: "stats-only",
    }));

  if (existing) await replaceReplayAnalysis(userId, existing.id, replay, bytes.length);

  if (row.storageStatus === "stored") {
    return { id: row.id, duplicate: Boolean(existing), stored: true, depth: replay.depth };
  }

  const storageKey = row.storageKey ?? replayObjectKey(userId, row.id);
  if (r2Configured()) {
    await writeReplayObject(storageKey, bytes);
    await setReplayStorage(userId, row.id, storageKey, "stored");
    return { id: row.id, duplicate: Boolean(existing), stored: true, depth: replay.depth };
  }

  if (!process.env.VERCEL) {
    await writeLocalReplay(userId, row.id, bytes);
    await setReplayStorage(userId, row.id, storageKey, "stored");
    return { id: row.id, duplicate: Boolean(existing), stored: true, depth: replay.depth };
  }

  return { id: row.id, duplicate: Boolean(existing), stored: false, depth: replay.depth };
}

async function parseReplay(bytes: Uint8Array): Promise<StoredReplay> {
  const header = parseReplayHeader(bytes);
  try {
    const actor = await loadActor();
    const samples = samplesFromActor(
      actor,
      bytes,
      header.players.map((player) => ({ name: player.name, team: player.team })),
    );
    return buildReplay(header, samples);
  } catch (error) {
    const replay = buildReplay(header, null);
    replay.warnings.push(error instanceof Error ? error.message : String(error));
    return replay;
  }
}

async function loadActor(): Promise<ActorModule> {
  if (!actorLoading) {
    actorLoading = (async () => {
      const actor = (await dynamicImport("@rlrml/subtr-actor")) as ActorModule;
      await actor.default({ module_or_path: await wasmBytes() });
      return actor;
    })();
  }
  return actorLoading;
}

async function wasmBytes(): Promise<Uint8Array> {
  const require = createRequire(import.meta.url);
  const packageName = "@rlrml/subtr-actor";
  const wasmName = "rl_replay_subtr_actor_bg.wasm";
  return readFile(require.resolve(`${packageName}/${wasmName}`));
}
