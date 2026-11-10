import Link from "next/link";
import { createScenario } from "@/lib/scenario-actions";
import { PRESETS, describeScenario } from "@/lib/scenarios/catalog";
import { loadScenarioGames } from "@/lib/scenarios/run";
import { buildScenarioReport } from "@/lib/scenarios/match";
import { listScenarios } from "@/lib/repo";
import { requireUser } from "@/lib/session";

const PLAYLISTS = [
  ["doubles", "Doubles"],
  ["standard", "Standard"],
  ["duel", "Duel"],
  ["extra", "Extra"],
  ["all", "All"],
];

export default async function ScenariosPage({
  searchParams,
}: {
  searchParams: Promise<{ playlist?: string }>;
}) {
  const user = await requireUser();
  const { playlist: playlistParam } = await searchParams;
  const playlist = PLAYLISTS.some(([id]) => id === playlistParam) ? (playlistParam ?? "doubles") : "doubles";
  const [saved, games] = await Promise.all([
    listScenarios(user.id),
    loadScenarioGames(user, playlist === "all" ? null : playlist, 80),
  ]);

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <p className="font-mono text-xs tracking-[0.22em] text-gold uppercase">Scenarios</p>
        <h1 className="mt-3 text-4xl tracking-tight">Chain the events, then count them.</h1>
        <p className="mt-3 text-muted">
          A scenario is an ordered list. Each step picks who did it, what they did, and any numbers you care
          about. The count updates across the games below.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 text-sm">
        {PLAYLISTS.map(([id, label]) => (
          <Link
            key={id}
            href={id === "doubles" ? "/scenarios" : `/scenarios?playlist=${id}`}
            className={`border px-2.5 py-1 ${playlist === id ? "border-gold text-gold" : "border-line text-muted"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg tracking-tight">Your scenarios</h2>
        {saved.length === 0 ? (
          <p className="text-sm text-muted">Nothing saved yet. Start from one of the examples.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {saved.map((scenario) => {
              const report = buildScenarioReport(games, scenario.definition);
              return (
                <li key={scenario.id}>
                  <Link href={`/scenarios/${scenario.id}?playlist=${playlist}`} className="block py-3">
                    <span className="flex flex-wrap items-baseline justify-between gap-3">
                      <span className="text-lg tracking-tight">{scenario.name}</span>
                      <span className="font-mono text-sm text-gold">
                        {report.occurrences} {report.occurrences === 1 ? "time" : "times"}
                      </span>
                    </span>
                    <span className="mt-1 block text-sm text-muted">{describeScenario(scenario.definition)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg tracking-tight">Start from an example</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {PRESETS.map((preset) => (
            <li key={preset.id} className="border border-line bg-panel p-4">
              <h3 className="text-xl tracking-tight">{preset.name}</h3>
              <p className="mt-2 text-sm text-muted">{preset.blurb}</p>
              <p className="mt-2 text-sm">{describeScenario(preset.definition)}</p>
              <form action={createScenario} className="mt-4">
                <input type="hidden" name="preset" value={preset.id} />
                <button type="submit" className="bg-ink px-3 py-1.5 text-sm text-bg">
                  Use this
                </button>
              </form>
            </li>
          ))}
          <li className="border border-line p-4">
            <h3 className="text-xl tracking-tight">Blank chain</h3>
            <p className="mt-2 text-sm text-muted">One step, then you add the rest.</p>
            <form action={createScenario} className="mt-4">
              <button type="submit" className="border border-line px-3 py-1.5 text-sm">
                Start empty
              </button>
            </form>
          </li>
        </ul>
      </section>
    </div>
  );
}
