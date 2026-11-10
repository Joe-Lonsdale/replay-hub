import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { samplesFromActor, type FrameActor } from "../lib/replay/export-frames";
import type { NamedPlayer } from "../lib/replay/ndarray";
import type { FrameSample } from "../lib/replay/types";

type ActorModule = FrameActor & {
  default(options: { module_or_path: Uint8Array }): Promise<unknown>;
};

let loading: Promise<ActorModule> | null = null;

export async function samplesFromReplay(bytes: Uint8Array, players: NamedPlayer[]): Promise<FrameSample[]> {
  const actor = await loadActor();
  return samplesFromActor(actor, bytes, players);
}

export async function wasmByteLength(): Promise<number> {
  const bytes = await wasmBytes();
  await loadActor();
  return bytes.byteLength;
}

async function loadActor() {
  if (!loading) {
    loading = (async () => {
      const actor = await import("@rlrml/subtr-actor");
      const wasm = await wasmBytes();
      await actor.default({ module_or_path: wasm });
      return actor as ActorModule;
    })();
  }
  return loading;
}

async function wasmBytes(): Promise<Uint8Array> {
  const beside = path.join(path.dirname(fileURLToPath(import.meta.url)), "rl_replay_subtr_actor_bg.wasm");
  try {
    return await readFile(beside);
  } catch {
    // The repo helper reads the package copy. The downloaded listener keeps the wasm beside itself.
  }
  const require = createRequire(import.meta.url);
  return readFile(require.resolve("@rlrml/subtr-actor/rl_replay_subtr_actor_bg.wasm"));
}
