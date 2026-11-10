import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "listener");
const wasmName = "rl_replay_subtr_actor_bg.wasm";
const outfile = path.join(outDir, "replay-lab-listener.mjs");

await mkdir(outDir, { recursive: true });
await copyFile(path.join(root, "node_modules", "@rlrml", "subtr-actor", wasmName), path.join(outDir, wasmName));
await esbuild.build({
  absWorkingDir: root,
  entryPoints: [path.join(root, "helper", "cli.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile,
  tsconfig: path.join(root, "tsconfig.json"),
  logLevel: "info",
});

if (process.env.npm_lifecycle_event === "predev") {
  console.log("listener files written");
} else {
  const bundled = await import(pathToFileURL(outfile).href);
  const bytes = await bundled.listenerWasmBytes();
  if (typeof bytes !== "number" || bytes < 1000) {
    throw new Error("The listener bundle could not read its wasm file.");
  }
  console.log(`listener ready (${bytes} wasm bytes)`);
}
