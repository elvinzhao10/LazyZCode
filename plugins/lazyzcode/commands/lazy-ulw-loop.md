---
description: "Verified completion loop for open-ended tasks. Creates goals with binding success criteria, decomposes into evidence-bound steps, runs until all criteria have real-surface proof. Manages goal state in .lazyzcode/ulw-loop/."
argument-hint: "<task>"
skills: lazy-ulw-loop
---

Use the `lazy-ulw-loop` skill for this request.

$ARGUMENTS

# /lazy-ulw-loop

Verified completion loop for open-ended tasks. Creates binding goals with success criteria, decomposes into evidence-bound steps, and iterates until every criterion has verified proof. Delegates implementation waves to `/lazy-start-work` when needed.

## ZCode mapping

LazyZCode's verified-completion loop maps to the **ZCode Agent tool** (parallel subagent dispatch) with the plugin's auto-connected MCP servers for run bookkeeping. The `lazy-ulw-loop` goal/evidence bookkeeping layers binding verification on top of ZCode subagent execution.

## Usage

```
/lazy-ulw-loop "task" [--completion-promise=TEXT] [--strategy=reset|continue]
```

## Inputs

- Task description (natural language)
- Completion promise (binding success criteria, optional)
- Strategy: `reset` (fresh start) or `continue` (resume from `.lazyzcode/ulw-loop/` state)
- Workspace context via `zcode.md`

## Outputs

- `.lazyzcode/ulw-loop/goals.json` — binding success criteria
- `.lazyzcode/ulw-loop/evidence.jsonl` — per-goal evidence log
- Completed work artifacts (via delegated `/lazy-start-work` waves)
- Final evidence report showing every criterion met

## Success Criteria

1. All success criteria have verified evidence
2. Evidence is self-contained (another agent can re-verify from the evidence alone)
3. No evidence claim without an observed value
4. Iteration cap respected (100 normal, 500 ultrawork)

## Constitution

This command is governed by its package-local skill contract below.

Do not claim completion without verification.

## Skill

See `../skills/lazy-ulw-loop/SKILL.md` for the full workflow logic, goal creation protocol, evidence binding rules, and iteration management.
