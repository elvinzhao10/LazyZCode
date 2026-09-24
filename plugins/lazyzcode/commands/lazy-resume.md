---
description: "Resume the latest active LazyZCode run using the run-ledger MCP tools."
argument-hint: "[run_id]"
---

Use the `run-ledger` MCP server (auto-connected from the lazyzcode plugin) for this request.

$ARGUMENTS

# /lazy-resume

## Usage

/lazy-resume [run_id]

## What it does

Resumes latest active run using run-ledger MCP (`latest_run`, `read_state`, `summarize_run`). Loads task graph, checkpoints, and re-entry context.

## Success criteria

Active run loaded with full task context and last checkpoint position.

Do not claim completion without verification.
