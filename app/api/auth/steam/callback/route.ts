import { NextResponse } from "next/server";
import { sessionCookie, signSession } from "@/lib/auth";
import { publicUrl } from "@/lib/env";
import { upsertUser } from "@/lib/repo";
import { steamProfile, verifyAssertion } from "@/lib/steam";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const app = publicUrl(request);
  try {
    const steamId = await verifyAssertion(request.url, app);
    const profile = await steamProfile(steamId);
    await upsertUser({
      id: steamId,
      personaName: profile.name,
      avatarUrl: profile.avatar,
      profileUrl: profile.url,
    });
    const token = await signSession(steamId);
    const response = NextResponse.redirect(new URL("/review", app));
    response.cookies.set(sessionCookie.name, token, sessionCookie.options);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Steam login failed";
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(message)}`, app));
  }
}
