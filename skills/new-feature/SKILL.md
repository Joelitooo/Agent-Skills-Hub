---
name: new-feature
description: Gathers new-feature requirements, consistency-checks answers with a subagent, then writes an end-to-end implementation plan markdown file. Use only when the user explicitly invokes this skill or asks to run the new-feature skill.
license: MIT
disable-model-invocation: true
---

# New Feature

Turn a feature idea into a complete implementation plan. Do **not** implement code, open PRs, or start coding after the plan is written.

## Workflow

Copy and track:

```
- [ ] 1. Ask the intake questions (wait for a full reply)
- [ ] 2. Confirm where to write the plan file
- [ ] 3. Run the consistency subagent
- [ ] 4. Clarify incongruences with the user (loop until resolved)
- [ ] 5. Write the plan markdown file
- [ ] 6. Stop
```

### 1. Intake

Ask **all** questions in **one** message. Do not start planning, exploring the codebase, or spawning subagents until the user has answered.

Use `AskQuestion` for closed-ended items when that tool is available. Use a numbered list for freeform answers. If the user already answered some items in the same message that invoked this skill, do not re-ask those; ask only what is missing.

**Required questions (use this wording verbatim):**

1. Description of the feature.
2. What does this new feature require tech wise (frontend, backend, infrastructure, db).
3. List of requirements.
4. Is tracking needed?

**Additional questions:**

5. What should we call this feature (short name / slug)?
6. Who is it for, and what problem does it solve?
7. How will we know it works (success criteria / acceptance checks)?
8. What is explicitly out of scope?
9. Auth, roles, or permissions — any change?
10. Data: new entities, fields, migrations, retention, or PII?
11. UX: new screens, flows, empty/error states, or reuse of existing UI?
12. Rollout: feature flag, environments, migration of existing users/data?
13. Constraints: deadline, must-use libraries, APIs, or systems we cannot touch?
14. Docs: which docs, runbooks, or API references must be updated?
15. Testing: unit, integration, e2e, and/or browser verification — any mandated coverage?
16. Where should the plan markdown file be written? (path relative to the repo root, or an absolute path)

If tracking is **yes**, also ask:

- Which events, properties, and tools (e.g. analytics, feature-flag exposure, logs)?
- Who consumes the data, and is it required for launch?

If a layer in question 2 is **no** / unused, still ask whether that is intentional when later answers imply that layer (the subagent will catch this too).

### 2. Plan path

If question 16 is unanswered, ask for the output path before writing any file. Do not invent a default path. Create parent directories only as needed for the path the user gave.

### 3. Consistency subagent

After answers are in, launch **one** `Task` subagent (`subagent_type`: `generalPurpose`, `run_in_background`: false). Do not implement the feature in the parent or the subagent.

**Subagent prompt must include:**

- The feature description (question 1) as the source of truth for intent
- The full Q&A (verbatim user answers)
- Instructions to **only** return a structured consistency report — no plan file, no code edits

**The subagent must check for incongruences such as:**

- Requirements that the description does not mention (scope creep or missing description)
- Description promises that no requirement covers
- Tech layers (frontend / backend / infrastructure / db) that contradict persistence, APIs, UI, or deploy needs in the requirements
- Tracking marked no while requirements or success criteria imply analytics, funnels, or instrumentation
- Tracking marked yes with no events/properties
- Out of scope that overlaps in-scope requirements
- Auth/PII/data answers that conflict with the described user flow
- Success criteria that cannot be tested given the stated testing/docs/rollout answers
- Missing layers or work (e.g. “API only” but a new screen is described)

**Required subagent output shape:**

```markdown
## Consistency report
Verdict: consistent | needs-clarification

### Incongruences
- ID: [short-id]
  Conflict: [what disagrees with what]
  Why it matters: [implementation risk]
  Question to ask the user: [one concrete clarifying question]

### Gaps (non-blocking unless they change scope)
- [gap]

### Assumed consistent
- [item]
```

If the subagent returns `consistent` and no incongruences, continue to step 5.

### 4. Clarification loop

If verdict is `needs-clarification`:

1. Ask the user **only** the clarifying questions from the report (plus any gap that would change the plan).
2. Merge new answers into the Q&A.
3. Re-run the consistency subagent with the **updated** Q&A.
4. Repeat until `consistent`, or the user explicitly says to proceed despite remaining issues (then record those issues in the plan under Open questions).

Cap at **3** subagent rounds. After 3, list remaining incongruences, ask the user whether to proceed, and only then write the plan.

### 5. Write the plan

Explore the codebase as needed so the plan names real files, APIs, and patterns. The plan must be enough for another engineer (or agent) to implement the feature end-to-end **without** this chat.

Follow [plan-template.md](plan-template.md). Fill every section; use `N/A — [reason]` instead of deleting sections.

Write the file to the path from step 2. Do not commit unless the user asks.

### 6. Stop

Tell the user the plan path. Summarize remaining open questions in one short list. Do **not** start implementation.
