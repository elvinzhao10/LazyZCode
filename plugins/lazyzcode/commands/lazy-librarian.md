---
description: "Maintain memory and documentation. Keep current package documentation and project memory accurate after accepted component changes."
argument-hint: "[--scope]"
skills: lazy-librarian
---

Use the `lazy-librarian` skill for this request.

$ARGUMENTS

# /lazy-librarian

Memory and documentation maintenance agent. Updates current package documentation and project memory after every accepted change. Ensures documentation stays consistent and authoritative.

## ZCode mapping

LazyZCode's memory/doc maintenance complements **AGENTS.md** (the project-memory file ZCode injects into every session). The `lazy-librarian` keeps the curated `zcode.md` project memory and package docs authoritative on top of the workspace `AGENTS.md`.

## Usage

```
/lazy-librarian [--scope=all|index|parity|gaps|memory]
```

## Inputs

- Current state of all docs in `docs/`
- Current skill, command, agent, and hook registrations in plugin manifest
- Latest implementation evidence and package checks
- Version changelog for the current release

## Outputs

- Updated package documentation and retained root guidance (`README.md`, `AGENTS.md`, and `zcode.md`) with relevant changes
- Updated project memory (`zcode.md`) if structural changes warrant

## Success Criteria

1. Current documentation matches actual implementation state
2. Handoff material identifies the authoritative package sources
3. Cross-references between tracked docs are consistent

## Constitution

This command is governed by its package-local skill contract below.

Do not claim completion without verification.

## Skill

See `../skills/lazy-librarian/SKILL.md` for the full maintenance protocol, doc consistency checks, and parity verification procedure.
