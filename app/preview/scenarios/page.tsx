import Link from "next/link";
import { notFound } from "next/navigation";
import { ScenarioBuilder } from "@/components/scenario-builder";
import { PRESETS, describeScenario } from "@/lib/scenarios/catalog";
import { demoGames } from "@/lib/scenarios/demo";
import { buildScenarioReport } from "@/lib/scenarios/match";

export default function PreviewScenariosPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const games = demoGames();
  const featured = PRESETS.slice(0, 3);

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="font-mono text-xs tracking-[0.22em] text-gold uppercase">Sample</p>
        <h1 className="mt-3 text-4xl tracking-tight">Edit the chain and the count moves.</h1>
        <p className="mt-3 text-muted">
          This is one built game, not your replays.{" "}
          <Link href="/preview" className="text-gold">
            Back to the sample review
          </Link>
          . Sign in to save a scenario against your own event log.
        </p>
      </header>
      <ul className="grid gap-3 md:grid-cols-3">
        {featured.map((preset) => {
          const report = buildScenarioReport(games, preset.definition);
          return (
            <li key={preset.id} className="border border-line p-4">
              <h2 className="text-lg tracking-tight">{preset.name}</h2>
              <p className="mt-2 font-mono text-2xl text-gold">{report.occurrences}</p>
              <p className="mt-2 text-sm text-muted">{describeScenario(preset.definition)}</p>
            </li>
          );
        })}
      </ul>
      <ScenarioBuilder
        name={PRESETS[2].name}
        definition={PRESETS[2].definition}
        games={games}
        presets={PRESETS}
      />
    </div>
  );
}
