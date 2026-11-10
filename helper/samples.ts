import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { ndarrayToSamples, type NamedPlayer } from "../lib/replay/ndarray";
import type { FrameSample } from "../lib/replay/types";

const require = createRequire(import.meta.url);
let loading: Promise<typeof import("@rlrml/subtr-actor")> | null = null;

const FEATURES = [
  {
    global: ["BallRigidBody", "SecondsRemaining", "CurrentTime", "ReplicatedGameStateTimeRemaining"],
    player: ["PlayerRigidBody", "PlayerBoost"],
  },
  {
    global: ["BallRigidBody", "SecondsRemaining", "CurrentTime"],
    player: ["PlayerRigidBody", "PlayerBoost"],
  },
];

export async function samplesFromReplay(
  bytes: Uint8Array,
  players: NamedPlayer[],
): Promise<FrameSample[]> {
  const actor = await loadActor();
  let lastError: unknown;
  for (const features of FEATURES) {
    try {
      const result = actor.get_ndarray_with_info(bytes, features.global, features.player, 10);
      return ndarrayToSamples(result, players);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Frame export failed");
}

async function loadActor(): Promise<typeof import("@rlrml/subtr-actor")> {
  if (!loading) {
    loading = (async () => {
      const actor = await import("@rlrml/subtr-actor");
      const wasmPath = require.resolve("@rlrml/subtr-actor/rl_replay_subtr_actor_bg.wasm");
      const wasm = await readFile(wasmPath);
      await actor.default({ module_or_path: wasm });
      return actor;
    })();
  }
  return loading;
}
