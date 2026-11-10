"use server";

import { redirect } from "next/navigation";
import { blankScenario, parseDefinition, PRESETS } from "./scenarios/catalog";
import { deleteScenario, insertScenario, updateScenario } from "./repo";
import { currentUser } from "./session";

export async function createScenario(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/");
  const preset = PRESETS.find((item) => item.id === String(formData.get("preset") ?? ""));
  const id = await insertScenario(
    user.id,
    preset?.name ?? "New scenario",
    preset?.definition ?? blankScenario(),
  );
  redirect(`/scenarios/${id}`);
}

export async function saveScenario(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/");
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 80) || "Scenario";
  let raw: unknown = null;
  try {
    raw = JSON.parse(String(formData.get("definition") ?? ""));
  } catch {
    raw = null;
  }
  const definition = parseDefinition(raw);
  if (!definition) redirect(`/scenarios/${id}?error=${encodeURIComponent("That scenario could not be saved.")}`);
  await updateScenario(user.id, id, name, definition);
  redirect(`/scenarios/${id}?saved=1`);
}

export async function removeScenario(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/");
  await deleteScenario(user.id, String(formData.get("id") ?? ""));
  redirect("/scenarios");
}
