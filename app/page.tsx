import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await currentUser();
  if (user) redirect("/review");
  const { error } = await searchParams;

  return (
    <div className="grid items-end gap-12 lg:grid-cols-[1.3fr_0.7fr]">
      <div>
        <p className="font-mono text-xs tracking-[0.22em] text-gold uppercase">GC3 doubles · the next rank</p>
        <h1 className="mt-4 max-w-3xl text-5xl leading-[1.05] tracking-tight">
          See the decision that lost the game.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Replay Lab reads the demos folder, keeps the files in object storage, and turns a session
          into the habits that show up in losses: kickoffs, double commits, empty nets, and boost.
        </p>
        {error ? <p className="mt-4 text-loss">{error}</p> : null}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href="/api/auth/steam" className="bg-gold px-4 py-2 text-bg">
            Sign in with Steam
          </Link>
          {process.env.NODE_ENV !== "production" ? (
            <Link href="/preview" className="text-sm text-muted">
              Preview a sample review
            </Link>
          ) : null}
        </div>
      </div>
      <ol className="space-y-4 border border-line bg-panel p-5">
        {[
          ["01", "Sign in", "Steam is the account. Your in-game name covers Epic-linked players."],
          ["02", "Run the helper", "It watches the demos folder and uploads each replay when the match ends."],
          ["03", "Review the leak", "Session record, goals for, goals against, and the drill for the habit that repeats."],
        ].map(([index, title, body]) => (
          <li key={index}>
            <p className="font-mono text-xs text-gold">{index}</p>
            <h2 className="mt-1 text-xl tracking-tight">{title}</h2>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
