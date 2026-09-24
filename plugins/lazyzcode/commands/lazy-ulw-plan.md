---
description: "Create a decision-complete work plan. Explores, researches, writes a plan to .lazyzcode/plans/. Never writes product code. Produces plans consumed by /lazy-start-work."
argument-hint: "<idea>"
skills: lazy-ulw-plan
---

Use the `lazy-ulw-plan` skill for this request.

$ARGUMENTS

# /lazy-ulw-plan

Create a decision-complete work plan. The planner explores the codebase, researches unknowns, evaluates alternatives, and writes a structured plan. Never writes product code — planning only.

## ZCode mapping

LazyZCode's decision-complete planning primitive maps to the **/lazy-ulw-plan** command backed by the ZCode Skill tool (auto-triggered from the plugin skill catalog). The `lazy-ulw-plan` skill produces an explicit, human-reviewable plan document under `.lazyzcode/plans/` that ZCode subagents execute via the Agent tool.

## Usage

```
/lazy-ulw-plan "what to build"
```

## Inputs

- User's build request (natural language description)
- Workspace context (`zcode.md`, project structure, existing plans)
- Codebase state (via explorer subagents)

## Outputs

- Plan file written to `.lazyzcode/plans/<slug>.md`
- Decision log with alternatives considered and rationale
- Task decomposition with dependency graph

## Success Criteria

1. Plan file written and self-contained
2. Every decision has a documented rationale
3. Task decomposition is granular and dependency-ordered
4. Approval gate presented (awaits user "approved" or `/lazy-start-work`)

## Constitution

This command is governed by its package-local skill contract below.

Do not claim completion without verification.

## Skill

See `../skills/lazy-ulw-plan/SKILL.md` for the full workflow logic, exploration phases, decision framework, and planner constraints.
