# Skills and MCP hub — requirements (to be designed with the user)

Status: requirements captured, design interview pending. Part of the bot/agent work (sub-project 4 in `2026-10-28-core-shell-design.md`).

## User requirements
- Add **skills** and **MCP servers** from GitHub directly inside the app (paste a repo URL or pick from a list) and **use them right away**, without restarting.
- Bundled skill packs per module (pentest skills, deal and news search skills) ship inside the app.
- Skills and MCP tools are usable by the browser bot and by module panels.
- The bot learns from mistakes and from material the user feeds it (shared learning kernel with the mmoarena bot).
- No cloud model and no API key: the agent runs on a local model.

## Security stance (non-negotiable, informs the design)
- Installing a skill or MCP server means running code or prompts from the internet. Nothing installs or starts without an explicit user confirmation that shows: the repo, the **pinned commit SHA**, the files that will be added, and for MCP the exact command and arguments that will be run.
- Skills are text (instructions, prompts, small scripts): installed as inert files; scripts run only through a user-approved runner.
- MCP servers are separate processes: started only when the user switches them on (no background task without opt-in), stopped on app exit and in game mode, with environment secrets taken from the OS keychain only.
- Pin to a commit; updates are an explicit action that shows the diff. No auto-update.
- Anything pentest-related stays behind the engagement scope gate (`src/modules/pentest/scope.ts`), including tools exposed through MCP or skills.
- All fetches go to github.com / raw.githubusercontent.com only (allow-list), over https.

## Open questions for the interview
1. MCP servers are usually launched with `npx`, `uvx` or a binary: should the app require Node/Python to be installed, or bundle a runtime?
2. Which skill format(s): Claude-style `SKILL.md` folders only, or others?
3. Where do installed skills and MCP tools show up: a Skills panel with enable/disable per item, plus per-module bundles?
4. How should the local model be chosen (Ollama model list), and which tool-calling quality is acceptable?
5. What is "put to use right away": the bot sees the new tool in its next step, and the module panel shows a button for it?
