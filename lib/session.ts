import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSession, sessionCookie } from "./auth";
import { findUser, findUserByToken } from "./repo";
import type { User } from "./types";

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const steamId = await readSession(jar.get(sessionCookie.name)?.value);
  if (!steamId) return null;
  return findUser(steamId);
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/");
  return user;
}

export async function userFromRequest(request: Request): Promise<User | null> {
  const header = request.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) {
    return findUserByToken(header.slice(7).trim());
  }
  return currentUser();
}
