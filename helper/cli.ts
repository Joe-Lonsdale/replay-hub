import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildReplay } from "../lib/replay/frames";
import { packReplay } from "../lib/replay/pack";
import { parseReplayHeader } from "../lib/replay/header";
import type { StoredReplay } from "../lib/replay/types";
import { samplesFromReplay, wasmByteLength } from "./samples";

interface Config {
  apiBase: string;
  token: string;
  demosDir?: string;
}

interface UploadResponse {
  id: string;
  duplicate: boolean;
  storage: string;
  upload: {
    url: string;
    headers: Record<string, string>;
    auth: boolean;
    confirm: string | null;
  } | null;
}

const args = process.argv.slice(2);
const command = args[0];

export { wasmByteLength as listenerWasmBytes };

if (startedDirectly()) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

function startedDirectly(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

async function main() {
  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }
  if (command === "setup") {
    const flags = readFlags(args.slice(1));
    if (!flags.token || !flags.url) {
      throw new Error("setup needs --token and --url");
    }
    const config: Config = {
      apiBase: flags.url.replace(/\/$/, ""),
      token: flags.token,
      demosDir: flags.dir,
    };
    await writeConfig(config);
    console.log(`Saved helper config to ${configPath()}`);
    return;
  }
  const config = await readConfig();
  if (command === "upload") {
    const file = args[1];
    if (!file) throw new Error("upload needs a .replay path");
    await uploadFile(config, path.resolve(file), args.includes("--force"));
    return;
  }
  const demos = await resolveDemos(config);
  const force = args.includes("--force");
  if (command === "scan") {
    await scan(config, demos, force);
    return;
  }
  if (command === "watch") {
    await scan(config, demos, force);
    console.log(`Watching ${demos}`);
    const pending = new Map<string, NodeJS.Timeout>();
    watch(demos, (_event, name) => {
      if (!name || !name.toLowerCase().endsWith(".replay")) return;
      const full = path.join(demos, name);
      const existing = pending.get(full);
      if (existing) clearTimeout(existing);
      pending.set(
        full,
        setTimeout(() => {
          pending.delete(full);
          uploadFile(config, full).catch((error: unknown) => {
            console.error(error instanceof Error ? error.message : error);
          });
        }, 1500),
      );
    });
    await new Promise(() => undefined);
    return;
  }
  throw new Error(`Unknown command "${command}"`);
}

async function scan(config: Config, demos: string, force: boolean) {
  const files = (await readdir(demos)).filter((name) => name.toLowerCase().endsWith(".replay"));
  console.log(`${files.length} replays in ${demos}`);
  for (const name of files) {
    await uploadFile(config, path.join(demos, name), force);
  }
}

async function uploadFile(config: Config, file: string, force = false) {
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return;
  await wait(400);
  const again = await stat(file).catch(() => null);
  if (!again || again.size !== info.size || again.size < 1000) return;

  const buffer = await readFile(file);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const ledger = await readLedger();
  if (ledger.has(sha256) && !force) return;

  const header = parseReplayHeader(buffer);
  let replay: StoredReplay;
  try {
    const samples = await samplesFromReplay(
      buffer,
      header.players.map((player) => ({ name: player.name, team: player.team })),
    );
    replay = buildReplay(header, samples);
  } catch (error) {
    replay = buildReplay(header, null);
    replay.warnings.push(error instanceof Error ? error.message : String(error));
  }

  const response = await fetch(`${config.apiBase}/api/replays`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ sha256, byteLength: buffer.length, replay: packReplay(replay) }),
  });
  if (!response.ok) {
    throw new Error(`${path.basename(file)}: ${response.status} ${await response.text()}`);
  }
  const body = (await response.json()) as UploadResponse;
  if (body.upload) {
    const headers = new Headers(body.upload.headers);
    if (body.upload.auth) headers.set("authorization", `Bearer ${config.token}`);
    const put = await fetch(body.upload.url, { method: "PUT", headers, body: buffer });
    if (!put.ok) throw new Error(`${path.basename(file)} file upload failed: ${put.status}`);
    if (body.upload.confirm) {
      const confirm = await fetch(body.upload.confirm, {
        method: "POST",
        headers: { authorization: `Bearer ${config.token}` },
      });
      if (!confirm.ok) throw new Error(`${path.basename(file)} was not confirmed in storage`);
    }
  }
  ledger.add(sha256);
  await writeLedger(ledger);
  const depth = replay.depth === "frames" ? "frames" : "header";
  console.log(
    `${body.duplicate ? "updated" : "saved"} ${replay.mapLabel} ${replay.team0Score}-${replay.team1Score} (${depth})`,
  );
}

function printHelp() {
  console.log(`Replay Lab listener

  setup --token rpl_... --url https://your-site
  scan
  watch
  upload path\\to\\file.replay
  scan --force

Download it from Settings, or from this project:
  npm run helper -- setup --token rpl_... --url http://localhost:3000

It watches Documents\\My Games\\Rocket League\\TAGame\\Demos.
scan --force rebuilds stats for replays already uploaded, including the event log used by scenarios.`);
}

function readFlags(argv: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    flags[arg.slice(2)] = argv[index + 1] ?? "";
    index += 1;
  }
  return flags;
}

function configPath(): string {
  const base = process.env.APPDATA || path.join(os.homedir(), ".config");
  return path.join(base, "replay-lab", "config.json");
}

function ledgerPath(): string {
  return path.join(path.dirname(configPath()), "uploaded.json");
}

async function readConfig(): Promise<Config> {
  try {
    return JSON.parse(await readFile(configPath(), "utf8")) as Config;
  } catch {
    throw new Error(`No helper config at ${configPath()}. Run setup with a token from Settings.`);
  }
}

async function writeConfig(config: Config) {
  await mkdir(path.dirname(configPath()), { recursive: true });
  await writeFile(configPath(), JSON.stringify(config, null, 2));
}

async function readLedger(): Promise<Set<string>> {
  try {
    const body = JSON.parse(await readFile(ledgerPath(), "utf8")) as { hashes?: string[] };
    return new Set(body.hashes ?? []);
  } catch {
    return new Set();
  }
}

async function writeLedger(hashes: Set<string>) {
  await mkdir(path.dirname(ledgerPath()), { recursive: true });
  await writeFile(ledgerPath(), JSON.stringify({ hashes: [...hashes] }));
}

async function resolveDemos(config: Config): Promise<string> {
  const candidates = [
    config.demosDir,
    path.join(os.homedir(), "Documents", "My Games", "Rocket League", "TAGame", "Demos"),
    path.join(os.homedir(), "OneDrive", "Documents", "My Games", "Rocket League", "TAGame", "Demos"),
  ].filter((dir): dir is string => Boolean(dir));
  for (const dir of candidates) {
    try {
      await access(dir);
      return dir;
    } catch {
      // try the next documents folder
    }
  }
  throw new Error(`Could not find a demos folder. Pass --dir during setup. Looked in ${candidates.join(", ")}`);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
