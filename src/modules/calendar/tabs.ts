// Calendar panel tabs: each groups customize section ids (panelLogic.calendarSections).
import type { TabDef } from "../../ui/sectionTabsLogic.ts";

export const EXTRA_SECTIONS = [
  { id: "views", label: "Month / week / day / agenda views" },
  { id: "reminders", label: "Reminders" },
  { id: "habits", label: "Habits" },
  { id: "focus", label: "Focus timer" },
  { id: "contacts", label: "Contacts and birthdays" },
  { id: "money", label: "Expenses and subscriptions" },
  { id: "bookmarks", label: "Bookmarks / read later" },
];

export const CAL_TABS: TabDef[] = [
  { id: "agenda", label: "Agenda", sections: ["add", "overdue", "today", "week", "tasks", "ics"] },
  { id: "views", label: "Calendar", sections: ["views"] },
  { id: "reminders", label: "Reminders", sections: ["reminders"] },
  { id: "habits", label: "Habits", sections: ["habits"] },
  { id: "focus", label: "Focus", sections: ["focus"] },
  { id: "contacts", label: "Contacts", sections: ["contacts"] },
  { id: "money", label: "Money", sections: ["money"] },
  { id: "bookmarks", label: "Read later", sections: ["bookmarks"] },
];
