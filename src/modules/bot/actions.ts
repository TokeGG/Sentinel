// The browser bot's action vocabulary, observation and episode shapes. Pure types + the irreversible set.
export type Action =
  | { type: "click" | "submit" | "purchase" | "delete" | "login"; target: string }
  | { type: "type"; target: string; text: string }
  | { type: "press"; key: string }
  | { type: "scroll"; dir: "up" | "down" }
  | { type: "goto"; url: string }
  | { type: "wait" }
  | { type: "tool"; server: string; name: string; args: Record<string, unknown> }
  | { type: "done"; result: string }
  | { type: "fail"; reason: string };

export type ActionType = Action["type"];
export const ACTION_TYPES: readonly ActionType[] = ["click", "submit", "purchase", "delete", "login", "type", "press", "scroll", "goto", "wait", "tool", "done", "fail"];

/** Actions that cannot be undone: the user must approve them unless pre-approved for this run. */
export const IRREVERSIBLE: ReadonlySet<ActionType> = new Set(["submit", "purchase", "delete", "login"]);
export const isIrreversible = (a: Action) => IRREVERSIBLE.has(a.type);

export interface PageElement { id: string; role: string; text: string; visible: boolean }
export interface Observation { url: string; title: string; text: string; elements: PageElement[]; hash: string }
export interface ActionResult { ok: boolean; error?: string; changed: boolean; timedOut?: boolean; /** Text the action produced (a tool's reply); shown to the model as data. */ output?: string }

export interface BrowserDriver {
  observe(): Promise<Observation>;
  act(action: Action): Promise<ActionResult>;
}

/** Stable text key for an action (loop detection, logs). */
export const actionKey = (a: Action): string => JSON.stringify(a);

export interface Step {
  obs: string; // observation hash
  action: Action | null; // null = the model's answer was refused (never executed)
  ok: boolean;
  error?: string;
  changed: boolean;
  timedOut?: boolean;
  retries?: number;
  output?: string;
}
export type Outcome = "done" | "failed" | "maxSteps" | "timeout" | "loop" | "cancelled" | "denied";
export interface Episode {
  goal: string;
  variantId?: string;
  steps: Step[];
  outcome: Outcome;
  maxSteps: number;
  thumbs?: "up" | "down";
  startedAt: number;
  endedAt: number;
  result?: string;
}

/** Actions that should change the page when they work. */
export const CLICKY: ReadonlySet<ActionType> = new Set(["click", "submit", "purchase", "delete", "login"]);
/** Error text of a click that changed nothing under strict verification (mistakes.ts classifies on it). */
export const NO_CHANGE = "no page change after action";
