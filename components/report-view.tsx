import Link from "next/link";
import type { Comparison, Factor, Report, ReviewGame, SessionSummary, WorkItem } from "@/lib/coaching/report";
import { formatWhen, gameLine, resultWord, scoreline, signed } from "@/lib/format";
import { playlistLabel } from "@/lib/replay/maps";

const FILTERS = [
  ["doubles", "Doubles"],
  ["standard", "Standard"],
  ["duel", "Duel"],
  ["extra", "Extra"],
  ["all", "All"],
];

export function ReportView({
  report,
  playlist,
  limit,
  basePath,
  focus,
}: {
  report: Report;
  playlist: string;
  limit: number;
  basePath: string;
  focus: "review" | "patterns";
}) {
  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-3xl">
          <p className="font-mono text-xs tracking-[0.22em] text-gold uppercase">Doubles · GC3 to SSL</p>
          <h1 className="mt-3 text-4xl leading-tight tracking-tight">{report.headline}</h1>
          <p className="mt-3 text-muted">{report.subhead}</p>
        </div>
        <dl className="grid grid-cols-3 gap-4 font-mono">
          <Stat label="Record" value={`${report.wins}–${report.losses}`} />
          <Stat label="Goal diff" value={signed(report.goalDifference)} />
          <Stat label="Games" value={String(report.matched.length)} />
        </dl>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {FILTERS.map(([id, label]) => (
          <Link
            key={id}
            href={href(basePath, id, limit)}
            className={`border px-2.5 py-1 ${playlist === id ? "border-gold text-gold" : "border-line text-muted"}`}
          >
            {label}
          </Link>
        ))}
        {[20, 50, 100].map((value) => (
          <Link
            key={value}
            href={href(basePath, playlist, value)}
            className={`font-mono ${limit === value ? "text-ink" : "text-muted"}`}
          >
            {value}
          </Link>
        ))}
      </div>

      {report.unmatched > 0 ? (
        <p className="border border-gold/40 bg-panel px-4 py-3 text-sm">
          {report.unmatched} {report.unmatched === 1 ? "replay doesn't" : "replays don't"} match your
          Steam account. Set your in-game name in Settings if Rocket League is on Epic.
        </p>
      ) : null}

      {report.matched.length === 0 ? (
        <Empty playlist={playlist} />
      ) : focus === "review" ? (
        <>
          <WorkList items={report.workOn.slice(0, 3)} />
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <SessionCard session={report.latestSession} />
            <ComparisonTable rows={report.comparisons} />
          </div>
          <FactorGrid report={report} />
          <GameTable games={report.games.filter((game) => game.replay.countable).slice(0, 12)} />
        </>
      ) : (
        <>
          <FactorGrid report={report} />
          <ComparisonTable rows={report.comparisons} />
          <WorkList items={report.workOn} />
        </>
      )}
    </div>
  );
}

function WorkList({ items }: { items: WorkItem[] }) {
  if (!items.length) return null;
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {items.map((item, index) => (
        <article key={item.id} className="border border-line bg-panel p-4">
          <p className="font-mono text-xs text-gold">0{index + 1}</p>
          <h2 className="mt-2 text-xl tracking-tight">{item.title}</h2>
          <p className="mt-3 text-sm text-muted">{item.why}</p>
          <p className="mt-3 text-sm">{item.drill}</p>
          <p className="mt-4 font-mono text-xs text-gold">{item.evidence}</p>
        </article>
      ))}
    </section>
  );
}

function SessionCard({ session }: { session: SessionSummary | null }) {
  if (!session) return null;
  return (
    <section className="border border-line bg-panel p-4">
      <p className="font-mono text-xs tracking-[0.18em] text-muted uppercase">Latest session</p>
      <h2 className="mt-2 text-2xl tracking-tight">
        {session.wins}–{session.losses}
        <span className="ml-3 font-mono text-base text-muted">
          {session.goalsFor} for · {session.goalsAgainst} against
        </span>
      </h2>
      <p className="mt-2 text-sm text-muted">
        {formatWhen(session.startedAt)}
        {session.endedAt && session.endedAt !== session.startedAt ? ` – ${formatWhen(session.endedAt)}` : ""}
        {" · "}
        {session.games.length} games
      </p>
      <p className="mt-4 text-sm">
        {session.leak ? `The leak in this session is ${session.leak.toLowerCase()}.` : "No single goal type repeated enough to call it a leak."}
      </p>
    </section>
  );
}

function ComparisonTable({ rows }: { rows: Comparison[] }) {
  if (!rows.length) return null;
  return (
    <section className="border border-line bg-panel p-4">
      <p className="font-mono text-xs tracking-[0.18em] text-muted uppercase">Wins against losses</p>
      <table className="mt-3 w-full text-sm">
        <thead className="font-mono text-xs text-muted">
          <tr>
            <th className="py-1 text-left font-normal">Stat</th>
            <th className="py-1 text-right font-normal">Wins</th>
            <th className="py-1 text-right font-normal">Losses</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-line">
              <td className="py-2">
                {row.label}
                <span className="mt-0.5 block font-mono text-[11px] text-muted">{row.note}</span>
              </td>
              <td className="py-2 text-right font-mono">{show(row.wins, row.unit)}</td>
              <td className={`py-2 text-right font-mono ${row.note === "Worse in losses" ? "text-loss" : ""}`}>
                {show(row.losses, row.unit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function FactorGrid({ report }: { report: Report }) {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <FactorColumn title="What losses have in common" items={report.lossFactors} empty="Wins and losses look alike so far." />
      <FactorColumn title="How you score" items={report.goalFactors} empty="No goals for in this sample." />
      <FactorColumn title="How you concede" items={report.concedeFactors} empty="No goals against in this sample." />
    </section>
  );
}

function FactorColumn({ title, items, empty }: { title: string; items: Factor[]; empty: string }) {
  return (
    <div className="border border-line p-4">
      <h2 className="text-lg tracking-tight">{title}</h2>
      {items.length === 0 ? <p className="mt-3 text-sm text-muted">{empty}</p> : null}
      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <p>{item.label}</p>
            <p className="font-mono text-xs text-muted">{item.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GameTable({ games }: { games: ReviewGame[] }) {
  if (!games.length) return null;
  return (
    <section>
      <h2 className="text-lg tracking-tight">Recent games</h2>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {games.map((game) => (
          <li key={game.id}>
            <Link href={`/replays/${game.id}`} className="grid gap-2 py-3 sm:grid-cols-[9rem_7rem_1fr_auto] sm:items-baseline">
              <span className="text-sm text-muted">{formatWhen(game.replay.playedAt)}</span>
              <span className="font-mono">
                <Result game={game} /> {scoreline(game)}
              </span>
              <span>
                {game.replay.mapLabel}
                <span className="mt-0.5 block text-sm text-muted">{gameLine(game)}</span>
              </span>
              <span className="font-mono text-xs text-muted">{playlistLabel(game.replay.playlist)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Result({ game }: { game: ReviewGame }) {
  const word = resultWord(game);
  const tone = word === "Win" ? "text-win" : word === "Loss" ? "text-loss" : "text-muted";
  return <span className={tone}>{word}</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-2xl">{value}</dd>
    </div>
  );
}

function Empty({ playlist }: { playlist: string }) {
  const mode = playlist === "all" ? "replay" : playlistLabel(playlist).toLowerCase();
  return (
    <section className="border border-line bg-panel p-5">
      <h2 className="text-xl tracking-tight">No {mode} games in the ledger yet</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Sign in, create a helper token in Settings, then point the helper at the demos folder. It
        uploads each replay when the game ends.
      </p>
      <pre className="mt-4 overflow-x-auto font-mono text-xs text-gold">{`npm run helper -- setup --token rpl_... --url http://localhost:3000
npm run helper -- scan`}</pre>
    </section>
  );
}

function show(value: number | null, unit: string): string {
  if (value == null) return "—";
  if (unit === "%") return `${Math.round(value)}%`;
  if (unit === "s") return `${Math.round(value)}s`;
  return Math.abs(value) >= 10 ? String(Math.round(value)) : value.toFixed(1);
}

function href(basePath: string, playlist: string, limit: number): string {
  const params = new URLSearchParams();
  if (playlist !== "doubles") params.set("playlist", playlist);
  if (limit !== 50) params.set("limit", String(limit));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
