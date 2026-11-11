"use server";

import { redirect } from "next/navigation";
import { deleteReplay, setRlName } from "./repo";
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
