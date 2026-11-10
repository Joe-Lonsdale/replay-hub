import assert from "node:assert/strict";
import test from "node:test";
import { parseReplayHeader } from "./header";

test("parses a doubles header into score, players, and goals", () => {
  const game = parseReplayHeader(sampleReplay());
  assert.equal(game.playlist, "doubles");
  assert.equal(game.mapLabel, "DFH Stadium");
  assert.equal(game.team0Score, 3);
  assert.equal(game.team1Score, 2);
  assert.equal(game.players.length, 2);
  assert.equal(game.players[0].name, "Alpha");
  assert.equal(game.players[0].onlineId, "76561198000000001");
  assert.equal(game.players[0].platform, "Steam");
  assert.equal(game.players[0].goals, 2);
  assert.equal(game.players[0].shots, 4);
  assert.equal(game.goals.length, 2);
  assert.equal(game.goals[0].scorer, "Alpha");
  assert.equal(game.goals[0].team, 0);
  assert.equal(game.recordFps, 30);
  assert.ok(game.playedAt);
});

function sampleReplay(): Buffer {
  const content = Buffer.concat([
    i32(868),
    i32(20),
    i32(10),
    text("TAGame.Replay_Soccar_TA"),
    propInt("TeamSize", 2),
    propInt("Team0Score", 3),
    propInt("Team1Score", 2),
    propStr("ReplayName", "GC3 doubles"),
    propName("MapName", "Stadium_P"),
    propName("MatchType", "Online"),
    propStr("Date", "2026-11-10:21-04-00"),
    propStr("MatchGUID", "ABC123"),
    propFloat("RecordFPS", 30),
    propInt("NumFrames", 9000),
    goals([
      { frame: 300, name: "Alpha", team: 0 },
      { frame: 5400, name: "Charlie", team: 1 },
    ]),
    players(),
    text("None"),
  ]);
  const prefix = Buffer.alloc(8);
  prefix.writeInt32LE(content.length, 0);
  prefix.writeUInt32LE(0, 4);
  return Buffer.concat([prefix, content]);
}

function players(): Buffer {
  const alpha = Buffer.concat([
    propStr("Name", "Alpha"),
    propByte("Platform", "OnlinePlatform", "OnlinePlatform_Steam"),
    propQword("OnlineID", BigInt("76561198000000001")),
    propInt("Team", 0),
    propInt("Score", 520),
    propInt("Goals", 2),
    propInt("Assists", 0),
    propInt("Saves", 1),
    propInt("Shots", 4),
    propBool("bBot", false),
    text("None"),
  ]);
  const bravo = Buffer.concat([
    propStr("Name", "Bravo"),
    propByte("Platform", "OnlinePlatform", "OnlinePlatform_Steam"),
    propQword("OnlineID", BigInt("76561198000000002")),
    propInt("Team", 1),
    propInt("Score", 300),
    propInt("Goals", 1),
    propInt("Assists", 0),
    propInt("Saves", 2),
    propInt("Shots", 3),
    propBool("bBot", false),
    text("None"),
  ]);
  return Buffer.concat([
    propStart("PlayerStats", "ArrayProperty"),
    i32(2),
    alpha,
    bravo,
  ]);
}

function goals(items: { frame: number; name: string; team: number }[]): Buffer {
  return Buffer.concat([
    propStart("Goals", "ArrayProperty"),
    i32(items.length),
    ...items.map((item) =>
      Buffer.concat([
        propInt("frame", item.frame),
        propStr("PlayerName", item.name),
        propInt("PlayerTeam", item.team),
        text("None"),
      ]),
    ),
  ]);
}

function propInt(key: string, value: number): Buffer {
  return Buffer.concat([propStart(key, "IntProperty"), i32(value)]);
}

function propFloat(key: string, value: number): Buffer {
  const body = Buffer.alloc(4);
  body.writeFloatLE(value);
  return Buffer.concat([propStart(key, "FloatProperty"), body]);
}

function propBool(key: string, value: boolean): Buffer {
  return Buffer.concat([propStart(key, "BoolProperty"), Buffer.from([value ? 1 : 0])]);
}

function propStr(key: string, value: string): Buffer {
  return Buffer.concat([propStart(key, "StrProperty"), text(value)]);
}

function propName(key: string, value: string): Buffer {
  return Buffer.concat([propStart(key, "NameProperty"), text(value)]);
}

function propQword(key: string, value: bigint): Buffer {
  const body = Buffer.alloc(8);
  body.writeBigUInt64LE(value);
  return Buffer.concat([propStart(key, "QWordProperty"), body]);
}

function propByte(key: string, kind: string, value: string): Buffer {
  return Buffer.concat([propStart(key, "ByteProperty"), text(kind), text(value)]);
}

function propStart(key: string, kind: string): Buffer {
  return Buffer.concat([text(key), text(kind), u32(0), u32(0)]);
}

function text(value: string): Buffer {
  const body = Buffer.from(`${value}\0`, "latin1");
  return Buffer.concat([i32(body.length), body]);
}

function i32(value: number): Buffer {
  const body = Buffer.alloc(4);
  body.writeInt32LE(value);
  return body;
}

function u32(value: number): Buffer {
  const body = Buffer.alloc(4);
  body.writeUInt32LE(value);
  return body;
}
