const NODE_VERSION = "v22.16.0";

export function listenerBat(appUrl: string, token: string): string {
  const app = appUrl.replace(/\/$/, "");
  if (!/^https?:\/\/[^\s"']+$/.test(app)) {
    throw new Error("App URL cannot be embedded in the listener");
  }
  if (!/^rpl_[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error("Token cannot be embedded in the listener");
  }
  const nodeZip = `node-${NODE_VERSION}-win-x64`;
  const lines = [
    "@echo off",
    "setlocal",
    "title Replay Lab listener",
    "echo This window watches your Rocket League demos folder and uploads finished matches.",
    "echo It contains your upload token. Do not share this file.",
    "echo.",
    `set "APP_URL=${app}"`,
    `set "TOKEN=${token}"`,
    `set "DIR=%APPDATA%\\replay-lab"`,
    `if not exist "%DIR%" mkdir "%DIR%"`,
    "where node >nul 2>&1",
    "if errorlevel 1 goto installnode",
    "set \"NODE=node\"",
    "goto fetch",
    ":installnode",
    `set "NODE=%DIR%\\node\\node.exe"`,
    `if exist "%NODE%" goto fetch`,
    "echo Installing a private copy of Node for Replay Lab...",
    `curl.exe -fsSL -o "%DIR%\\node.zip" "https://nodejs.org/dist/${NODE_VERSION}/${nodeZip}.zip"`,
    "if errorlevel 1 goto fail",
    `tar -xf "%DIR%\\node.zip" -C "%DIR%"`,
    "if errorlevel 1 goto fail",
    `if exist "%DIR%\\${nodeZip}" move "%DIR%\\${nodeZip}" "%DIR%\\node" >nul`,
    `del "%DIR%\\node.zip"`,
    ":fetch",
    "echo Updating the listener...",
    `curl.exe -fsSL -o "%DIR%\\replay-lab-listener.mjs" "%APP_URL%/listener/replay-lab-listener.mjs"`,
    "if errorlevel 1 goto fail",
    `curl.exe -fsSL -o "%DIR%\\rl_replay_subtr_actor_bg.wasm" "%APP_URL%/listener/rl_replay_subtr_actor_bg.wasm"`,
    "if errorlevel 1 goto fail",
    `"%NODE%" "%DIR%\\replay-lab-listener.mjs" setup --token "%TOKEN%" --url "%APP_URL%"`,
    "if errorlevel 1 goto fail",
    `"%NODE%" "%DIR%\\replay-lab-listener.mjs" watch`,
    "if errorlevel 1 goto fail",
    "goto end",
    ":fail",
    "echo.",
    "echo The listener stopped before it was watching.",
    "pause",
    ":end",
    "",
  ];
  return lines.join("\r\n");
}
