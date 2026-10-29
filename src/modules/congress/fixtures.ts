// Small hand-written samples shaped like GovTrack API v2 responses (tests only; no network).
export const BILLS = {
  meta: { limit: 3, total_count: 3 },
  objects: [
    {
      id: 101, congress: 119, bill_type: "house_bill", display_number: "H.R. 1234", title: "H.R. 1234: Clean Water Act of 2026",
      title_without_number: "Clean Water Act of 2026", current_status: "pass_over_house", current_status_label: "Passed House",
      current_status_date: "2026-10-20", introduced_date: "2026-03-01", link: "https://www.govtrack.us/congress/bills/119/hr1234",
      sponsor: { id: 400001, name: "Rep. Jane Doe [D-CA12]" },
      major_actions: [["2026-03-01T00:00:00", 1, "introduced", "Introduced"], ["2026-10-20T00:00:00", 3, "pass_over_house", "Passed House"]],
    },
    { id: 102, congress: 119, display_number: "S. 55", title: "S. 55: A bill", current_status: "prov_kill_suspensionfailed", current_status_date: "2026-09-01T00:00:00", sponsor_role: { person: { name: "Sen. Sam Roe [R-TX]" } }, link: "javascript:alert(1)" },
    { id: 103, title: "no id fields besides", display_number: "H.R. 9" },
    { title: "missing id" },
    "junk",
  ],
};
export const VOTES = {
  objects: [
    { id: 9001, chamber: "house", question: "On Passage: H.R. 1234", result: "Passed", created: "2026-10-20T15:04:00", total_plus: 230, total_minus: 200, total_other: 5, related_bill: { display_number: "H.R. 1234" }, link: "https://www.govtrack.us/congress/votes/119-2026/h300" },
    { id: 9002, chamber: "senate", category_label: "Nomination", result: "Confirmed", created: "2026-10-21", total_plus: 51, total_minus: 49, related_bill: null },
    { chamber: "house", question: "no id" },
  ],
};
export const ROLES = {
  objects: [
    { role_type: "senator", party: "Independent", state: "vt", district: null, title_long: "Senator", person: { id: 400003, name: "Sen. Bernard Sanders [I-VT]", link: "https://www.govtrack.us/congress/members/bernard_sanders/400003" } },
    { role_type: "representative", party: "Democrat", state: "CA", district: 12, person: { id: 400001, name: "Rep. Jane Doe [D-CA12]" } },
    { role_type: "representative", party: "Republican", state: "TX", person: { id: 400009, name: "Rep. Joe Roe [R-TX2]" } },
    { role_type: "senator", person: {} },
  ],
};
