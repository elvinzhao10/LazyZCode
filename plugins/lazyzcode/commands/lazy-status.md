---
description: "Show current LazyZCode run status using the status-dashboard MCP tools."
argument-hint: "[run_id]"
---

Use the `status-dashboard` MCP server (auto-connected from the lazyzcode plugin) for this request.

$ARGUMENTS

# /lazy-status

## Usage

/lazy-status [run_id]

## What it does

Uses status-dashboard MCP tools (`show_run_status`, `show_task_graph`, `show_verification_matrix`)

## Success criteria

Run status displayed with task progress, verification gates, parity coverage.

Do not claim completion without verification.
