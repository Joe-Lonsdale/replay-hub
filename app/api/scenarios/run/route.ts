import { parseDefinition } from "@/lib/scenarios/catalog";
import { runScenario } from "@/lib/scenarios/run";
import { userFromRequest } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLAYLISTS = new Set(["duel", "doubles", "standard", "extra"]);

export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return Response.json({ error: "Sign in." }, { status: 401 });

  let body: { definition?: unknown; playlist?: unknown } = {};
  try {
    body = (await request.json()) as { definition?: unknown; playlist?: unknown };
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }
  const definition = parseDefinition(body.definition);
  if (!definition) return Response.json({ error: "Scenario was incomplete." }, { status: 400 });

  const requested = body.playlist === "all" ? null : typeof body.playlist === "string" ? body.playlist : "doubles";
  const playlist = requested && PLAYLISTS.has(requested) ? requested : requested === null ? null : "doubles";
  const report = await runScenario(user, definition, playlist);
  return Response.json(report);
}
