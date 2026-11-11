import { createHmac } from "node:crypto";

export const RLAPI_DEFAULT_BASE_URL = "https://api.rlpp.psynet.gg/rpc";
export const RLAPI_DEFAULT_GAME_VERSION = "261031.63733.533021";
export const RLAPI_DEFAULT_FEATURE_SET = "PrimeUpdate60_FFE7A62B41040BB67F8829FD67F2EE8A";
export const RLAPI_DEFAULT_BUILD_SECRET = "eba094a6fd9abbdf913dcbadf18ab59682671cdcc7cebc4902b81113273f5fa3";

const PSY_SIG_KEY = "c338bd36fb8c42b1a431d30add939fc7";
const HEADER_SEPARATOR = "\r\n\r\n";

export interface PsyNetResponse<T = unknown> {
  Result?: T;
  Error?: { Type?: string; Message?: string };
}

export interface ParsedPsyNetMessage<T = unknown> {
  headers: Record<string, string>;
  responseId: string;
  body: PsyNetResponse<T>;
}

export function generatePsySig(body: string | Uint8Array): string {
  return createHmac("sha256", PSY_SIG_KEY).update("-").update(body).digest("base64");
}

export function buildPsyNetMessage(headers: Record<string, string>, body?: unknown): string {
  const out = { ...headers };
  const payload = body === undefined ? "" : JSON.stringify(body);
  if (body !== undefined) out.PsySig = generatePsySig(payload);

  const headerLines = Object.entries(out).map(([key, value]) => `${key}: ${value}`);
  return `${headerLines.join("\r\n")}${HEADER_SEPARATOR}${payload}`;
}

export function parsePsyNetMessage<T = unknown>(message: string): ParsedPsyNetMessage<T> {
  const splitAt = message.indexOf(HEADER_SEPARATOR);
  if (splitAt === -1) throw new Error("PsyNet message did not include a header separator.");

  const headers: Record<string, string> = {};
  for (const line of message.slice(0, splitAt).split("\r\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }

  return {
    headers,
    responseId: headers.PsyResponseID ?? "",
    body: JSON.parse(message.slice(splitAt + HEADER_SEPARATOR.length)) as PsyNetResponse<T>,
  };
}

export function playerId(platform: string, id: string): string {
  return `${platform}|${id}|0`;
}

export function decodeBuildId(gameVersion: string): string {
  const bytes: number[] = [];
  for (const char of gameVersion) {
    const code = char.charCodeAt(0);
    bytes.push(code & 0xff, code >> 8);
  }
  const raw = crc32(bytes);
  return String(raw > 0x7fffffff ? raw - 0x1_0000_0000 : raw);
}

function crc32(bytes: number[]): number {
  const poly = 0x04c11db7;
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc ^ (byte << 24)) >>> 0;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x80000000 ? ((crc << 1) ^ poly) >>> 0 : (crc << 1) >>> 0;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
