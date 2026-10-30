// Opt-in snippet expansion (app_settings `snippet_expand` = "1"): typing
// ";<title without spaces>" in any text field of a panel replaces it with the
// Notes snippet body. Password fields are never touched.
import { useEffect } from "react";
import { getSetting } from "../../ui/appSetting";
import { listSnippets } from "../../modules/notes/storeExtra";
import { expandAt, type Snip } from "./textTools";

export function useSnippetExpand() {
  useEffect(() => {
    let snips: Snip[] = [];
    let on = false;
    getSetting("snippet_expand").then(async (v) => { on = v === "1"; if (on) snips = await listSnippets(); }).catch(() => {});
    const input = (e: Event) => {
      const el = e.target;
      if (!on || !(el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type === "text"))) return;
      const r = expandAt(el.value, el.selectionStart ?? el.value.length, snips);
      if (!r) return;
      // Native setter so React's value tracker notices the change.
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set?.call(el, r.text);
      el.setSelectionRange(r.caret, r.caret);
      el.dispatchEvent(new Event("input", { bubbles: true })); // keep React state in sync
    };
    document.addEventListener("input", input, true);
    return () => document.removeEventListener("input", input, true);
  }, []);
}
