import { GameTable } from "@/components/report-view";
import { attachIdentity } from "@/lib/coaching/report";
import { listReplays } from "@/lib/repo";
import { requireUser } from "@/lib/session";

export default async function ReplaysPage() {
  const user = await requireUser();
  const rows = await listReplays(user.id, null, 100);
  const games = rows.map((row) => attachIdentity(row.id, row.analysis, user.id, user.rlName));
  return (
    <div>
      <p className="font-mono text-xs tracking-[0.22em] text-gold uppercase">Ledger</p>
      <h1 className="mt-3 text-4xl tracking-tight">Replays</h1>
      <p className="mt-3 text-muted">Every uploaded game, newest first. Open one to read the goals.</p>
      <div className="mt-8">
        {games.length ? <GameTable games={games} /> : <p className="text-muted">Nothing uploaded yet.</p>}
      </div>
    </div>
  );
}
