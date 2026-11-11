"use server";

import { redirect } from "next/navigation";
import {
  deleteReplay,
  deleteRlApiConnection,
  deleteRlApiDeviceAuth,
  getRlApiDeviceAuth,
  saveRlApiConnection,
  saveRlApiDeviceAuth,
  setRlName,
} from "./repo";
import { encryptSecret } from "./crypto";
import { finishEpicDeviceAuthorization, startEpicDeviceAuthorization } from "./rlapi/client";
import { syncRlapiReplays as syncRlapiReplaysForUser } from "./rlapi/sync";
import { currentUser } from "./session";
import { deleteLocalReplay, deleteObject } from "./storage";

export async function saveRlName(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/");
  const raw = String(formData.get("rlName") ?? "").trim();
  await setRlName(user.id, raw || null);
  redirect("/settings?saved=1");
}

export async function removeReplay(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/");
  const id = String(formData.get("id") ?? "");
  const replay = await deleteReplay(user.id, id);
  if (replay?.storageKey && replay.storageStatus === "stored") {
    await deleteObject(replay.storageKey).catch(() => undefined);
  }
  await deleteLocalReplay(user.id, id);
  redirect("/replays");
}

export async function syncRlapiReplays(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/");
  const requested = Number(formData.get("limit") ?? 10);
  const limit = Number.isFinite(requested) ? Math.min(25, Math.max(1, Math.round(requested))) : 10;

  let target = "/settings";
  try {
    const result = await syncRlapiReplaysForUser(user.id, limit);
    const params = new URLSearchParams({
      rlapi: "synced",
      seen: String(result.seen),
      imported: String(result.imported),
      duplicates: String(result.duplicates),
      failed: String(result.failed),
      skipped: String(result.skipped),
    });
    target = `/settings?${params.toString()}`;
  } catch (error) {
    const params = new URLSearchParams({
      rlapi_error: error instanceof Error ? error.message : String(error),
    });
    target = `/settings?${params.toString()}`;
  }
  redirect(target);
}

export async function startRlapiConnect() {
  const user = await currentUser();
  if (!user) redirect("/");
  let target = "/settings";
  try {
    const device = await startEpicDeviceAuthorization();
    const expiresAt = new Date(Date.now() + device.expiresIn * 1000).toISOString();
    await saveRlApiDeviceAuth({
      userId: user.id,
      deviceCode: device.deviceCode,
      userCode: device.userCode,
      verificationUri: device.verificationUri,
      intervalSeconds: device.interval,
      expiresAt,
    });
    target = "/settings?rlapi=connect";
  } catch (error) {
    const params = new URLSearchParams({ rlapi_error: error instanceof Error ? error.message : String(error) });
    target = `/settings?${params.toString()}`;
  }
  redirect(target);
}

export async function finishRlapiConnect() {
  const user = await currentUser();
  if (!user) redirect("/");
  let target = "/settings";
  try {
    const pending = await getRlApiDeviceAuth(user.id);
    if (!pending) throw new Error("Start Epic connection first.");
    if (new Date(pending.expiresAt).getTime() < Date.now()) {
      await deleteRlApiDeviceAuth(user.id);
      throw new Error("That Epic connection code expired. Start again.");
    }
    const token = await finishEpicDeviceAuthorization(pending.deviceCode);
    if (!token.accountId || !token.refreshToken) throw new Error("Epic auth did not return an account.");
    await saveRlApiConnection({
      userId: user.id,
      epicAccountId: token.accountId,
      displayName: `Epic ${token.accountId.slice(0, 8)}`,
      refreshTokenCiphertext: encryptSecret(token.refreshToken),
      refreshExpiresAt: token.refreshExpiresAt,
    });
    await deleteRlApiDeviceAuth(user.id);
    target = "/settings?rlapi=connected";
  } catch (error) {
    const params = new URLSearchParams({ rlapi_error: error instanceof Error ? error.message : String(error) });
    target = `/settings?${params.toString()}`;
  }
  redirect(target);
}

export async function disconnectRlapi() {
  const user = await currentUser();
  if (!user) redirect("/");
  await deleteRlApiConnection(user.id);
  await deleteRlApiDeviceAuth(user.id);
  redirect("/settings?rlapi=disconnected");
}
