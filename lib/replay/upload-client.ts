import { parseReplayBytes, sha256Hex } from "./browser-parse";

interface UploadResponse {
  id: string;
  duplicate: boolean;
  storage: string;
  upload: {
    url: string;
    headers: Record<string, string>;
    auth: boolean;
    confirm: string | null;
  } | null;
  error?: string;
}

export async function uploadReplayFile(file: File, onStatus: (status: string) => void): Promise<string> {
  if (!file.name.toLowerCase().endsWith(".replay")) throw new Error("Choose a .replay file.");
  if (file.size < 1000 || file.size > 20_000_000) throw new Error("That file does not look like a replay.");
  onStatus("Reading the replay");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha256 = await sha256Hex(bytes);
  const replay = await parseReplayBytes(bytes);
  const depth = replay.depth === "frames" ? "frame data" : "header only";
  onStatus("Uploading");
  const response = await fetch("/api/replays", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sha256, byteLength: bytes.byteLength, replay }),
  });
  const body = (await response.json().catch(() => null)) as UploadResponse | null;
  if (!response.ok || !body?.id) {
    throw new Error(body?.error ?? "The stats were not accepted.");
  }
  if (body.upload) await sendFile(body, bytes);
  if (body.duplicate && body.storage === "stored") return `Already uploaded. Stats refreshed (${depth}).`;
  if (!body.upload) return `Stats saved (${depth}). The replay file was not stored.`;
  return `Saved (${depth}).`;
}

async function sendFile(body: UploadResponse, bytes: Uint8Array) {
  const upload = body.upload;
  if (!upload) return;
  if (!upload.auth) {
    try {
      const direct = await fetch(upload.url, { method: "PUT", headers: upload.headers, body: bytes as BufferSource });
      if (direct.ok) {
        if (upload.confirm) {
          const confirm = await fetch(`/api/replays/${body.id}/complete`, { method: "POST" });
          if (!confirm.ok) throw new Error("The file reached storage but was not confirmed.");
        }
        return;
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("not confirmed")) throw error;
    }
  }
  const relay = await fetch(`/api/replays/${body.id}/file`, {
    method: "PUT",
    headers: { "content-type": "application/octet-stream" },
    body: bytes as BufferSource,
  });
  if (!relay.ok) {
    const text = await relay.text();
    if (relay.status === 413 || bytes.byteLength > 4_500_000) {
      throw new Error(
        "This replay is too large to send through the site. Add a CORS PUT rule on the R2 bucket for this site so the file can go straight to storage.",
      );
    }
    throw new Error(text || "The replay file did not upload.");
  }
}
