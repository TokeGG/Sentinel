// Email -> Calendar task (pure): args for Calendar's add_item skill. Body is not copied (privacy, size).
export function mailTaskArgs(m: { subject: string; fromAddr: string }, now: Date): Record<string, unknown> {
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const subject = m.subject.trim() || "(no subject)";
  return { kind: "task", title: `Email: ${subject}`.slice(0, 200), day, notes: `From ${m.fromAddr}` };
}
