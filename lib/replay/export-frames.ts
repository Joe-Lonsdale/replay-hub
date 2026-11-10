import { ndarrayToSamples, type NamedPlayer, type NdResult } from "./ndarray";
import type { FrameSample } from "./types";

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

export interface FrameActor {
  get_ndarray_with_info(
    data: Uint8Array,
    globalFeatures: string[],
    playerFeatures: string[],
    fps: number,
  ): NdResult;
}

export function samplesFromActor(
  actor: FrameActor,
  bytes: Uint8Array,
  players: NamedPlayer[],
): FrameSample[] {
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
