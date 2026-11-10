import { createToken } from "@/lib/repo";
import { listenerBat } from "@/lib/listener-script";
import { publicUrl } from "@/lib/env";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const created = await createToken(user.id, "Listener");
  let script: string;
  try {
    script = listenerBat(publicUrl(request), created.secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not build the listener.";
    return Response.json({ error: message }, { status: 500 });
  }
  return new Response(script, {
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": 'attachment; filename="ReplayLab.bat"',
    },
  });
}
