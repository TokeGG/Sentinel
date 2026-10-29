---
name: code-review-checklist
description: Review a code change (diff or pull request page) with a practical checklist: correctness, tests, security, readability.
module: hub.github
category: dev
---

# Code review checklist

1. Read the description and the diff. State in one line what the change is meant to do.
2. Correctness: edge cases (empty, null, large, concurrent), error handling, off-by-one, resource cleanup.
3. Tests: is the new behaviour tested? Is a failing path tested? Name the missing test.
4. Security: input validation, secrets in code or logs, injection (SQL, shell, HTML), permissions.
5. Readability: naming, function size, dead code, comments that explain why.
6. Output findings ordered by severity (must fix / should fix / nit), each with file, line and a suggested fix. Never approve or merge on the user's behalf.
