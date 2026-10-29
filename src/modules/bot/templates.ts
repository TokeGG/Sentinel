// Goal templates for the Run box: pick one, fill the blank, get a clear goal the planner understands. Pure.
export interface GoalTemplate { id: string; label: string; blank: string; goal: string }

export const GOAL_TEMPLATES: readonly GoalTemplate[] = [
  { id: "prices", label: "Check prices of...", blank: "product", goal: "Check the current price of {x} on two or three well-known shops. Report each shop, price and link. Do not buy anything." },
  { id: "deals", label: "Find deals on...", blank: "product", goal: "Find current deals or discounts on {x}. Report up to five offers with price, seller, link and how recent they are. Do not buy or sign in." },
  { id: "summary", label: "Summarise this page", blank: "page address", goal: "Go to {x} and summarise the page in five short bullet points, with the page title. Do not click ads or sign in." },
  { id: "form", label: "Fill this form", blank: "form address + what to enter", goal: "Fill in the form at {x}. Leave any field you were not given empty. Do NOT submit: stop and say done when the fields are filled so the user can check." },
  { id: "lookup", label: "Look up a fact", blank: "question", goal: "Find a reliable answer to: {x}. Give the answer and the page it came from." },
];

/** The goal text for a template and the user's value (empty value = null, nothing to run). */
export function fillTemplate(id: string, value: string): string | null {
  const t = GOAL_TEMPLATES.find((g) => g.id === id);
  const v = value.trim().slice(0, 500);
  return t && v ? t.goal.replace("{x}", v) : null;
}
