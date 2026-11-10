import { findReplayByHash, insertReplay, replaceReplayAnalysis, setReplayStorage } from "@/lib/repo";
import { userFromRequest } from "@/lib/session";
import { parseUpload, uploadInstruction } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return Response.json({ error: "Sign in or send a helper token." }, { status: 401 });

  const raw = await request.text();
  if (raw.length > 4_000_000) {
    return Response.json({ error: "Stats payload is too large." }, { status: 413 });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }
  const body = parseUpload(parsed);
  if (!body) return Response.json({ error: "Replay stats were incomplete." }, { status: 400 });

  const existing = await findReplayByHash(user.id, body.sha256);
  if (existing?.storageStatus === "stored") {
    await replaceReplayAnalysis(user.id, existing.id, body.replay, body.byteLength);
    return Response.json({ id: existing.id, duplicate: true, storage: "stored", upload: null });
  }

  const replay =
    existing ??
    (await insertReplay({
      userId: user.id,
      sha256: body.sha256,
      replay: body.replay,
      byteLength: body.byteLength,
      storageKey: null,
      storageStatus: "stats-only",
    }));

  if (existing) {
    await replaceReplayAnalysis(user.id, existing.id, body.replay, body.byteLength);
  }

  const plan = await uploadInstruction(request, user.id, replay.id);
  await setReplayStorage(
    user.id,
    replay.id,
    plan.storageKey,
    plan.upload ? "pending" : "stats-only",
  );

  return Response.json({
    id: replay.id,
    duplicate: Boolean(existing),
    storage: plan.upload ? "pending" : "stats-only",
    upload: plan.upload,
  });
}
