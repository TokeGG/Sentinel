import { useState } from "react";
import type { Course } from "./logic";

type Draft = Pick<Course, "name" | "provider" | "url" | "total" | "done" | "next" | "notes">;
const EMPTY: Draft = { name: "", provider: "", url: "", total: 10, done: 0, next: "", notes: "" };

/** Add / edit form for one course (dates and study time are edited on the card). */
export function CourseForm({ course, busy, onSave, onCancel }: { course?: Course; busy: boolean; onSave(d: Draft & { id?: string }): Promise<unknown>; onCancel?(): void }) {
  const [d, setD] = useState<Draft>(course ?? EMPTY);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD({ ...d, [k]: k === "total" || k === "done" ? Number(e.target.value) : e.target.value });
  const save = async () => { await onSave({ ...d, ...(course ? { id: course.id } : {}) }); if (!course) setD(EMPTY); };
  return (
    <form className="co-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <label>Name<input className="ui-input" value={d.name} onChange={set("name")} required placeholder="e.g. Intro to Networking" /></label>
      <label>School or provider<input className="ui-input" value={d.provider} onChange={set("provider")} placeholder="e.g. Coursera" /></label>
      <label>Link<input className="ui-input" type="url" value={d.url} onChange={set("url")} placeholder="https://..." /></label>
      <div className="co-pair">
        <label>Lessons in total<input className="ui-input" type="number" min={1} value={d.total} onChange={set("total")} /></label>
        <label>Finished<input className="ui-input" type="number" min={0} max={d.total} value={d.done} onChange={set("done")} /></label>
      </div>
      <label>Next lesson<input className="ui-input" value={d.next} onChange={set("next")} placeholder="e.g. Module 3: Subnets" /></label>
      <label>Notes<textarea className="ui-input" rows={3} value={d.notes} onChange={set("notes")} /></label>
      <div className="co-pair">
        <button type="submit" className="ui-btn primary" disabled={busy || !d.name.trim()}>{course ? "Save" : "Add course"}</button>
        {onCancel && <button type="button" className="ui-btn" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
