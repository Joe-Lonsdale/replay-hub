import assert from "node:assert/strict";
import test from "node:test";
import { listenerBat } from "./listener-script";

test("the listener script embeds the site and token and watches the demos folder", () => {
  const script = listenerBat("https://replay-lab.example/", "rpl_abc-DEF_123");
  assert.match(script, /set "APP_URL=https:\/\/replay-lab\.example"/);
  assert.match(script, /set "TOKEN=rpl_abc-DEF_123"/);
  assert.match(script, /replay-lab-listener\.mjs" watch/);
  assert.match(script, /rl_replay_subtr_actor_bg\.wasm/);
  assert.equal(script.includes("\n"), true);
  assert.throws(() => listenerBat("https://replay-lab.example", "not-a-token"));
});
