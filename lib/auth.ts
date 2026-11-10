import "server-only";
import { SignJWT, jwtVerify } from "jose";

export const sessionCookie = {
  name: "rl_session",
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  },
};

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (value) return new TextEncoder().encode(value);
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production");
  }
  return new TextEncoder().encode("replay-lab-dev-secret");
}

export async function signSession(steamId: string): Promise<string> {
  return new SignJWT({ sub: steamId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function readSession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
