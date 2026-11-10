import Link from "next/link";
import { Nav } from "./nav";
import type { User } from "@/lib/types";

export function Shell({ user, children }: { user: User | null; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <Link href={user ? "/review" : "/"} className="text-lg tracking-tight">
            Replay Lab
          </Link>
          {user ? <Nav /> : null}
          {user ? (
            <div className="flex items-center gap-3 text-sm">
              {user.avatarUrl ? (
                // Steam avatars are remote and don't need the image optimizer.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="h-8 w-8" />
              ) : null}
              <span>{user.personaName}</span>
              <form action="/api/auth/logout" method="post">
                <button className="text-muted hover:text-ink" type="submit">
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <Link href="/api/auth/steam" className="bg-gold px-3 py-1.5 text-sm text-bg">
              Sign in with Steam
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
