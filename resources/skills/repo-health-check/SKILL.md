---
name: repo-health-check
description: Give a quick health view of a repository: open PRs, stale issues, CI state and uncommitted work.
category: dev
---

# Repo health check

1. Read the repo rows: PRs, issues, CI status, git status.
2. List PRs older than 14 days and issues with no activity in 30.
3. Note failing CI and uncommitted or unpushed changes.
4. Suggest three small housekeeping actions.
5. Cite rows; take no action without a confirm.
