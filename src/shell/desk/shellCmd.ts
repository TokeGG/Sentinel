// Any webview -> main window: shell commands travel as one event so only the
// main window touches layout state. Main also listens to its own emits.
import { emit } from "@tauri-apps/api/event";
import type { ShellCmd } from "./keymap";
import { SHELL_CMD } from "./ids";

export const sendCmd = (c: ShellCmd): Promise<void> => emit(SHELL_CMD, c);
export type { ShellCmd };
