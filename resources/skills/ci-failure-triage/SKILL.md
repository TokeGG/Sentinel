---
name: ci-failure-triage
description: Read failing CI or test output rows and point at the most likely cause and next step.
category: dev
---

# Ci failure triage

1. Find the first failing step or test in the output rows.
2. Quote the error line and the file or test name.
3. Separate the root error from follow-on failures.
4. Suggest one next step (rerun, fix a test, update a dependency).
5. Do not change code; this is a reading task.
