"use server";

import { redirect } from "next/navigation";
import { deleteReplay, setRlName } from "./repo";
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
