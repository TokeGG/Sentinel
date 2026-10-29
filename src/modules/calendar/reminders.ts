// Pure reminder rules: which are due now, snooze times. due_at is local "YYYY-MM-DDTHH:MM".
export type Reminder = { id: number; title: string; due_at: string; done: number };

const p2 = (n: number) => String(n).padStart(2, "0");
export const localStamp = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;

/** Open reminders whose time has come, oldest first. */
export const dueReminders = (list: Reminder[], now: Date) =>
  list.filter((r) => !r.done && r.due_at <= localStamp(now)).sort((a, b) => a.due_at.localeCompare(b.due_at));

/** New due_at for "snooze N minutes" from now. */
export const snoozeTo = (now: Date, minutes: number) => localStamp(new Date(now.getTime() + minutes * 60_000));

export const SNOOZES = [5, 10, 60];

/** Validates the add form; returns the stored due_at or throws. */
export function reminderDue(day: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Pick a date and time");
  return `${day}T${time}`;
}
