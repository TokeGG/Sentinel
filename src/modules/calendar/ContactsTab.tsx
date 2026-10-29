// Contacts: vCard (.vcf) import (preview first), list, upcoming birthdays.
import { useRef, useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { ErrorLine, Row } from "../../ui/kit";
import { useStore } from "../../ui/useStore";
import { addContacts, deleteContact, listContacts } from "./extraStore";
import { parseVcards, upcomingBirthdays, type Contact } from "./vcard";

export function ContactsTab() {
  const s = useStore(listContacts, []);
  const [pending, setPending] = useState<Contact[] | null>(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const pick = useRef<HTMLInputElement>(null);
  const soon = upcomingBirthdays(s.data, new Date(), 30);
  const shown = s.data.filter((c) => `${c.name} ${c.emails} ${c.phones}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="cal-form">
      <div className="ui-controls">
        <input type="search" placeholder="Search contacts…" value={q} onChange={(e) => setQ(e.target.value)} />
        <input ref={pick} type="file" hidden accept=".vcf,text/vcard" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setPending(parseVcards(await f.text())); }} />
        <button type="button" className="ui-btn" onClick={() => pick.current?.click()}>Import .vcf</button>
        {msg && <span className="ui-meta" role="status">{msg}</span>}
      </div>
      {pending && (
        <div className="ui-banner">
          {pending.length} contact(s) in the file: {pending.slice(0, 5).map((c) => c.name).join(", ")}{pending.length > 5 ? "…" : ""}
          <button type="button" className="ui-btn primary" onClick={() => void s.act(async () => { setMsg(`Added ${await addContacts(pending)}`); setPending(null); })}>Import</button>
          <button type="button" className="ui-btn" onClick={() => setPending(null)}>Cancel</button>
        </div>
      )}
      {s.error && <ErrorLine message={s.error} />}
      <h3 className="cal-day">Birthdays in the next 30 days · {soon.length}</h3>
      {soon.map(({ c, inDays, age }) => <span key={c.id} className="ui-meta">{c.name}: {inDays === 0 ? "today" : `in ${inDays} day(s)`}{age ? `, turns ${age}` : ""}</span>)}
      <h3 className="cal-day">Contacts · {s.data.length}</h3>
      {shown.map((c) => (
        <Row key={c.id} end={<ConfirmButton label="Delete" className="ui-btn ui-sm" onConfirm={() => void s.act(() => deleteContact(c.id))} />}>
          <strong>{c.name}</strong> <span className="ui-meta">{[c.emails, c.phones, c.birthday].filter(Boolean).join(" · ")}</span>
        </Row>
      ))}
    </div>
  );
}
