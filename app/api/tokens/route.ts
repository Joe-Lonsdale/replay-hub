import { createToken, listTokens } from "@/lib/repo";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  return Response.json({ tokens: await listTokens(user.id) });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim() || "Helper";
  const created = await createToken(user.id, name.slice(0, 40));
  return Response.json(created);
}
