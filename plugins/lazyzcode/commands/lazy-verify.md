---
description: "Run LazyZCode verification checks using the verification MCP tools."
argument-hint: "[run_id] [--gate <gate_name>]"
---

Use the `verification` MCP server (auto-connected from the lazyzcode plugin) for this request.

$ARGUMENTS

# /lazy-verify

## Usage

/lazy-verify [run_id] [--gate <gate_name>]

## What it does

Uses verification MCP tools (`discover_checks`, `run_check`, `record_gate_result`) to execute verification gates for current run.

## Success criteria

All verification gates executed; gate results recorded with pass/fail/repair status.

Do not claim completion without verification.
