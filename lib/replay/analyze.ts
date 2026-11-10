import { buildReplay } from "./frames";
import { parseReplayHeader } from "./header";
import type { FrameSample, StoredReplay } from "./types";

export function analyzeReplay(buffer: Uint8Array, samples: FrameSample[] | null = null): StoredReplay {
  const header = parseReplayHeader(buffer);
  return buildReplay(header, samples);
}

export { buildReplay } from "./frames";
export { parseReplayHeader } from "./header";
