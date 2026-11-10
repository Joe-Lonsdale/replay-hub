import Link from "next/link";
import { notFound } from "next/navigation";
import { removeReplay } from "@/lib/actions";
import { attachIdentity } from "@/lib/coaching/report";
import { TAG_LABEL } from "@/lib/coaching/tags";
import { explainGame, formatClock, formatWhen, resultWord, scoreline } from "@/lib/format";
import { playlistLabel } from "@/lib/replay/maps";
import { getReplay } from "@/lib/repo";
import { requireUser } from "@/lib/session";
import type { DeepStats } from "@/lib/replay/types";

export default async function ReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const row = await getReplay(user.id, id);
  if (!row) notFound();
  const game = attachIdentity(row.id, row.analysis, user.id, user.rlName);
  const word = resultWord(game);
  const tone = word === "Win" ? "text-win" : word === "Loss" ? "text-loss" : "text-muted";
  const you = game.userName ? game.replay.players.find((player) => player.name === game.userName) : null;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/replays" className="text-sm text-muted">
          All replays
        </Link>
        <p className="mt-4 font-mono text-xs tracking-[0.18em] text-gold uppercase">
          {formatWhen(game.replay.playedAt)} · {playlistLabel(game.replay.playlist)}
          {game.replay.matchType ? ` · ${game.replay.matchType}` : ""}
        </p>
        <h1 className="mt-2 text-4xl tracking-tight">
          <span className={tone}>{word}</span> {scoreline(game)}
        </h1>
        <p className="mt-2 text-muted">
          {game.replay.mapLabel}
          {game.replay.overtime ? " · overtime" : ""}
          {game.replay.forfeit ? " · forfeit" : ""}
        </p>
        <p className="mt-4 max-w-2xl text-lg">{explainGame(game)}</p>
      </div>

      <section>
        <h2 className="text-lg tracking-tight">Goals</h2>
        <ol className="mt-3 divide-y divide-line border-y border-line">
          {game.replay.goals.map((goal, index) => {
            const against = game.userTeam != null && goal.team !== game.userTeam;
            return (
              <li key={`${goal.frame}-${index}`} className="grid gap-2 py-3 sm:grid-cols-[5rem_1fr]">
                <span className="font-mono text-gold">{formatClock(goal)}</span>
                <div>
                  <p>
                    <span className={against ? "text-loss" : "text-win"}>{against ? "Against" : "For"}</span>
                    {" · "}
                    {goal.scorer}
                    {goal.lastMan ? <span className="text-muted"> · last man {goal.lastMan}</span> : null}
                  </p>
                  <p className="mt-1 text-sm text-muted">{goal.detail}</p>
                  <p className="mt-2 flex flex-wrap gap-2">
                    {goal.tags.map((tag) => (
                      <span key={tag} className="border border-line px-1.5 py-0.5 font-mono text-[11px] uppercase">
                        {TAG_LABEL[tag]}
                      </span>
                    ))}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section>
        <h2 className="text-lg tracking-tight">Scoreboard</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="font-mono text-xs text-muted">
            <tr>
              <th className="py-1 text-left font-normal">Player</th>
              <th className="text-right font-normal">Score</th>
              <th className="text-right font-normal">G</th>
              <th className="text-right font-normal">A</th>
              <th className="text-right font-normal">S</th>
              <th className="text-right font-normal">Sh</th>
              <th className="text-right font-normal">Sh%</th>
            </tr>
          </thead>
          <tbody>
            {game.replay.players.map((player) => (
              <tr key={`${player.name}-${player.team}`} className="border-t border-line">
                <td className="py-2">
                  <span className={player.team === 0 ? "text-blue" : "text-orange"}>{player.name}</span>
                  {player.name === game.userName ? <span className="ml-2 font-mono text-xs text-gold">you</span> : null}
                </td>
                <td className="text-right font-mono">{player.score}</td>
                <td className="text-right font-mono">{player.goals}</td>
                <td className="text-right font-mono">{player.assists}</td>
                <td className="text-right font-mono">{player.saves}</td>
                <td className="text-right font-mono">{player.shots}</td>
                <td className="text-right font-mono">
                  {player.shootingPct == null ? "—" : `${Math.round(player.shootingPct)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {you?.deep ? <Deep stats={you.deep} /> : (
        <p className="text-sm text-muted">
          This one was read from the replay header. Boost, speed, and rotation show up when the helper
          can parse the network frames.
        </p>
      )}

      {game.replay.warnings.length ? (
        <ul className="text-sm text-muted">
          {game.replay.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      <p className="font-mono text-xs text-muted">
        File {row.storageStatus} · {playlistLabel(game.replay.playlist)} · {game.replay.depth}
      </p>
      <form action={removeReplay}>
        <input type="hidden" name="id" value={row.id} />
        <button type="submit" className="text-sm text-muted hover:text-loss">
          Delete this replay
        </button>
      </form>
    </div>
  );
}

function Deep({ stats }: { stats: DeepStats }) {
  const rows: [string, string][] = [
    ["Zero boost", `${stats.timeZeroBoost}s`],
    ["Full boost", `${stats.timeFullBoost}s`],
    ["Boost stolen", String(stats.boostStolen)],
    ["Big pads", String(stats.bigPads)],
    ["Small pads", String(stats.smallPads)],
    ["Supersonic", `${stats.percentSupersonic}%`],
    ["Avg speed", `${stats.avgSpeed}`],
    ["Their third", `${stats.percentOffensiveThird}%`],
    ["Behind the ball", `${stats.percentBehindBall}%`],
    ["Demos taken", String(stats.demosTaken)],
    ["Goals while last", String(stats.goalsAgainstWhileLast)],
  ];
  return (
    <section>
      <h2 className="text-lg tracking-tight">Your boost and position</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label} className="border border-line px-3 py-2">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="font-mono text-lg">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

