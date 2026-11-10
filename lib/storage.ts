import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Configured } from "./env";

export function replayObjectKey(userId: string, replayId: string): string {
  return `users/${userId}/${replayId}.replay`;
}

export function localReplayPath(userId: string, replayId: string): string {
  return path.join(process.cwd(), "data", "replays", userId, `${replayId}.replay`);
}

export async function presignPut(key: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    ContentType: "application/octet-stream",
  });
  return getSignedUrl(client(), command, { expiresIn: 60 * 15 });
}

export async function presignGet(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
  });
  return getSignedUrl(client(), command, { expiresIn: 60 * 10 });
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await client().send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function deleteObject(key: string): Promise<void> {
  if (!r2Configured()) return;
  await client().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
}

export async function writeLocalReplay(userId: string, replayId: string, body: Buffer): Promise<void> {
  const file = localReplayPath(userId, replayId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

export async function readLocalReplay(userId: string, replayId: string): Promise<Buffer | null> {
  try {
    return await readFile(localReplayPath(userId, replayId));
  } catch {
    return null;
  }
}

export async function deleteLocalReplay(userId: string, replayId: string): Promise<void> {
  await rm(localReplayPath(userId, replayId), { force: true });
}

function client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });
}
