---
description: "Create a new LazyZCode run using the run-ledger MCP tools."
argument-hint: "<objective> [--plan <plan_file>]"
---

Use the `run-ledger` MCP server (auto-connected from the lazyzcode plugin) for this request.

$ARGUMENTS

# /lazy-new-run

## Usage

/lazy-new-run <objective> [--plan <plan_file>]

## What it does

Creates a new run with run-ledger MCP (`create_run`) and initializes state.json + events.jsonl + plan.md.

## Success criteria

New run created with unique run_id, initialized state, and populated plan.md.

Do not claim completion without verification.
