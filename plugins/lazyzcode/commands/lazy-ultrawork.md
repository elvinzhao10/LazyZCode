---
description: "Activate binding ultrawork mode for maximum-precision tasks. Tier triage (LIGHT/HEAVY), the PIN→RED→GREEN→SURFACE→CLEAN execution loop, binding reviewer gate, and Manual-QA channel discipline. Use when the task needs evidence-grade rigor."
argument-hint: "<task>"
skills: lazy-ultrawork
---

Use the `lazy-ultrawork` skill for this request.

$ARGUMENTS

# /lazy-ultrawork

Activates binding ultrawork mode: tier triage classifies the work as LIGHT or HEAVY, then the PIN→RED→GREEN→SURFACE→CLEAN loop executes with evidence capture at every step. A binding reviewer gate (HEAVY only) requires unconditional approval before completion.

## ZCode mapping

LazyZCode's binding review gate maps to an **isolated Agent tool subagent** dispatched in parallel (Expert teams → parallel Agent dispatch); durable execution uses the ZCode Agent tool with TodoWrite/TodoRead tracking. The `lazy-ultrawork` HEAVY-tier binding reviewer is realized by an isolated ZCode subagent, never the executor.

## Usage

```
/lazy-ultrawork "task description"
```

## Inputs

- Task description (natural language)
- Workspace context via `zcode.md`
- Existing tests, lint, and build scripts (discovered by the skill)

## Outputs

- Implemented change (production code + tests)
- `.lazyzcode/runs/<run_id>/evidence/` — real-surface proof artifacts
- Binding reviewer verdict (APPROVE / REJECT) for HEAVY-tier work
- Cleanup receipts for all QA resources

## Success Criteria

1. Tier correctly classified (LIGHT or HEAVY) with supporting facts
2. PIN step captured existing behavior before changes
3. RED step produced a failing-first proof
4. GREEN step made the proof pass with minimal production code
5. SURFACE step captured a real-surface artifact (not `--dry-run`)
6. CLEAN step tore down all QA resources with receipts
7. For HEAVY: binding reviewer returned unconditional APPROVE
8. All success standards met before claiming done

## Constitution

This command is governed by its package-local skill contract below.

Do not claim completion without verification.

## Skill

See `../skills/lazy-ultrawork/SKILL.md` for the full workflow logic, tier triage rules, execution loop, Manual-QA channel taxonomy, and binding reviewer gate.
