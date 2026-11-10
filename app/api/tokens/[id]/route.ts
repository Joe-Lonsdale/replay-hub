import { deleteToken } from "@/lib/repo";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  await deleteToken(user.id, id);
  return Response.json({ ok: true });
}
