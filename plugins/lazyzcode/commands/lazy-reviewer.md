---
description: "Review the implementation across 5 dimensions: correctness, code quality, security, design coherence, and context completeness. Issue PASS/FAIL/INCONCLUSIVE per dimension with actionable findings."
argument-hint: "[--dimensions] [--files]"
skills: lazy-reviewer
---

Use the `lazy-reviewer` skill for this request.

$ARGUMENTS

# /lazy-reviewer

Multi-dimensional code and design reviewer. Reviews implementation across 5 independent dimensions: correctness, code quality, security, design coherence, and context completeness. Each dimension issues a PASS/FAIL/INCONCLUSIVE verdict with specific, actionable findings.

## ZCode mapping

LazyZCode's multi-dimensional review primitive maps to **parallel Agent tool dispatch** (Expert teams → one Agent tool subagent per dimension lane). The `lazy-reviewer` dimensions correspond to independently dispatched ZCode review subagents.

## Usage

```
/lazy-reviewer [--dimensions=all|correctness,security,...] [--files=<glob>]
```

## Inputs

- Changed files (diff against base or plan scope)
- Plan reference and acceptance criteria
- Implementation evidence from `.lazyzcode/runs/<run_id>/`

## Outputs

- Per-dimension verdict: PASS | FAIL | INCONCLUSIVE
- Actionable findings with file:line references
- Aggregate verdict (all 5 must PASS)

## Success Criteria

1. All 5 dimensions have a terminal verdict
2. Every FAIL includes a specific, actionable finding
3. Every INCONCLUSIVE documents what's missing
4. Findings reference exact file:line locations

## Constitution

This command is governed by its package-local skill contract below.

Do not claim completion without verification.

## Skill

See `../skills/lazy-reviewer/SKILL.md` for the full review protocol, per-dimension criteria, review evidence format, and the review framework.
