"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ACTORS,
  EVENT_KINDS,
  FIELDS,
  FILTER_WHOS,
  describeScenario,
  fieldSpec,
  opsFor,
} from "@/lib/scenarios/catalog";
import { buildScenarioReport } from "@/lib/scenarios/match";
import type {
  FilterOp,
  ScenarioActor,
  ScenarioDefinition,
  ScenarioFilter,
  ScenarioGame,
  ScenarioReport,
  ScenarioStep,
} from "@/lib/scenarios/types";
import type { ScenarioPreset } from "@/lib/scenarios/catalog";

export function ScenarioBuilder({
  id,
  name: initialName,
  definition: initialDefinition,
  report: initialReport,
  games,
  playlist = "doubles",
  presets,
  save,
  remove,
  saved = false,
  error,
}: {
  id?: string;
  name: string;
  definition: ScenarioDefinition;
  report?: ScenarioReport | null;
  games?: ScenarioGame[];
  playlist?: string;
  presets: ScenarioPreset[];
  save?: (formData: FormData) => void | Promise<void>;
  remove?: (formData: FormData) => void | Promise<void>;
  saved?: boolean;
  error?: string;
}) {
  const [name, setName] = useState(initialName);
  const [definition, setDefinition] = useState(initialDefinition);
  const [remote, setRemote] = useState<ScenarioReport | null>(initialReport ?? null);
  const [pending, setPending] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const live = useMemo(
    () => (games ? buildScenarioReport(games, definition) : remote),
    [games, definition, remote],
  );
  const dirty =
    name !== initialName || JSON.stringify(definition) !== JSON.stringify(initialDefinition);

  function updateStep(index: number, patch: Partial<ScenarioStep>) {
    setDefinition((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) => (stepIndex === index ? { ...step, ...patch } : step)),
    }));
  }

  function updateFilter(stepIndex: number, filterIndex: number, patch: Partial<ScenarioFilter>) {
    setDefinition((current) => ({
      ...current,
      steps: current.steps.map((step, index) => {
        if (index !== stepIndex) return step;
        return {
          ...step,
          filters: step.filters.map((filter, cursor) => (cursor === filterIndex ? { ...filter, ...patch } : filter)),
        };
      }),
    }));
  }

  async function run() {
    setPending(true);
    setRunError(null);
    try {
      const response = await fetch("/api/scenarios/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ definition, playlist }),
      });
      const body = (await response.json()) as ScenarioReport & { error?: string };
      if (!response.ok) {
        setRunError(body.error ?? "Could not run this scenario.");
        return;
      }
      setRemote(body);
    } catch {
      setRunError("Could not run this scenario.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
      <div className="space-y-4">
        <label className="block">
          <span className="font-mono text-xs tracking-[0.18em] text-muted uppercase">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full border border-line px-3 py-2 text-xl"
          />
        </label>
        <p className="text-sm text-muted">{describeScenario(definition)}</p>

        <div className="flex flex-wrap gap-2 text-sm">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="border border-line px-2 py-1 text-muted hover:text-ink"
              onClick={() => {
                setName(preset.name);
                setDefinition(preset.definition);
              }}
            >
              {preset.name}
            </button>
          ))}
        </div>

        <ol className="space-y-3">
          {definition.steps.map((step, index) => (
            <li key={index} className="border border-line bg-panel p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-gold">0{index + 1}</span>
                <Select
                  value={step.actor}
                  onChange={(value) => updateStep(index, { actor: value as ScenarioActor })}
                  options={ACTORS.map((actor) => [actor.id, actor.label])}
                />
                <Select
                  value={step.kind}
                  onChange={(value) => updateStep(index, { kind: value })}
                  options={EVENT_KINDS.map((kind) => [kind.id, `${kind.group} · ${kind.label}`])}
                />
                {definition.steps.length > 1 ? (
                  <button
                    type="button"
                    className="text-sm text-muted"
                    onClick={() =>
                      setDefinition((current) => ({
                        ...current,
                        steps: current.steps.filter((_, cursor) => cursor !== index),
                      }))
                    }
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-muted">
                {EVENT_KINDS.find((kind) => kind.id === step.kind)?.hint}
              </p>
              {index > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    within
                    <input
                      inputMode="decimal"
                      value={step.within ?? ""}
                      placeholder="20"
                      onChange={(event) => updateStep(index, { within: numberOrNull(event.target.value) })}
                      className="w-16 border border-line px-2 py-1 font-mono"
                    />
                    s
                  </label>
                  <label className="flex items-center gap-2">
                    after
                    <input
                      inputMode="decimal"
                      value={step.after ?? ""}
                      placeholder="0"
                      onChange={(event) => updateStep(index, { after: numberOrNull(event.target.value) })}
                      className="w-16 border border-line px-2 py-1 font-mono"
                    />
                    s
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={step.next}
                      onChange={(event) => updateStep(index, { next: event.target.checked })}
                    />
                    the next one
                  </label>
                </div>
              ) : null}
              <ul className="mt-3 space-y-2">
                {step.filters.map((filter, filterIndex) => {
                  const spec = fieldSpec(filter.field);
                  return (
                    <li key={filterIndex} className="flex flex-wrap items-center gap-2 text-sm">
                      <Select
                        value={filter.who ?? "actor"}
                        onChange={(value) => updateFilter(index, filterIndex, { who: value as ScenarioFilter["who"] })}
                        options={FILTER_WHOS.map((who) => [who.id, who.label])}
                      />
                      <Select
                        value={filter.field}
                        onChange={(value) => {
                          const next = fieldSpec(value);
                          updateFilter(index, filterIndex, {
                            field: value,
                            op: next?.kind === "enum" ? "eq" : "lt",
                            value: next?.kind === "enum" ? (next.options?.[0] ?? "") : 20,
                          });
                        }}
                        options={FIELDS.map((field) => [field.id, field.label])}
                      />
                      <Select
                        value={filter.op}
                        onChange={(value) => updateFilter(index, filterIndex, { op: value as FilterOp })}
                        options={opsFor(filter.field).map((op) => [op.id, op.label])}
                      />
                      {spec?.kind === "enum" ? (
                        <Select
                          value={String(filter.value)}
                          onChange={(value) => updateFilter(index, filterIndex, { value })}
                          options={(spec.options ?? []).map((option) => [option, option])}
                        />
                      ) : (
                        <input
                          inputMode="decimal"
                          value={String(filter.value)}
                          onChange={(event) =>
                            updateFilter(index, filterIndex, { value: Number(event.target.value) })
                          }
                          className="w-24 border border-line px-2 py-1 font-mono"
                        />
                      )}
                      <button
                        type="button"
                        className="text-muted"
                        onClick={() =>
                          updateStep(index, {
                            filters: step.filters.filter((_, cursor) => cursor !== filterIndex),
                          })
                        }
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                className="mt-3 text-sm text-gold"
                onClick={() =>
                  updateStep(index, {
                    filters: [...step.filters, { field: "boost", op: "lt", value: 20, who: "actor" }],
                  })
                }
              >
                Add a condition
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="border border-line px-3 py-2 text-sm"
          onClick={() =>
            setDefinition((current) => ({
              ...current,
              steps: [
                ...current.steps,
                { actor: "opponent", kind: "touch", filters: [], within: 5, after: null, next: false },
              ],
            }))
          }
        >
          Add a step
        </button>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          Watch what happens in the next
          <input
            inputMode="decimal"
            value={definition.outcomeWindow ?? 12}
            onChange={(event) => {
              const value = numberOrNull(event.target.value);
              setDefinition((current) => ({ ...current, outcomeWindow: value ?? 12 }));
            }}
            className="w-16 border border-line px-2 py-1 font-mono"
          />
          seconds
        </label>
        <p className="text-sm text-muted">
          A blank gap between steps is 20 seconds. “The next one” means a different touch in between breaks the
          chain. A condition can read this player, you, a teammate, or an opponent at that same moment. Thirds are
          from that car’s own goal, so their offensive third is the opponents’ third.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {save && id ? (
            <form action={save}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="name" value={name} />
              <input type="hidden" name="definition" value={JSON.stringify(definition)} />
              <button type="submit" className="bg-gold px-3 py-2 text-bg">
                Save
              </button>
            </form>
          ) : null}
          {games ? null : (
            <button type="button" className="border border-line px-3 py-2" onClick={run} disabled={pending}>
              {pending ? "Running" : "Run"}
            </button>
          )}
          {remove && id ? (
            <form action={remove}>
              <input type="hidden" name="id" value={id} />
              <button type="submit" className="text-sm text-muted">
                Delete
              </button>
            </form>
          ) : null}
          {saved ? <span className="text-sm text-win">Saved.</span> : null}
          {dirty && !games ? <span className="text-sm text-muted">Run again to use this draft.</span> : null}
        </div>
        {error ? <p className="text-sm text-loss">{error}</p> : null}
        {runError ? <p className="text-sm text-loss">{runError}</p> : null}
      </div>

      <ScenarioResults report={live} sample={Boolean(games)} />
    </div>
  );
}

function ScenarioResults({ report, sample }: { report: ScenarioReport | null; sample: boolean }) {
  if (!report) {
    return (
      <section className="border border-line bg-panel p-4">
        <h2 className="text-lg tracking-tight">No run yet</h2>
        <p className="mt-2 text-sm text-muted">Save or run the chain against your doubles.</p>
      </section>
    );
  }
  const noun = report.occurrences === 1 ? "time" : "times";
  return (
    <section className="border border-line bg-panel p-4">
      <p className="font-mono text-xs tracking-[0.18em] text-muted uppercase">
        {sample ? "Sample game" : "Your games"}
      </p>
      <h2 className="mt-2 text-4xl tracking-tight">{report.occurrences}</h2>
      <p className="mt-1 text-sm text-muted">
        {noun} across {report.gamesHit} of {report.tracked} games
        {report.tracked ? ` · ${report.perGame} per game` : ""}
      </p>
      <p className="mt-3 font-mono text-sm">
        <span className="text-win">{report.hitsInWins} in wins</span>
        <span className="text-muted"> · </span>
        <span className="text-loss">{report.hitsInLosses} in losses</span>
      </p>
      <div className="mt-5 space-y-4">
        {report.outcomes.map((board) => (
          <div key={board.id}>
            <h3 className="text-sm tracking-tight">{board.title}</h3>
            {board.note ? <p className="mt-1 text-sm text-muted">{board.note}</p> : null}
            <ul className="mt-2 space-y-1">
              {board.slices.map((slice) => {
                const share = report.occurrences ? Math.round((slice.count / report.occurrences) * 100) : 0;
                return (
                  <li key={slice.id} className="text-sm">
                    <span className="flex items-baseline justify-between gap-3">
                      <span>{slice.label}</span>
                      <span className="font-mono text-xs text-muted">
                        {slice.count} · {share}%
                      </span>
                    </span>
                    <span className="mt-1 block h-1 bg-line">
                      <span className="block h-1 bg-gold" style={{ width: `${share}%` }} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {report.stale > 0 ? (
        <p className="mt-4 text-sm">
          {report.stale} {report.stale === 1 ? "replay was" : "replays were"} saved before event tracking. Run{" "}
          <code className="font-mono text-gold">npm run helper -- scan --force</code> once to rebuild them.
        </p>
      ) : null}
      {report.tracked === 0 ? (
        <p className="mt-4 text-sm text-muted">
          No event log yet. The helper writes one while it parses. Re-scan older replays with{" "}
          <code className="font-mono text-gold">--force</code>.
        </p>
      ) : null}
      <ul className="mt-4 space-y-3">
        {report.hits.map((hit, index) => (
          <li key={`${hit.replayId}-${hit.start}-${index}`} className="border-t border-line pt-3 text-sm">
            <p className="font-mono text-xs text-muted">
              {hit.won === true ? "Win" : hit.won === false ? "Loss" : "Game"}
              {hit.ours != null && hit.theirs != null ? ` ${hit.ours}–${hit.theirs}` : ""} · {hit.map}
            </p>
            {sample ? (
              <p className="mt-1">{hit.text}</p>
            ) : (
              <Link href={`/replays/${hit.replayId}`} className="mt-1 block">
                {hit.text}
              </Link>
            )}
            <p className="mt-1 text-muted">{hit.nextTouchText}</p>
            <p className="text-muted">{hit.nextGoalSoonText}</p>
            <p className="text-muted">{hit.nextGoalText}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="border border-line px-2 py-1">
      {options.map(([id, label]) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </select>
  );
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
