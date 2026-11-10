import { NextResponse } from "next/server";
import { sessionCookie } from "@/lib/auth";
import { publicUrl } from "@/lib/env";

export const runtime = "nodejs";

export function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", publicUrl(request)), 303);
  response.cookies.set(sessionCookie.name, "", { ...sessionCookie.options, maxAge: 0 });
  return response;
}
