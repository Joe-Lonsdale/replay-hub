import { TAG_DRILL, TAG_LABEL } from "./tags";
import type { DeepStats, GoalTag, StoredPlayer, StoredReplay } from "../replay/types";

export interface ReviewGame {
  id: string;
  replay: StoredReplay;
  userTeam: 0 | 1 | null;
  userWon: boolean | null;
  userName: string | null;
}

export interface WorkItem {
  id: string;
  title: string;
  why: string;
  drill: string;
  evidence: string;
  severity: number;
}

export interface Factor {
  id: string;
  label: string;
  count: number;
  share: number;
  detail: string;
}

export interface Comparison {
  label: string;
  wins: number | null;
  losses: number | null;
  unit: string;
  better: "higher" | "lower";
  note: string;
}

export interface SessionSummary {
  id: string;
  startedAt: string | null;
  endedAt: string | null;
  games: ReviewGame[];
  wins: number;
  losses: number;
  draws: number;
  goalsFor: number;
  goalsAgainst: number;
  leak: string | null;
}

export interface Report {
  games: ReviewGame[];
  matched: ReviewGame[];
  unmatched: number;
  sessions: SessionSummary[];
  latestSession: SessionSummary | null;
  wins: number;
  losses: number;
  draws: number;
  goalDifference: number;
  workOn: WorkItem[];
  lossFactors: Factor[];
  goalFactors: Factor[];
  concedeFactors: Factor[];
  comparisons: Comparison[];
  headline: string;
  subhead: string;
  frameGames: number;
}

const SESSION_GAP_MS = 25 * 60 * 1000;

export function identifyUser(
  replay: StoredReplay,
  steamId: string,
  rlName: string | null,
): { team: 0 | 1 | null; name: string | null } {
  const humans = replay.players.filter((player) => !player.bot);
  const byId = humans.find((player) => player.onlineId === steamId);
  if (byId) return { team: byId.team, name: byId.name };
  const target = rlName?.trim().toLowerCase();
  if (target) {
    const byName = humans.filter((player) => player.name.toLowerCase() === target);
    if (byName.length === 1) return { team: byName[0].team, name: byName[0].name };
  }
  return { team: null, name: null };
}

export function attachIdentity(
  id: string,
  replay: StoredReplay,
  steamId: string,
  rlName: string | null,
): ReviewGame {
  const identity = identifyUser(replay, steamId, rlName);
  if (identity.team == null) {
    return { id, replay, userTeam: null, userWon: null, userName: null };
  }
  const ours = identity.team === 0 ? replay.team0Score : replay.team1Score;
  const theirs = identity.team === 0 ? replay.team1Score : replay.team0Score;
  return {
    id,
    replay,
    userTeam: identity.team,
    userWon: ours === theirs ? null : ours > theirs,
    userName: identity.name,
  };
}

export function buildReport(games: ReviewGame[]): Report {
  const ordered = [...games].sort(byPlayedAt);
  const matched = ordered.filter((game) => game.userTeam != null && game.replay.countable);
  const unmatched = ordered.filter((game) => game.userTeam == null).length;
  const sessions = groupSessions(matched);
  const wins = matched.filter((game) => game.userWon === true);
  const losses = matched.filter((game) => game.userWon === false);
  const draws = matched.filter((game) => game.userWon == null);
  const goalDifference = matched.reduce((sum, game) => sum + goalDiff(game), 0);
  const conceded = goalsAgainst(matched);
  const scored = goalsFor(matched);
  const workOn = workItems(matched, wins, losses, conceded);
  const frameGames = matched.filter((game) => game.replay.depth === "frames").length;
  const headline = workOn[0]?.title ?? recordLine(wins.length, losses.length, matched.length, goalDifference);
  const subhead = workOn[0]?.evidence ?? sampleLine(matched.length, frameGames);

  return {
    games: [...ordered].sort((a, b) => -byPlayedAt(a, b)),
    matched,
    unmatched,
    sessions,
    latestSession: sessions[0] ?? null,
    wins: wins.length,
    losses: losses.length,
    draws: draws.length,
    goalDifference,
    workOn,
    lossFactors: lossFactors(wins, losses),
    goalFactors: tagFactors(scored, "of your goals"),
    concedeFactors: tagFactors(conceded, "of goals against"),
    comparisons: comparisons(wins, losses),
    headline,
    subhead,
    frameGames,
  };
}

function workItems(
  matched: ReviewGame[],
  wins: ReviewGame[],
  losses: ReviewGame[],
  conceded: ReturnType<typeof goalsAgainst>,
): WorkItem[] {
  const items: WorkItem[] = [];
  const lossCount = Math.max(losses.length, 1);
  if (conceded.length) {
    const counts = countTags(conceded);
    for (const [tag, count] of counts) {
      const copy = TAG_DRILL[tag];
      const share = count / conceded.length;
      const perLoss = count / lossCount;
      if (share < 0.18 && count < 2) continue;
      items.push({
        id: tag,
        title: copy.title,
        why: copy.why,
        drill: copy.drill,
        evidence: `${count} of ${conceded.length} goals against · ${perLoss.toFixed(1)} per loss`,
        severity: Math.round(share * 100 * copy.weight),
      });
    }
  }

  const shooting = averageStat(losses, userShooting) - averageStat(wins, userShooting);
  if (losses.length >= 2 && wins.length >= 2 && shooting <= -8) {
    items.push({
      id: "shooting",
      title: "Losses have a worse shooting percentage",
      why: "The shot count is there. The goals are not. At this rank that is usually a shot into the defender.",
      drill: "If the defender is in net, take the 50 or pass it back to the player behind you. A shot on target that they save for free is a counter.",
      evidence: `${Math.round(averageStat(losses, userShooting))}% in losses, ${Math.round(averageStat(wins, userShooting))}% in wins`,
      severity: Math.min(80, Math.round(Math.abs(shooting) * 1.4)),
    });
  }

  const saveGap = averageStat(wins, userSaves) - averageStat(losses, userSaves);
  if (losses.length >= 2 && wins.length >= 2 && saveGap >= 0.8) {
    items.push({
      id: "saves",
      title: "Saves disappear in losses",
      why: "You are getting to fewer balls as last man in the games you lose. The challenge is late.",
      drill: "Start the shadow earlier and challenge later. A save from the goal line is the backup, not the plan.",
      evidence: `${averageStat(losses, userSaves).toFixed(1)} saves in losses, ${averageStat(wins, userSaves).toFixed(1)} in wins`,
      severity: Math.min(75, Math.round(saveGap * 18)),
    });
  }

  const oneGoalLosses = losses.filter((game) => Math.abs(goalDiff(game)) === 1).length;
  if (losses.length >= 3 && oneGoalLosses / losses.length >= 0.5) {
    items.push({
      id: "one-goal",
      title: "These losses are one-goal games",
      why: "The lobby is even. One decision per game is the difference between GC3 and SSL.",
      drill: "Review only the first goal against in each of these. Ignore the rest of the replay until that touch is obvious.",
      evidence: `${oneGoalLosses} of ${losses.length} losses were by one goal`,
      severity: Math.round((oneGoalLosses / losses.length) * 70),
    });
  }

  const firstAgainst = matched.filter((game) => firstGoalAgainst(game));
  const firstThenLoss = firstAgainst.filter((game) => game.userWon === false).length;
  if (firstAgainst.length >= 3 && firstThenLoss / firstAgainst.length >= 0.65) {
    items.push({
      id: "first-goal",
      title: "Conceding first is costing the game",
      why: "Once they have the lead, the replay turns into forced challenges.",
      drill: "The first minute is the whole review. Play the first possession for a controlled 50, not a shot.",
      evidence: `${firstThenLoss} of ${firstAgainst.length} games where they scored first became losses`,
      severity: Math.round((firstThenLoss / firstAgainst.length) * 68),
    });
  }

  const zeroGap = averageDeep(losses, (deep) => deep.timeZeroBoost) - averageDeep(wins, (deep) => deep.timeZeroBoost);
  if (zeroGap >= 8) {
    items.push({
      id: "zero-boost",
      title: "Losses are played on empty",
      why: "You are arriving at the challenge without a flip.",
      drill: "Path over two small pads on every rotation back. Steal their mid boost only when you are second man and the ball is dead.",
      evidence: `${Math.round(averageDeep(losses, (deep) => deep.timeZeroBoost))}s on zero boost in losses, ${Math.round(averageDeep(wins, (deep) => deep.timeZeroBoost))}s in wins`,
      severity: Math.min(78, Math.round(zeroGap * 1.6)),
    });
  }

  const thirdGap =
    averageDeep(losses, (deep) => deep.percentOffensiveThird) -
    averageDeep(wins, (deep) => deep.percentOffensiveThird);
  if (thirdGap >= 8) {
    items.push({
      id: "third",
      title: "Losses spend longer in their half",
      why: "The extra time upfield is the overstay, not extra pressure.",
      drill: "Leave their half while the ball is still live. The rotation starts before the clear.",
      evidence: `${Math.round(averageDeep(losses, (deep) => deep.percentOffensiveThird))}% of the loss spent in their third, ${Math.round(averageDeep(wins, (deep) => deep.percentOffensiveThird))}% in wins`,
      severity: Math.min(76, Math.round(thirdGap * 2)),
    });
  }

  return items.sort((a, b) => b.severity - a.severity);
}

function lossFactors(wins: ReviewGame[], losses: ReviewGame[]): Factor[] {
  const factors: Factor[] = [];
  const lossGoals = goalsAgainst(losses);
  const winGoals = goalsAgainst(wins);
  const lossTags = countTags(lossGoals);
  const winTags = countTags(winGoals);
  const tags = new Set<GoalTag>([...lossTags.keys(), ...winTags.keys()]);
  for (const tag of tags) {
    const perLoss = (lossTags.get(tag) ?? 0) / Math.max(losses.length, 1);
    const perWin = (winTags.get(tag) ?? 0) / Math.max(wins.length, 1);
    if (perLoss < 0.15 || perLoss < perWin + 0.1) continue;
    factors.push({
      id: `tag-${tag}`,
      label: TAG_LABEL[tag],
      count: lossTags.get(tag) ?? 0,
      share: perLoss,
      detail: `${perLoss.toFixed(1)} per loss · ${perWin.toFixed(1)} per win`,
    });
  }

  pushStatFactor(factors, wins, losses, "Saves", userSaves, "lower", "saves a game");
  pushStatFactor(factors, wins, losses, "Shots", userShots, "lower", "shots a game");
  pushStatFactor(factors, wins, losses, "Shooting", userShooting, "lower", "%");
  return factors.sort((a, b) => b.share - a.share).slice(0, 6);
}

function pushStatFactor(
  factors: Factor[],
  wins: ReviewGame[],
  losses: ReviewGame[],
  label: string,
  read: (game: ReviewGame) => number | null,
  direction: "lower" | "higher",
  unit: string,
): void {
  if (wins.length < 2 || losses.length < 2) return;
  const winAvg = averageStat(wins, read);
  const lossAvg = averageStat(losses, read);
  const gap = direction === "lower" ? winAvg - lossAvg : lossAvg - winAvg;
  const threshold = unit === "%" ? 8 : 0.8;
  if (gap < threshold) return;
  factors.push({
    id: `stat-${label}`,
    label: `${label} drop in losses`,
    count: losses.length,
    share: gap,
    detail: `${lossAvg.toFixed(1)} ${unit} in losses · ${winAvg.toFixed(1)} in wins`,
  });
}

function tagFactors(goals: { tags: GoalTag[] }[], suffix: string): Factor[] {
  if (!goals.length) return [];
  const counts = countTags(goals);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag, count]) => ({
      id: tag,
      label: TAG_LABEL[tag],
      count,
      share: count / goals.length,
      detail: `${count} ${suffix} (${Math.round((count / goals.length) * 100)}%)`,
    }));
}

function comparisons(wins: ReviewGame[], losses: ReviewGame[]): Comparison[] {
  const rows = [
    comparison("Shots", wins, losses, userShots, "", "higher"),
    comparison("Saves", wins, losses, userSaves, "", "higher"),
    comparison("Shooting", wins, losses, userShooting, "%", "higher"),
    comparison("Score", wins, losses, userScore, "", "higher"),
    comparison("Assists", wins, losses, userAssists, "", "higher"),
  ];
  const deepRows = [
    deepComparison("Time on zero boost", wins, losses, (deep) => deep.timeZeroBoost, "s", "lower"),
    deepComparison("Supersonic", wins, losses, (deep) => deep.percentSupersonic, "%", "higher"),
    deepComparison("Time in their third", wins, losses, (deep) => deep.percentOffensiveThird, "%", "lower"),
    deepComparison("Time behind the ball", wins, losses, (deep) => deep.percentBehindBall, "%", "higher"),
    deepComparison("Boost stolen", wins, losses, (deep) => deep.boostStolen, "", "higher"),
    deepComparison("Demos taken", wins, losses, (deep) => deep.demosTaken, "", "lower"),
  ];
  return [...rows, ...deepRows].filter((row): row is Comparison => row != null);
}

function comparison(
  label: string,
  wins: ReviewGame[],
  losses: ReviewGame[],
  read: (game: ReviewGame) => number | null,
  unit: string,
  better: "higher" | "lower",
): Comparison | null {
  if (!wins.length && !losses.length) return null;
  const winAvg = wins.length ? averageStat(wins, read) : null;
  const lossAvg = losses.length ? averageStat(losses, read) : null;
  return {
    label,
    wins: winAvg,
    losses: lossAvg,
    unit,
    better,
    note: noteFor(winAvg, lossAvg, better),
  };
}

function deepComparison(
  label: string,
  wins: ReviewGame[],
  losses: ReviewGame[],
  read: (deep: DeepStats) => number,
  unit: string,
  better: "higher" | "lower",
): Comparison | null {
  const winValues = deepValues(wins, read);
  const lossValues = deepValues(losses, read);
  if (!winValues.length && !lossValues.length) return null;
  const winAvg = winValues.length ? mean(winValues) : null;
  const lossAvg = lossValues.length ? mean(lossValues) : null;
  return { label, wins: winAvg, losses: lossAvg, unit, better, note: noteFor(winAvg, lossAvg, better) };
}

function noteFor(wins: number | null, losses: number | null, better: "higher" | "lower"): string {
  if (wins == null || losses == null) return "Need both wins and losses";
  const delta = wins - losses;
  if (Math.abs(delta) < 0.4) return "About the same";
  const lossesWorse = better === "higher" ? delta > 0 : delta < 0;
  return lossesWorse ? "Worse in losses" : "Not the leak";
}

function groupSessions(games: ReviewGame[]): SessionSummary[] {
  const sessions: ReviewGame[][] = [];
  for (const game of games) {
    const current = sessions[sessions.length - 1];
    const previous = current?.[current.length - 1];
    const gap = stamp(game) - stamp(previous);
    if (!current || (previous?.replay.playedAt && game.replay.playedAt && gap > SESSION_GAP_MS)) {
      sessions.push([game]);
    } else {
      current.push(game);
    }
  }
  return sessions
    .map((group, index) => {
      const wins = group.filter((game) => game.userWon === true).length;
      const losses = group.filter((game) => game.userWon === false).length;
      const draws = group.filter((game) => game.userWon == null).length;
      const conceded = goalsAgainst(group);
      const top = [...countTags(conceded).entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        id: `session-${index}`,
        startedAt: group[0]?.replay.playedAt ?? null,
        endedAt: group[group.length - 1]?.replay.playedAt ?? null,
        games: group,
        wins,
        losses,
        draws,
        goalsFor: group.reduce((sum, game) => sum + goalsForTeam(game), 0),
        goalsAgainst: group.reduce((sum, game) => sum + goalsAgainstTeam(game), 0),
        leak: top && top[1] >= 2 ? TAG_LABEL[top[0]] : null,
      };
    })
    .sort((a, b) => stampOf(b.endedAt) - stampOf(a.endedAt));
}

function goalsFor(games: ReviewGame[]): { tags: GoalTag[] }[] {
  return games.flatMap((game) =>
    game.userTeam == null ? [] : game.replay.goals.filter((goal) => goal.team === game.userTeam),
  );
}

function goalsAgainst(games: ReviewGame[]): { tags: GoalTag[] }[] {
  return games.flatMap((game) =>
    game.userTeam == null ? [] : game.replay.goals.filter((goal) => goal.team !== game.userTeam),
  );
}

function countTags(goals: { tags: GoalTag[] }[]): Map<GoalTag, number> {
  const counts = new Map<GoalTag, number>();
  for (const goal of goals) {
    for (const tag of goal.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return counts;
}

function userPlayer(game: ReviewGame): StoredPlayer | null {
  if (!game.userName) return null;
  return game.replay.players.find((player) => player.name === game.userName) ?? null;
}

function userShooting(game: ReviewGame): number | null {
  return userPlayer(game)?.shootingPct ?? null;
}

function userSaves(game: ReviewGame): number | null {
  return userPlayer(game)?.saves ?? null;
}

function userShots(game: ReviewGame): number | null {
  return userPlayer(game)?.shots ?? null;
}

function userScore(game: ReviewGame): number | null {
  return userPlayer(game)?.score ?? null;
}

function userAssists(game: ReviewGame): number | null {
  return userPlayer(game)?.assists ?? null;
}

function averageStat(games: ReviewGame[], read: (game: ReviewGame) => number | null): number {
  const values = games.map(read).filter((value): value is number => value != null);
  return values.length ? mean(values) : 0;
}

function averageDeep(games: ReviewGame[], read: (deep: DeepStats) => number): number {
  return mean(deepValues(games, read));
}

function deepValues(games: ReviewGame[], read: (deep: DeepStats) => number): number[] {
  return games
    .map((game) => userPlayer(game)?.deep)
    .filter((deep): deep is DeepStats => deep != null)
    .map(read);
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function goalDiff(game: ReviewGame): number {
  return goalsForTeam(game) - goalsAgainstTeam(game);
}

function goalsForTeam(game: ReviewGame): number {
  if (game.userTeam == null) return 0;
  return game.userTeam === 0 ? game.replay.team0Score : game.replay.team1Score;
}

function goalsAgainstTeam(game: ReviewGame): number {
  if (game.userTeam == null) return 0;
  return game.userTeam === 0 ? game.replay.team1Score : game.replay.team0Score;
}

function firstGoalAgainst(game: ReviewGame): boolean {
  if (game.userTeam == null) return false;
  const first = [...game.replay.goals].sort((a, b) => a.time - b.time)[0];
  return Boolean(first && first.team !== game.userTeam);
}

function byPlayedAt(a: ReviewGame, b: ReviewGame): number {
  return stamp(a) - stamp(b);
}

function stamp(game: ReviewGame | undefined): number {
  return stampOf(game?.replay.playedAt ?? null);
}

function stampOf(value: string | null): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function recordLine(wins: number, losses: number, games: number, goalDifference: number): string {
  if (!games) return "Upload a replay to see where the goals are coming from.";
  const diff = `${goalDifference >= 0 ? "+" : ""}${goalDifference}`;
  return `${wins}–${losses} across ${games} doubles, ${diff} goal difference.`;
}

function sampleLine(games: number, frameGames: number): string {
  if (!games) return "The helper watches the Rocket League demos folder and sends each game up when it ends.";
  if (games < 5) return "Small sample. One more session will make the pattern trustworthy.";
  if (frameGames === 0) {
    return "These reads are from the scoreboard and the clock. Frame parsing adds boost, rotation, and why each goal went in.";
  }
  return `${frameGames} of ${games} games include boost and positioning.`;
}
