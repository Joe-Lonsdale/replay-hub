import { TAG_LABEL } from "./coaching/tags";
import type { ReviewGame } from "./coaching/report";
import type { GoalTag, StoredGoal } from "./replay/types";

const QUIET: GoalTag[] = ["first_minute", "late_game", "overtime"];

export function formatWhen(iso: string | null): string {
  if (!iso) return "Unknown time";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatClock(goal: Pick<StoredGoal, "secondsRemaining" | "time">): string {
  if (goal.secondsRemaining == null) return formatElapsed(goal.time);
  if (goal.secondsRemaining <= 0) return `OT ${formatMmss(Math.abs(goal.secondsRemaining))}`;
  return formatMmss(goal.secondsRemaining);
}

export function formatElapsed(seconds: number): string {
  return formatMmss(seconds);
}

export function scoreline(game: ReviewGame): string {
  if (game.userTeam == null) return `${game.replay.team0Score}–${game.replay.team1Score}`;
  const ours = game.userTeam === 0 ? game.replay.team0Score : game.replay.team1Score;
  const theirs = game.userTeam === 0 ? game.replay.team1Score : game.replay.team0Score;
  return `${ours}–${theirs}`;
}

export function resultWord(game: ReviewGame): string {
  if (game.userTeam == null) return "Unmatched";
  if (game.userWon === true) return "Win";
  if (game.userWon === false) return "Loss";
  return "Draw";
}

export function gameLine(game: ReviewGame): string {
  if (game.userTeam == null) return "Set your in-game name to claim this replay";
  const against = game.replay.goals.filter((goal) => goal.team !== game.userTeam);
  const tag = against.flatMap((goal) => goal.tags).find((item) => !QUIET.includes(item));
  if (game.userWon === false) return tag ? TAG_LABEL[tag] : "No repeated cause in the goals";
  if (game.userWon === true) return tag ? `Won, and still conceded ${TAG_LABEL[tag].toLowerCase()}` : "Won";
  return "Draw";
}

export function explainGame(game: ReviewGame): string {
  if (game.userTeam == null) {
    return "Neither your Steam ID nor the name in Settings matches a player in this replay.";
  }
  const against = game.replay.goals.filter((goal) => goal.team !== game.userTeam);
  const scored = game.replay.goals.filter((goal) => goal.team === game.userTeam);
  if (game.userWon === false) {
    const tag = dominant(against);
    if (!against.length) return "The scoreboard is a loss, and this replay has no goal list.";
    if (!tag) return "You lost without one positional pattern repeating. Start with the first goal against.";
    return `You lost. ${against.length} ${against.length === 1 ? "goal" : "goals"} against, and the repeated read is ${TAG_LABEL[tag].toLowerCase()}.`;
  }
  if (game.userWon === true) {
    const leak = dominant(against);
    if (leak) return `You won, with ${against.length} against. ${TAG_LABEL[leak]} still showed up.`;
    return scored.length
      ? `You won. ${scored.length} ${scored.length === 1 ? "goal" : "goals"} for, and nothing in the goals against repeats.`
      : "You won.";
  }
  return "The game finished level.";
}

export function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function dominant(goals: { tags: GoalTag[] }[]): GoalTag | null {
  const counts = new Map<GoalTag, number>();
  for (const goal of goals) {
    for (const tag of goal.tags) {
      if (QUIET.includes(tag)) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function formatMmss(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  const remain = whole % 60;
  return `${minutes}:${remain.toString().padStart(2, "0")}`;
}
