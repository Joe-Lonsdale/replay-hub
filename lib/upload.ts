import { publicUrl, r2Configured } from "./env";
import { unpackReplay } from "./replay/pack";
import type { StoredReplay } from "./replay/types";
import { presignPut, replayObjectKey } from "./storage";

export interface UploadBody {
  sha256: string;
  byteLength: number;
  replay: StoredReplay;
}

export interface UploadInstruction {
  url: string;
  headers: { "content-type": string };
  auth: boolean;
  confirm: string | null;
}

export function parseUpload(value: unknown): UploadBody | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Partial<UploadBody>;
  if (typeof body.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(body.sha256)) return null;
  if (typeof body.byteLength !== "number" || body.byteLength < 1000 || body.byteLength > 20_000_000) {
    return null;
  }
  const replay = unpackReplay(body.replay);
  if (!replay || typeof replay.playlist !== "string" || typeof replay.mapLabel !== "string") return null;
  return {
    sha256: body.sha256.toLowerCase(),
    byteLength: body.byteLength,
    replay,
  };
}

export async function uploadInstruction(
  request: Request,
  userId: string,
  replayId: string,
): Promise<{ storageKey: string | null; storageStatus: string; upload: UploadInstruction | null }> {
  const key = replayObjectKey(userId, replayId);
  if (r2Configured()) {
    return {
      storageKey: key,
      storageStatus: "pending",
      upload: {
        url: await presignPut(key),
        headers: { "content-type": "application/octet-stream" },
        auth: false,
        confirm: `${publicUrl(request)}/api/replays/${replayId}/complete`,
      },
    };
  }
  if (process.env.VERCEL) {
    return { storageKey: null, storageStatus: "stats-only", upload: null };
  }
  return {
    storageKey: key,
    storageStatus: "pending",
    upload: {
      url: `${publicUrl(request)}/api/replays/${replayId}/file`,
      headers: { "content-type": "application/octet-stream" },
      auth: true,
      confirm: null,
    },
  };
}
