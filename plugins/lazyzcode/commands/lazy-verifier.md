---
description: "Verify evidence independently. Discover available checks, run them with exact commands, reproduce Manual-QA, probe adversarial classes, and issue confirmed/false-positive/needs-fix/needs-human-review verdicts with confidence scores. Must be independent from executor."
argument-hint: "[task-id]"
skills: lazy-verifier
---

Use the `lazy-verifier` skill for this request.

$ARGUMENTS

# /lazy-verifier

Independent evidence verification. Runs the exact verification commands a worker claims to have run, reproduces the Manual-QA scenario, probes every applicable adversarial class, and issues a verdict with a confidence score. Never the same agent as the executor.

## ZCode mapping

LazyZCode's independent verification primitive maps to an **isolated Agent tool subagent** (Expert teams → parallel Agent dispatch). The `lazy-verifier` adversarial probe is run by an isolated ZCode subagent, never the executor.

## Usage

```
/lazy-verifier [task-id] [--adversarial=all|class1,class2]
```

## Inputs

- DoneClaim to verify (task, changed_files, tests, manual_qa, cleanup, risks)
- Plan reference and acceptance criteria
- Evidence ledger from `.lazyzcode/runs/<run_id>/events.jsonl`

## Outputs

- AdversarialVerify verdict JSON:
  - `verdict`: confirmed | false-positive | needs-fix | needs-human-review
  - `confidence`: 0.0-1.0
  - `evidence`: command + results
  - `adversarial_classes`: class-by-class probe results

## Success Criteria

1. All claimed tests run and produce identical results
2. Manual-QA reproduced successfully
3. All applicable adversarial classes probed (9 classes for HEAVY-tier work)
4. Verdict is clear with confidence score
5. Evidence is self-contained for re-verification

## Constitution

This command is governed by its package-local skill contract below.

Do not claim completion without verification.

## Skill

See `../skills/lazy-verifier/SKILL.md` for the full verification protocol, adversarial class definitions, confidence scoring, and the AdversarialVerify schema.
