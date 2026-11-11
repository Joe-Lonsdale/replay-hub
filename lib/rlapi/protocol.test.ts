import assert from "node:assert/strict";
import test from "node:test";
import { buildPsyNetMessage, decodeBuildId, parsePsyNetMessage, playerId } from "./protocol";

test("builds and parses PsyNet websocket messages", () => {
  const message = buildPsyNetMessage({ PsyService: "Matches/GetMatchHistory v1", PsyRequestID: "PsyNetMessage_X_1" }, {
    PlayerID: "Epic|abc|0",
  });

  assert.match(message, /PsyService: Matches\/GetMatchHistory v1\r\n/);
  assert.match(message, /PsySig: /);
  assert.match(message, /\r\n\r\n{"PlayerID":"Epic\|abc\|0"}$/);

  const parsed = parsePsyNetMessage<{ Matches: unknown[] }>(
    'PsyResponseID: PsyNetMessage_X_1\r\n\r\n{"Result":{"Matches":[]}}',
  );
  assert.equal(parsed.responseId, "PsyNetMessage_X_1");
  assert.deepEqual(parsed.body.Result, { Matches: [] });
});

test("formats player ids and decodes build ids", () => {
  assert.equal(playerId("Steam", "76561197960287930"), "Steam|76561197960287930|0");
  assert.equal(decodeBuildId("261031.63733.533021"), "-242096153");
});
