import { NextResponse } from "next/server";
import { publicUrl } from "@/lib/env";
import { steamLoginUrl } from "@/lib/steam";

export const runtime = "nodejs";

export function GET(request: Request) {
  return NextResponse.redirect(steamLoginUrl(publicUrl(request)));
}
