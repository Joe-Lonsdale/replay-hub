import type { FilterOp, FilterWho, ScenarioActor, ScenarioDefinition, ScenarioFilter, ScenarioStep } from "./types";

export const DEFAULT_OUTCOME_WINDOW = 12;

export const FILTER_WHOS: { id: FilterWho; label: string }[] = [
  { id: "actor", label: "This player" },
  { id: "me", label: "You" },
  { id: "teammate", label: "A teammate" },
  { id: "opponent", label: "An opponent" },
];

export interface EventKind {
  id: string;
  label: string;
  group: string;
  hint: string;
}

export const EVENT_KINDS: EventKind[] = [
  { id: "touch", label: "Touch", group: "Ball", hint: "A contact that changes the ball" },
  { id: "fifty", label: "50", group: "Ball", hint: "You and an opponent both on the ball" },
  { id: "shot", label: "Shot", group: "Ball", hint: "A touch aimed at the opponent goal" },
  { id: "save", label: "Save", group: "Ball", hint: "A touch that turns the ball away from your net" },
  { id: "clear", label: "Clear", group: "Ball", hint: "A touch out of your third toward their half" },
  { id: "center", label: "Center", group: "Ball", hint: "A touch from wide toward the middle" },
  { id: "pass", label: "Pass", group: "Ball", hint: "Your touch, then a teammate's" },
  { id: "aerial", label: "Aerial touch", group: "Ball", hint: "A touch off the ground" },
  { id: "dribble", label: "Dribble", group: "Ball", hint: "The ball stays on the car" },
  { id: "kickoff", label: "Kickoff touch", group: "Ball", hint: "The first touch of a kickoff" },
  { id: "possession", label: "Possession gain", group: "Ball", hint: "Your side becomes the last team to touch it" },
  { id: "commit", label: "Commit", group: "Decisions", hint: "A run onto the ball" },
  { id: "last_man_commit", label: "Last man commit", group: "Decisions", hint: "The last player back runs onto the ball" },
  { id: "double_commit", label: "Double commit", group: "Decisions", hint: "You and your teammate both go" },
  { id: "whiff", label: "Whiff", group: "Decisions", hint: "A run onto the ball that never touches it" },
  { id: "big_pad", label: "Big pad", group: "Boost", hint: "A 100 boost pickup" },
  { id: "small_pad", label: "Small pad", group: "Boost", hint: "A small pad pickup" },
  { id: "boost_steal", label: "Stolen boost", group: "Boost", hint: "A pad taken in the opponent half" },
  { id: "zero_boost", label: "Hit zero boost", group: "Boost", hint: "The tank empties" },
  { id: "supersonic", label: "Reach supersonic", group: "Boost", hint: "Car speed crosses 2200" },
  { id: "goal", label: "Goal", group: "Score", hint: "The ball goes in" },
  { id: "demo", label: "Demo", group: "Score", hint: "You demolish someone" },
  { id: "demoed", label: "Get demoed", group: "Score", hint: "You get demolished" },
];

export const ACTORS: { id: ScenarioActor; label: string }[] = [
  { id: "me", label: "You" },
  { id: "teammate", label: "Teammate" },
  { id: "us", label: "Your team" },
  { id: "opponent", label: "Opponents" },
  { id: "anyone", label: "Anyone" },
];

export interface FieldSpec {
  id: string;
  label: string;
  kind: "number" | "enum";
  unit?: string;
  options?: string[];
  hint?: string;
}

export const FIELDS: FieldSpec[] = [
  { id: "boost", label: "Boost", kind: "number", unit: "%" },
  { id: "speed", label: "Car speed", kind: "number", unit: "uu/s" },
  { id: "ballSpeed", label: "Ball speed", kind: "number", unit: "uu/s" },
  { id: "height", label: "Car height", kind: "number", unit: "uu" },
  { id: "ballHeight", label: "Ball height", kind: "number", unit: "uu" },
  { id: "distBall", label: "Distance to ball", kind: "number", unit: "uu" },
  { id: "clock", label: "Time left", kind: "number", unit: "s" },
  { id: "time", label: "Match time", kind: "number", unit: "s" },
  { id: "scoreDiff", label: "Score difference", kind: "number", hint: "Your goals minus theirs, before this event" },
  { id: "third", label: "Third", kind: "enum", options: ["defensive", "neutral", "offensive"] },
  { id: "half", label: "Half", kind: "enum", options: ["own", "their"] },
  { id: "air", label: "Air or ground", kind: "enum", options: ["air", "ground"] },
  { id: "lastMan", label: "Last man", kind: "enum", options: ["yes", "no"] },
];

const NUMBER_OPS: { id: FilterOp; label: string }[] = [
  { id: "lt", label: "under" },
  { id: "lte", label: "at most" },
  { id: "gt", label: "over" },
  { id: "gte", label: "at least" },
  { id: "eq", label: "exactly" },
  { id: "neq", label: "not" },
];

const ENUM_OPS: { id: FilterOp; label: string }[] = [
  { id: "eq", label: "is" },
  { id: "neq", label: "is not" },
];

export function opsFor(fieldId: string): { id: FilterOp; label: string }[] {
  const field = FIELDS.find((item) => item.id === fieldId);
  return field?.kind === "enum" ? ENUM_OPS : NUMBER_OPS;
}

export interface ScenarioPreset {
  id: string;
  name: string;
  blurb: string;
  definition: ScenarioDefinition;
}

function step(
  actor: ScenarioActor,
  kind: string,
  extra?: Partial<Pick<ScenarioStep, "filters" | "within" | "after" | "next">>,
): ScenarioStep {
  return {
    actor,
    kind,
    filters: extra?.filters ?? [],
    within: extra?.within ?? null,
    after: extra?.after ?? null,
    next: extra?.next ?? false,
  };
}

export const PRESETS: ScenarioPreset[] = [
  {
    id: "giveaway",
    name: "Touch, they touch, they score",
    blurb: "You touch it, the next touch is theirs inside a short window, and the goal follows.",
    definition: {
      steps: [
        step("me", "touch"),
        step("opponent", "touch", { within: 1.5, next: true }),
        step("opponent", "goal", { within: 12 }),
      ],
    },
  },
  {
    id: "lost-fifty",
    name: "You take a 50",
    blurb: "Every 50 you take. The outcomes show who touches the ball next, and which team scores next.",
    definition: {
      steps: [step("me", "fifty")],
      outcomeWindow: 12,
    },
  },
  {
    id: "low-commit",
    name: "Low boost commit",
    blurb: "You commit under 20 boost in their third. The outcomes show how often they score from it.",
    definition: {
      steps: [
        step("me", "commit", {
          filters: [
            { field: "boost", op: "lt", value: 20 },
            { field: "third", op: "eq", value: "offensive" },
          ],
        }),
      ],
      outcomeWindow: 12,
    },
  },
  {
    id: "last-man",
    name: "Last man goes",
    blurb: "The last player back challenges and the goal follows.",
    definition: {
      steps: [step("me", "last_man_commit"), step("opponent", "goal", { within: 10 })],
    },
  },
  {
    id: "pass-shot",
    name: "Pass into a shot",
    blurb: "You pass and a teammate shoots it.",
    definition: {
      steps: [step("me", "pass"), step("teammate", "shot", { within: 4 })],
    },
  },
  {
    id: "empty-tank",
    name: "Empty tank, their shot",
    blurb: "You hit zero boost and they shoot within a few seconds.",
    definition: {
      steps: [step("me", "zero_boost"), step("opponent", "shot", { within: 6 })],
    },
  },
  {
    id: "demo-goal",
    name: "Demo into a goal",
    blurb: "You demo someone and your team scores off it.",
    definition: {
      steps: [step("me", "demo"), step("us", "goal", { within: 8 })],
    },
  },
  {
    id: "home-fifty",
    name: "Mate 50 while you're home",
    blurb: "You are in your third and your teammate takes a 50 in their third. The outcomes show the next touch and the next goal.",
    definition: {
      steps: [
        step("teammate", "fifty", {
          filters: [
            { field: "third", op: "eq", value: "defensive", who: "me" },
            { field: "third", op: "eq", value: "offensive", who: "actor" },
          ],
        }),
      ],
      outcomeWindow: 12,
    },
  },
  {
    id: "kickoff-against",
    name: "Kickoff goal against",
    blurb: "A kickoff touch, then they score before the play resets.",
    definition: {
      steps: [step("anyone", "kickoff"), step("opponent", "goal", { within: 12 })],
    },
  },
];

export function blankStep(actor: ScenarioActor = "me", kind = "touch"): ScenarioStep {
  return step(actor, kind);
}

export function blankScenario(): ScenarioDefinition {
  return { steps: [blankStep()], outcomeWindow: DEFAULT_OUTCOME_WINDOW };
}

export function outcomeWindowOf(definition: ScenarioDefinition): number {
  const value = definition.outcomeWindow;
  if (value == null || !Number.isFinite(value)) return DEFAULT_OUTCOME_WINDOW;
  return Math.min(120, Math.max(1, value));
}

export function eventLabel(kind: string): string {
  return EVENT_KINDS.find((item) => item.id === kind)?.label ?? kind;
}

export function actorLabel(actor: ScenarioActor): string {
  return ACTORS.find((item) => item.id === actor)?.label ?? actor;
}

export function fieldSpec(id: string): FieldSpec | undefined {
  return FIELDS.find((item) => item.id === id);
}

export function describeFilter(filter: ScenarioFilter): string {
  const field = fieldSpec(filter.field);
  if (!field) return "";
  if (field.kind === "enum") {
    if (filter.field === "third") return thirdPhrase(filter);
    if (filter.field === "half") {
      return filter.op === "neq" ? `not in ${filter.value} half` : `in ${filter.value} half`;
    }
    if (filter.field === "lastMan") {
      const yes = filter.value === "yes";
      if (filter.op === "neq") return yes ? "not as last man" : "as last man";
      return yes ? "as last man" : "not last man";
    }
    if (filter.field === "air") {
      const air = filter.value === "air";
      if (filter.op === "neq") return air ? "on the ground" : "in the air";
      return air ? "in the air" : "on the ground";
    }
  }
  const symbol: Record<FilterOp, string> = {
    lt: "<",
    lte: "≤",
    gt: ">",
    gte: "≥",
    eq: "=",
    neq: "≠",
  };
  const unit = field.unit ? ` ${field.unit}` : "";
  return `${whoPrefix(filter.who)}${field.label.toLowerCase()} ${symbol[filter.op]} ${filter.value}${unit}`;
}

function thirdPhrase(filter: ScenarioFilter): string {
  const value = String(filter.value);
  const who = filter.who ?? "actor";
  const phrases: Record<string, [string, string, string]> = {
    me: ["you in your third", "you in midfield", "you in their third"],
    teammate: ["a teammate in your third", "a teammate in midfield", "a teammate in their third"],
    opponent: ["an opponent in their own third", "an opponent in midfield", "an opponent in your third"],
    actor: ["in their own third", "in midfield", "in the opponents' third"],
  };
  const index = value === "defensive" ? 0 : value === "neutral" ? 1 : 2;
  const sentence = (phrases[who] ?? phrases.actor)[index];
  return filter.op === "neq" ? `not ${sentence}` : sentence;
}

function whoPrefix(who: FilterWho | undefined): string {
  if (!who || who === "actor") return "";
  if (who === "me") return "you, ";
  if (who === "teammate") return "a teammate, ";
  return "an opponent, ";
}

export function describeStep(scenarioStep: ScenarioStep, index: number): string {
  const facts = scenarioStep.filters.map(describeFilter).filter(Boolean);
  const body = [actorLabel(scenarioStep.actor), eventLabel(scenarioStep.kind).toLowerCase(), ...facts].join(", ");
  if (index === 0) return body;
  const link = [
    scenarioStep.next ? "the next one" : null,
    scenarioStep.within != null ? `within ${trimNumber(scenarioStep.within)}s` : null,
    scenarioStep.after != null ? `after ${trimNumber(scenarioStep.after)}s` : null,
  ].filter(Boolean);
  return link.length ? `${body} (${link.join(", ")})` : body;
}

export function describeScenario(definition: ScenarioDefinition): string {
  return definition.steps.map(describeStep).join(" → ");
}

export function parseDefinition(value: unknown): ScenarioDefinition | null {
  if (!value || typeof value !== "object") return null;
  const steps = (value as { steps?: unknown }).steps;
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 8) return null;
  const parsed: ScenarioStep[] = [];
  for (const stepValue of steps) {
    const next = parseStep(stepValue);
    if (!next) return null;
    parsed.push(next);
  }
  const outcomeWindow = parseWindow((value as { outcomeWindow?: unknown }).outcomeWindow);
  if (outcomeWindow === undefined) return null;
  return { steps: parsed, outcomeWindow: outcomeWindow ?? DEFAULT_OUTCOME_WINDOW };
}

function parseStep(value: unknown): ScenarioStep | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ScenarioStep>;
  if (!ACTORS.some((actor) => actor.id === raw.actor)) return null;
  if (!EVENT_KINDS.some((kind) => kind.id === raw.kind)) return null;
  if (!Array.isArray(raw.filters) || raw.filters.length > 8) return null;
  const filters: ScenarioFilter[] = [];
  for (const filter of raw.filters) {
    const parsed = parseFilter(filter);
    if (!parsed) return null;
    filters.push(parsed);
  }
  const within = parseGap(raw.within, 0.1, 90);
  const after = parseGap(raw.after, 0, 90);
  if (within === undefined || after === undefined) return null;
  return {
    actor: raw.actor as ScenarioActor,
    kind: raw.kind as string,
    filters,
    within,
    after,
    next: raw.next === true,
  };
}

function parseFilter(value: unknown): ScenarioFilter | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ScenarioFilter>;
  const field = fieldSpec(String(raw.field ?? ""));
  if (!field) return null;
  const ops = opsFor(field.id);
  if (!ops.some((op) => op.id === raw.op)) return null;
  const who = parseWho(raw.who);
  if (!who) return null;
  if (field.kind === "enum") {
    if (typeof raw.value !== "string" || !field.options?.includes(raw.value)) return null;
    return { field: field.id, op: raw.op as FilterOp, value: raw.value, who };
  }
  const numeric = typeof raw.value === "number" ? raw.value : Number(raw.value);
  if (!Number.isFinite(numeric) || Math.abs(numeric) > 100000) return null;
  return { field: field.id, op: raw.op as FilterOp, value: numeric, who };
}

function parseWho(value: unknown): FilterWho | null {
  if (value == null || value === "actor") return "actor";
  if (value === "me" || value === "teammate" || value === "opponent") return value;
  return null;
}

function parseWindow(value: unknown): number | null | undefined {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 1 || numeric > 120) return undefined;
  return numeric;
}

function parseGap(value: unknown, min: number, max: number): number | null | undefined {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) return undefined;
  return numeric;
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}
