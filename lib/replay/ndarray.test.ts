import assert from "node:assert/strict";
import test from "node:test";
import { ndarrayToSamples } from "./ndarray";

test("converts normalized frame columns into field units and boost percent", () => {
  const global = [
    "Ball - position x",
    "Ball - position y",
    "Ball - position z",
    "seconds remaining",
    "current time",
    "kickoff countdown",
  ];
  const player = ["position x", "position y", "position z", "boost level (raw replay units)"];
  const row = [0, 0.5, 0.02, 240, 60, 0, -0.1, -0.5, 0.01, 255, 0.2, 0.4, 0.01, 0];
  const [sample] = ndarrayToSamples(
    {
      metadata: {
        replay_meta: {
          team_zero: [{ name: "Alpha" }],
          team_one: [{ name: "Bravo" }],
        },
        column_headers: { global_headers: global, player_headers: player },
      },
      array_data: [row],
    },
    [],
  );

  assert.equal(sample.time, 60);
  assert.equal(sample.secondsRemaining, 240);
  assert.equal(sample.ball.y, 0.5 * 5120);
  assert.equal(sample.players[0].name, "Alpha");
  assert.equal(sample.players[0].team, 0);
  assert.equal(sample.players[0].y, -0.5 * 5120);
  assert.equal(sample.players[0].boost, 100);
  assert.equal(sample.players[1].name, "Bravo");
  assert.equal(sample.players[1].boost, 0);
});
