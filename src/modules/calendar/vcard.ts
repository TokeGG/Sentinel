// Pure vCard (2.1/3.0/4.0) import: FN/N, EMAIL, TEL, BDAY. Plus upcoming birthdays.
export type Contact = { name: string; emails: string; phones: string; birthday: string; notes: string };

const unfold = (t: string) => t.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "");
const unesc = (v: string) => v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

/** "19900215", "1990-02-15", "--0215", "--02-15" -> "YYYY-MM-DD" or "--MM-DD"; "" if unknown. */
export function normBday(v: string): string {
  const s = v.trim().slice(0, 10);
  let m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^--(\d{2})-?(\d{2})/.exec(s);
  return m ? `--${m[1]}-${m[2]}` : "";
}

export function parseVcards(text: string): Contact[] {
  const out: Contact[] = [];
  let cur: { fn: string; n: string; emails: string[]; phones: string[]; bday: string; note: string } | null = null;
  for (const line of unfold(text).split("\n")) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).split(";")[0].replace(/^item\d+\./i, "").toUpperCase();
    const val = line.slice(i + 1);
    if (key === "BEGIN" && /vcard/i.test(val)) cur = { fn: "", n: "", emails: [], phones: [], bday: "", note: "" };
    else if (!cur) continue;
    else if (key === "FN") cur.fn = unesc(val);
    else if (key === "N") cur.n = val.split(";").slice(0, 2).reverse().map(unesc).filter(Boolean).join(" ");
    else if (key === "EMAIL" && val.trim()) cur.emails.push(unesc(val));
    else if (key === "TEL" && val.trim()) cur.phones.push(unesc(val).replace(/^tel:/i, ""));
    else if (key === "BDAY") cur.bday = normBday(val);
    else if (key === "NOTE") cur.note = unesc(val);
    else if (key === "END" && /vcard/i.test(val)) {
      const name = cur.fn || cur.n || cur.emails[0] || "";
      if (name) out.push({ name, emails: cur.emails.join(", "), phones: cur.phones.join(", "), birthday: cur.bday, notes: cur.note });
      cur = null;
    }
  }
  return out;
}

/** Contacts with a birthday in the next `days` days (today included), soonest first, with the age when the year is known. */
export function upcomingBirthdays<T extends { name: string; birthday: string }>(list: T[], now: Date, days = 30) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out: { c: T; inDays: number; age: number | null }[] = [];
  for (const c of list) {
    const m = /^(\d{4}|-)-?(\d{2})-(\d{2})$/.exec(c.birthday);
    if (!m) continue;
    let next = new Date(today.getFullYear(), +m[2] - 1, +m[3]);
    if (next < today) next = new Date(today.getFullYear() + 1, +m[2] - 1, +m[3]);
    const inDays = Math.round((Date.UTC(next.getFullYear(), next.getMonth(), next.getDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86_400_000);
    if (inDays <= days) out.push({ c, inDays, age: m[1].length === 4 ? next.getFullYear() - +m[1] : null });
  }
  return out.sort((a, b) => a.inDays - b.inDays);
}
