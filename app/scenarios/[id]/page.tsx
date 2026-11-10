import Link from "next/link";
import { notFound } from "next/navigation";
import { ScenarioBuilder } from "@/components/scenario-builder";
import { removeScenario, saveScenario } from "@/lib/scenario-actions";
import { PRESETS } from "@/lib/scenarios/catalog";
import { runScenario } from "@/lib/scenarios/run";
import { getScenario } from "@/lib/repo";
import { requireUser } from "@/lib/session";

const PLAYLISTS = new Set(["doubles", "standard", "duel", "extra", "all"]);

export default async function ScenarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ playlist?: string; saved?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const scenario = await getScenario(user.id, id);
  if (!scenario) notFound();
  const playlist = query.playlist && PLAYLISTS.has(query.playlist) ? query.playlist : "doubles";
  const report = await runScenario(user, scenario.definition, playlist === "all" ? null : playlist);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={playlist === "doubles" ? "/scenarios" : `/scenarios?playlist=${playlist}`} className="text-sm text-muted">
          All scenarios
        </Link>
        <div className="flex flex-wrap gap-2 text-sm">
          {["doubles", "standard", "duel", "extra", "all"].map((mode) => (
            <Link
              key={mode}
              href={mode === "doubles" ? `/scenarios/${scenario.id}` : `/scenarios/${scenario.id}?playlist=${mode}`}
              className={`capitalize ${playlist === mode ? "text-gold" : "text-muted"}`}
            >
              {mode}
            </Link>
          ))}
        </div>
      </div>
      <ScenarioBuilder
        id={scenario.id}
        name={scenario.name}
        definition={scenario.definition}
        report={report}
        playlist={playlist}
        presets={PRESETS}
        save={saveScenario}
        remove={removeScenario}
        saved={query.saved === "1"}
        error={query.error}
      />
    </div>
  );
}
