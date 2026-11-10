import { getReplay, setReplayStorage } from "@/lib/repo";
import { userFromRequest } from "@/lib/session";
import { readLocalReplay, writeLocalReplay } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await userFromRequest(request);
  if (!user) return Response.json({ error: "Sign in or send a helper token." }, { status: 401 });
  const { id } = await context.params;
  const replay = await getReplay(user.id, id);
  if (!replay) return Response.json({ error: "Replay not found." }, { status: 404 });
  if (process.env.VERCEL) {
    return Response.json({ error: "Upload the file straight to R2." }, { status: 400 });
  }

  const body = Buffer.from(await request.arrayBuffer());
  if (body.length < 1000 || body.length > 20_000_000) {
    return Response.json({ error: "Replay file size looks wrong." }, { status: 400 });
  }
  await writeLocalReplay(user.id, id, body);
  await setReplayStorage(user.id, id, replay.storageKey, "stored");
  return Response.json({ ok: true });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await userFromRequest(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  const replay = await getReplay(user.id, id);
  if (!replay) return Response.json({ error: "Replay not found." }, { status: 404 });
  const file = await readLocalReplay(user.id, id);
  if (!file) return Response.json({ error: "File is not on this machine." }, { status: 404 });
  return new Response(new Uint8Array(file), {
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="${id}.replay"`,
    },
  });
}
