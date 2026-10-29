// The panel's write operations (Tauri-coupled), exposed as manifest skills so busy/error handling is shared.
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { fetch } from "@tauri-apps/plugin-http";
import { exportText, importState, resetState, thumbsDownEpisode } from "./brainOps";
import { seededRng } from "./kernel/brain";
import { htmlToText, makeNote } from "./knowledge";
import { noteUrlOk } from "./panelLogic";
import { learn } from "./runner";
import * as store from "./store";

type A = Record<string, unknown> | undefined;
const str = (v: unknown) => String(v ?? "");
const rng = () => seededRng(Date.now());
const added = async (c: ReturnType<typeof makeNote>) => {
  if (!c.ok) throw new Error(c.error);
  await store.addNote(c.note);
  return { ok: true };
};

export const addTextNote = (a: A) => added(makeNote(str(a?.title), str(a?.text)));
export async function addUrlNote(a: A) {
  const url = str(a?.url).trim();
  if (!noteUrlOk(url)) throw new Error("Only http(s) addresses can be fetched.");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetching the page failed (${res.status}).`);
  const html = (await res.text()).slice(0, 2_000_000);
  return added(makeNote(/<title[^>]*>([^<]*)/i.exec(html)?.[1]?.trim() ?? "", htmlToText(html), url));
}
export async function deleteNote(a: A) { await store.removeNote(Number(a?.id)); return { ok: true }; }

/** Thumbs on a finished run. A first thumbs-down also feeds the learning step (once). */
export async function rateRun(a: A) {
  const id = Number(a?.id), thumbs = a?.thumbs === "down" ? "down" : "up";
  const ep = await store.getEpisode(id);
  await store.rateEpisode(id, thumbs);
  if (thumbs === "down" && ep && ep.thumbs !== "down") await learn(await store.loadLearnState(), thumbsDownEpisode(ep));
  return { ok: true };
}

export async function exportBrain() {
  const text = exportText(await store.loadLearnState());
  const path = await save({ defaultPath: "botbrain.json", filters: [{ name: "JSON", extensions: ["json"] }] });
  if (path) await invoke("write_text_file", { path, contents: text });
  return { ok: true, text, saved: path ?? null };
}
export async function importBrain(a: A) {
  const r = importState(str(a?.text), rng());
  if (!r.ok) throw new Error(r.error);
  await store.saveLearnState(r.state);
  return { ok: true };
}
export async function resetBrain() { await store.saveLearnState(resetState(rng())); return { ok: true }; }
