import { getReplay, setReplayStorage } from "@/lib/repo";
import { userFromRequest } from "@/lib/session";
import { objectExists } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await userFromRequest(request);
  if (!user) return Response.json({ error: "Sign in or send a helper token." }, { status: 401 });
  const { id } = await context.params;
  const replay = await getReplay(user.id, id);
  if (!replay) return Response.json({ error: "Replay not found." }, { status: 404 });
  if (!replay.storageKey) return Response.json({ error: "This replay has no storage key." }, { status: 400 });
  const exists = await objectExists(replay.storageKey);
  if (!exists) return Response.json({ error: "The file has not arrived in storage yet." }, { status: 400 });
  await setReplayStorage(user.id, id, replay.storageKey, "stored");
  return Response.json({ ok: true });
}
