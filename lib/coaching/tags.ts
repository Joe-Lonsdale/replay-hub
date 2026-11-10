import type { GoalTag } from "../replay/types";

export const TAG_LABEL: Record<GoalTag, string> = {
  kickoff: "Kickoff goal",
  open_net: "Open net",
  double_commit: "Double commit",
  last_man_out: "Last man past the ball",
  low_boost: "Low boost",
  counterattack: "Counterattack",
  overcommit: "Overcommit",
  late_game: "Last minute",
  first_minute: "First minute",
  overtime: "Overtime",
  demo: "Demo",
  fast_break: "Length of the field",
};

export const TAG_DRILL: Record<GoalTag, { title: string; why: string; drill: string; weight: number }> = {
  kickoff: {
    title: "Kickoffs are giving up goals",
    why: "A kickoff goal is a full possession handed over before either of you has touched a pad.",
    drill: "Pick one kickoff and one cheat rule before you queue. If the 50 is neutral, the cheater turns for corner boost instead of following the ball into their half.",
    weight: 1.15,
  },
  open_net: {
    title: "Goals are going into an empty net",
    why: "Both cars are on the wrong side of the ball when it goes in. At GC3 this is usually a late rotation, not a mechanical miss.",
    drill: "After the attack dies, one car is already on the way back. The last man does not cross midfield until the first man has turned.",
    weight: 1.25,
  },
  double_commit: {
    title: "Both of you are committing",
    why: "Two players on the same challenge leaves the net empty. This is the usual reason a GC3 lobby stays a GC3 lobby.",
    drill: "If your teammate is on the ball, you are at the back post or the mid boost. Second man stays goal-side of the first challenge.",
    weight: 1.35,
  },
  last_man_out: {
    title: "Last man is getting caught past the ball",
    why: "The last challenge is a 50/50 you do not have to take. Once you are past the ball, the next touch is a goal.",
    drill: "Shadow until you are favourite. If you are not, stay between the ball and the net and let them come to you.",
    weight: 1.25,
  },
  low_boost: {
    title: "You are defending on empty",
    why: "A last man with no boost has no flip to cover the second touch.",
    drill: "Take the small pads on the way back. Do not turn for a corner 100 while you are last man unless the ball is dead.",
    weight: 1,
  },
  counterattack: {
    title: "Their goals are counters off your attack",
    why: "The ball is leaving their half and both of you are still in it.",
    drill: "The player who is not touching the ball rotates before the shot. A miss should leave one car behind the ball.",
    weight: 1.15,
  },
  overcommit: {
    title: "Both cars are living in their half",
    why: "Two players in the offensive third is a gamble. SSL 2s leaves one car at mid boost.",
    drill: "Count the cars in their half. If you are the second one in, you are the one who leaves while the ball is still live.",
    weight: 1.1,
  },
  late_game: {
    title: "The last minute is leaking",
    why: "One-goal games are being decided by a forced touch after 4:00.",
    drill: "With the lead, only shoot a free ball. Level, the first man challenges and the second stays in net.",
    weight: 0.75,
  },
  first_minute: {
    title: "The opening minute is deciding games",
    why: "Conceding first in a GC3 lobby usually means chasing the game for the next four minutes.",
    drill: "Review the first goal of every loss before anything else. Don't force the first touch of the possession.",
    weight: 0.7,
  },
  overtime: {
    title: "Overtime is where the games are going",
    why: "Regulation is even. The loss is a single overtime decision.",
    drill: "In overtime, treat every touch as last man. No corner boost rotations, no double commits.",
    weight: 0.65,
  },
  demo: {
    title: "Demos are part of the goals against",
    why: "A demo on the last man in 2s is a goal unless the other car was already home.",
    drill: "If they are hunting demos, take a wider return and don't sit still on the back boost.",
    weight: 0.7,
  },
  fast_break: {
    title: "Goals are coming from end to end",
    why: "The clear or the 50 is leaving their half at full speed with both of you facing the wrong way.",
    drill: "On a dangerous 50, one car challenges and the other is already shadowing toward your goal.",
    weight: 0.85,
  },
};
