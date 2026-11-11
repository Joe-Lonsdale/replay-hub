import "server-only";

import WebSocket from "ws";
import {
  RLAPI_DEFAULT_BASE_URL,
  RLAPI_DEFAULT_BUILD_SECRET,
  RLAPI_DEFAULT_FEATURE_SET,
  RLAPI_DEFAULT_GAME_VERSION,
  buildPsyNetMessage,
  decodeBuildId,
  generatePsySig,
  parsePsyNetMessage,
  playerId,
} from "./protocol";

const EGS_USER_AGENT = "UELauncher/11.0.1-14907503+++Portal+Release-Live Windows/10.0.19041.1.256.64bit";
const EOS_DEPLOYMENT_ID = "da32ae9c12ae40e8a112c52e1f17f3ba";
const EOS_CLIENT_ID = "xyza7891p5D7s9R6Gm6moTHWGloerp7B";
const EOS_SECRET = "Knh18du4NVlFs+3uQ+ZPpDCVto0WYf4yXP8+OcwVt1o";

export interface RlApiMatchEntry {
  ReplayUrl?: string;
  Match?: {
    MatchGUID?: string;
    RecordStartTimestamp?: number;
    MapName?: string;
    Playlist?: number;
    Team0Score?: number;
    Team1Score?: number;
  };
}

export interface EpicDeviceAuthorization {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface EosToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: string | null;
  refreshExpiresAt: string | null;
  accountId: string;
}

export interface RlApiStatus {
  configured: boolean;
  mode: "auth" | "session" | "missing";
  missing: string[];
}

interface RlApiBaseConfig {
  playerId: string;
  gameVersion: string;
  buildId: string;
  environment: string;
}

interface RlApiSessionConfig extends RlApiBaseConfig {
  mode: "session";
  wsUrl: string;
  psyToken: string;
  sessionId: string;
}

interface RlApiAuthConfig extends RlApiBaseConfig {
  mode: "auth";
  baseUrl: string;
  featureSet: string;
  buildSecret: string;
  eosToken: string;
  epicAccountId: string;
  accountName: string;
  platform: string;
  accountId: string;
}

type RlApiConfig = RlApiSessionConfig | RlApiAuthConfig;

interface AuthPlayerResponse {
  SessionID: string;
  PerConURLv2: string;
  PsyToken: string;
}

let requestCounter = 0;

export async function startEpicDeviceAuthorization(): Promise<EpicDeviceAuthorization> {
  const response = await fetch("https://api.epicgames.dev/epic/oauth/v2/deviceAuthorization", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": EGS_USER_AGENT,
    },
    body: new URLSearchParams({ client_id: EOS_CLIENT_ID }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(epicError(response.status, body));
  return {
    deviceCode: String(body.device_code ?? ""),
    userCode: String(body.user_code ?? ""),
    verificationUri: String(body.verification_uri ?? ""),
    expiresIn: Number(body.expires_in ?? 0),
    interval: Number(body.interval ?? 5),
  };
}

export async function finishEpicDeviceAuthorization(deviceCode: string): Promise<EosToken> {
  return requestEosToken({
    grant_type: "device_code",
    device_code: deviceCode,
  });
}

export async function refreshEpicEosToken(refreshToken: string): Promise<EosToken> {
  return requestEosToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

export async function getMatchHistoryForEpicAccount(input: {
  eosToken: string;
  epicAccountId: string;
  accountName: string;
  limit: number;
}): Promise<RlApiMatchEntry[]> {
  const gameVersion = process.env.RLAPI_GAME_VERSION || RLAPI_DEFAULT_GAME_VERSION;
  const config: RlApiAuthConfig = {
    mode: "auth",
    playerId: playerId("Epic", input.epicAccountId),
    gameVersion,
    buildId: process.env.RLAPI_BUILD_ID || decodeBuildId(gameVersion),
    environment: process.env.RLAPI_ENVIRONMENT || "Prod",
    baseUrl: (process.env.RLAPI_BASE_URL || RLAPI_DEFAULT_BASE_URL).replace(/\/$/, ""),
    featureSet: process.env.RLAPI_FEATURE_SET || RLAPI_DEFAULT_FEATURE_SET,
    buildSecret: process.env.RLAPI_BUILD_SECRET || RLAPI_DEFAULT_BUILD_SECRET,
    eosToken: input.eosToken,
    epicAccountId: input.epicAccountId,
    accountName: input.accountName,
    platform: "Epic",
    accountId: input.epicAccountId,
  };
  const session = await authenticate(config);
  const rpc = await PsyNetSocket.open(session);
  try {
    const result = await rpc.request<{ Matches?: RlApiMatchEntry[] }>("Matches/GetMatchHistory v1", {
      PlayerID: config.playerId,
    });
    return (result.Matches ?? []).slice(0, input.limit);
  } finally {
    rpc.close();
  }
}

export function rlapiStatus(): RlApiStatus {
  const missing = missingConfig();
  if (missing.length === 0) {
    return {
      configured: true,
      mode: hasSessionConfig() ? "session" : "auth",
      missing,
    };
  }
  return { configured: false, mode: "missing", missing };
}

export async function getMatchHistory(limit: number): Promise<RlApiMatchEntry[]> {
  const config = readConfig();
  const session = config.mode === "session" ? config : await authenticate(config);
  const rpc = await PsyNetSocket.open(session);
  try {
    const result = await rpc.request<{ Matches?: RlApiMatchEntry[] }>("Matches/GetMatchHistory v1", {
      PlayerID: config.playerId,
    });
    return (result.Matches ?? []).slice(0, limit);
  } finally {
    rpc.close();
  }
}

export async function downloadReplay(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Replay download failed: ${response.status} ${response.statusText}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length < 1000 || body.length > 20_000_000) {
    throw new Error(`Replay download size looked wrong (${body.length} bytes).`);
  }
  return body;
}

async function requestEosToken(params: Record<string, string>): Promise<EosToken> {
  const form = new URLSearchParams({
    ...params,
    deployment_id: EOS_DEPLOYMENT_ID,
    scope: "basic_profile",
  });
  const response = await fetch("https://api.epicgames.dev/epic/oauth/v2/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(`${EOS_CLIENT_ID}:${EOS_SECRET}`).toString("base64")}`,
      "user-agent": EGS_USER_AGENT,
    },
    body: form,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(epicError(response.status, body));
  return {
    accessToken: String(body.access_token ?? ""),
    refreshToken: String(body.refresh_token ?? ""),
    expiresAt: typeof body.expires_at === "string" ? body.expires_at : null,
    refreshExpiresAt: typeof body.refresh_expires_at === "string" ? body.refresh_expires_at : null,
    accountId: String(body.selected_account_id || body.account_id || ""),
  };
}

async function authenticate(config: RlApiAuthConfig): Promise<RlApiSessionConfig> {
  const body = {
    Platform: config.platform,
    PlayerName: config.accountName,
    PlayerID: config.accountId,
    Language: "INT",
    AuthTicket: config.eosToken,
    BuildRegion: "",
    FeatureSet: config.featureSet,
    Device: "PC",
    LocalFirstPlayerID: config.platform === "Epic" ? config.playerId : "",
    bSkipAuth: false,
    bSetAsPrimaryAccount: true,
    EpicAuthTicket: config.eosToken,
    EpicAccountID: config.epicAccountId,
  };
  const payload = JSON.stringify(body);
  const requestId = nextRequestId();
  const response = await fetch(`${config.baseUrl}/Auth/AuthPlayer/v2`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": `RL Win/${config.gameVersion} gzip (x86_64-pc-win32) curl-7.67.0 Schannel`,
      PsyBuildID: config.buildId,
      PsyEnvironment: config.environment,
      PsyRequestID: requestId,
      PsySig: generatePsySig(payload),
      PsyBuildSecret: config.buildSecret,
    },
    body: payload,
  });
  if (!response.ok) throw new Error(`RLAPI auth failed: ${response.status} ${response.statusText}`);

  const wrapper = (await response.json()) as { Result?: AuthPlayerResponse; Error?: { Type?: string; Message?: string } };
  if (wrapper.Error) throw new Error(formatPsyError(wrapper.Error));
  const result = wrapper.Result;
  if (!result?.PerConURLv2 || !result.PsyToken || !result.SessionID) {
    throw new Error("RLAPI auth response did not include websocket credentials.");
  }

  return {
    mode: "session",
    playerId: config.playerId,
    gameVersion: config.gameVersion,
    buildId: config.buildId,
    environment: config.environment,
    wsUrl: result.PerConURLv2,
    psyToken: result.PsyToken,
    sessionId: result.SessionID,
  };
}

class PsyNetSocket {
  private pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }>();

  private constructor(
    private readonly ws: WebSocket,
    private readonly config: RlApiSessionConfig,
  ) {}

  static open(config: RlApiSessionConfig): Promise<PsyNetSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(config.wsUrl, {
        headers: {
          PsyBuildID: config.buildId,
          "User-Agent": `RL Win/${config.gameVersion} gzip`,
          PsyEnvironment: config.environment,
          PsyToken: config.psyToken,
          PsySessionID: config.sessionId,
        },
      });
      const socket = new PsyNetSocket(ws, config);
      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new Error("RLAPI websocket connection timed out."));
      }, 15_000);

      ws.once("open", () => {
        clearTimeout(timeout);
        resolve(socket);
      });
      ws.once("error", (error) => {
        clearTimeout(timeout);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
      ws.on("message", (data) => socket.handleMessage(data));
      ws.on("close", () => socket.rejectPending(new Error("RLAPI websocket closed before the response arrived.")));
    });
  }

  request<T>(service: string, data: unknown): Promise<T> {
    const requestId = nextRequestId();
    const message = buildPsyNetMessage({ PsyService: service, PsyRequestID: requestId }, data);
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`RLAPI ${service} timed out.`));
      }, 20_000);
      this.pending.set(requestId, {
        resolve: (value) => resolve(value as T),
        reject,
        timeout,
      });
      this.ws.send(message, (error) => {
        if (!error) return;
        clearTimeout(timeout);
        this.pending.delete(requestId);
        reject(error);
      });
    });
  }

  close() {
    this.ws.close();
  }

  private handleMessage(data: WebSocket.RawData) {
    const message = data.toString();
    if (message.startsWith("PsyPong:")) return;

    let parsed;
    try {
      parsed = parsePsyNetMessage(message);
    } catch {
      return;
    }
    const pending = this.pending.get(parsed.responseId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(parsed.responseId);

    if (parsed.body.Error) {
      pending.reject(new Error(formatPsyError(parsed.body.Error)));
      return;
    }
    pending.resolve(parsed.body.Result);
  }

  private rejectPending(error: Error) {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pending.delete(id);
    }
  }
}

function readConfig(): RlApiConfig {
  const status = rlapiStatus();
  if (!status.configured) {
    throw new Error(`RLAPI is not configured. Missing ${status.missing.join(", ")}.`);
  }

  const gameVersion = process.env.RLAPI_GAME_VERSION || RLAPI_DEFAULT_GAME_VERSION;
  const buildId = process.env.RLAPI_BUILD_ID || decodeBuildId(gameVersion);
  const environment = process.env.RLAPI_ENVIRONMENT || "Prod";
  const resolvedPlayerId = configuredPlayerId();
  if (!resolvedPlayerId) throw new Error("RLAPI_PLAYER_ID or RLAPI account id is required.");

  if (hasSessionConfig()) {
    return {
      mode: "session",
      playerId: resolvedPlayerId,
      gameVersion,
      buildId,
      environment,
      wsUrl: process.env.RLAPI_WS_URL ?? "",
      psyToken: process.env.RLAPI_PSY_TOKEN ?? "",
      sessionId: process.env.RLAPI_SESSION_ID ?? "",
    };
  }

  const platform = process.env.RLAPI_PLATFORM || "Epic";
  const accountId = configuredAccountId(platform);
  return {
    mode: "auth",
    playerId: resolvedPlayerId,
    gameVersion,
    buildId,
    environment,
    baseUrl: (process.env.RLAPI_BASE_URL || RLAPI_DEFAULT_BASE_URL).replace(/\/$/, ""),
    featureSet: process.env.RLAPI_FEATURE_SET || RLAPI_DEFAULT_FEATURE_SET,
    buildSecret: process.env.RLAPI_BUILD_SECRET || RLAPI_DEFAULT_BUILD_SECRET,
    eosToken: process.env.RLAPI_EOS_TOKEN ?? "",
    epicAccountId: process.env.RLAPI_EPIC_ACCOUNT_ID ?? "",
    accountName: process.env.RLAPI_ACCOUNT_NAME ?? "",
    platform,
    accountId: accountId ?? "",
  };
}

function missingConfig(): string[] {
  if (!configuredPlayerId()) return ["RLAPI_PLAYER_ID or RLAPI_ACCOUNT_ID"];
  if (hasSessionConfig()) return [];

  const platform = process.env.RLAPI_PLATFORM || "Epic";
  const missing: string[] = [];
  if (!process.env.RLAPI_EOS_TOKEN) missing.push("RLAPI_EOS_TOKEN");
  if (!process.env.RLAPI_EPIC_ACCOUNT_ID) missing.push("RLAPI_EPIC_ACCOUNT_ID");
  if (!process.env.RLAPI_ACCOUNT_NAME) missing.push("RLAPI_ACCOUNT_NAME");
  if (!configuredAccountId(platform)) missing.push(platform === "Steam" ? "RLAPI_STEAM_ACCOUNT_ID" : "RLAPI_ACCOUNT_ID");
  return missing;
}

function hasSessionConfig(): boolean {
  return Boolean(process.env.RLAPI_WS_URL && process.env.RLAPI_PSY_TOKEN && process.env.RLAPI_SESSION_ID);
}

function configuredPlayerId(): string | null {
  if (process.env.RLAPI_PLAYER_ID) return process.env.RLAPI_PLAYER_ID;
  const platform = process.env.RLAPI_PLATFORM || "Epic";
  const accountId = configuredAccountId(platform);
  return accountId ? playerId(platform, accountId) : null;
}

function configuredAccountId(platform: string): string | null {
  if (platform === "Steam") return process.env.RLAPI_STEAM_ACCOUNT_ID || process.env.RLAPI_ACCOUNT_ID || null;
  return process.env.RLAPI_ACCOUNT_ID || process.env.RLAPI_EPIC_ACCOUNT_ID || null;
}

function nextRequestId(): string {
  requestCounter += 1;
  return `PsyNetMessage_X_${requestCounter}`;
}

function formatPsyError(error: { Type?: string; Message?: string }): string {
  return [error.Type, error.Message].filter(Boolean).join(": ") || "RLAPI returned an error.";
}

function epicError(status: number, body: unknown): string {
  if (body && typeof body === "object") {
    const error = body as { errorCode?: string; errorMessage?: string; error?: string; error_description?: string };
    const message = error.errorMessage || error.error_description || error.error;
    if (message) return `Epic auth failed (${status}): ${message}`;
    if (error.errorCode) return `Epic auth failed (${status}): ${error.errorCode}`;
  }
  return `Epic auth failed (${status}).`;
}
