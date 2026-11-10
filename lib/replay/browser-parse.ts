import { samplesFromActor, type FrameActor } from "./export-frames";
import { buildReplay } from "./frames";
import { parseReplayHeader } from "./header";
import type { StoredReplay } from "./types";

const WASM_URL = "/listener/rl_replay_subtr_actor_bg.wasm";

let loading: Promise<FrameActor> | null = null;

export async function parseReplayBytes(bytes: Uint8Array): Promise<StoredReplay> {
  const header = parseReplayHeader(bytes);
  const players = header.players.map((player) => ({ name: player.name, team: player.team }));
  try {
    const actor = await loadActor();
    return buildReplay(header, samplesFromActor(actor, bytes, players));
  } catch (error) {
    const replay = buildReplay(header, null);
    replay.warnings.push(error instanceof Error ? error.message : "Frame export failed");
    return replay;
  }
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function loadActor(): Promise<FrameActor> {
  if (!loading) {
    loading = (async () => {
      const actor = (await import("@rlrml/subtr-actor")) as FrameActor & {
        default(options: { module_or_path: string }): Promise<unknown>;
      };
      await actor.default({ module_or_path: WASM_URL });
      return actor;
    })().catch((error: unknown) => {
      loading = null;
      throw error;
    });
  }
  return loading;
}
