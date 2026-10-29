---
name: changelog-writer
description: Turn commit or PR rows into a short, user-facing changelog grouped by type.
category: dev
---

# Changelog writer

1. Read commit messages or PR titles for the range.
2. Group into Added, Changed, Fixed, Removed.
3. Rewrite each in plain words for users; drop internal chores.
4. Keep each entry to one line.
5. Return Markdown ready to paste.
