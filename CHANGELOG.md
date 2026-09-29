# Changelog

## [1.3.3] - 2026-09-28

Local candidate: versioned-cache readiness, restricted-role hook and wrapper hardening, and deferred MCP protocol endpoint. See RELEASE_NOTES.md for verification limits.

## [1.3.2] - 2026-09-27

- Verifier reports are written incrementally to run-scoped evidence and tied to current task identity before completion.
- Stage checks use focused scopes and a compact digest; completion events replace active polling and guessed worker death.
- Role-aware hooks deny orchestrator product writes and verifier writes outside the report path when agent identity is present.
- Package version, runtime identity, and marketplace inventories are aligned; live host readiness remains pending.

## v1.3.1 — Surgical fix round (2026-09-24)

- Quote-aware execution intent: quoted or historical command mentions no
  longer grant execution authority; explicit start-work requests do.
- Reduced context-search process scans: blast-radius lookup uses one search
  process instead of four, and repository overview uses one import scan
  instead of candidate discovery plus repeated per-file scans. No coding-task
  speedup is inferred from that.
- Outcome integrity: task/budget/permission snapshots are checked against
  contained file bytes with task/criterion identity bound; reports distinguish
  absent, partial, and validated evidence; fixture-validation records are
  rejected as execution input.
- Measurement-scope telemetry: baseline runners emit
  `measurement_scope: fixture-validation`; an absent scope is unspecified and
  `execution` is a caller declaration, not proof.
- Isolation preservation contract: isolation reports namespace allocation
  truthfully (including untracked files and truthful allocation status), and
  release/recovery removes the task root only when empty, preserving a
  worktree recreated during cleanup.
- Verifier maintenance: package-boundary checks receive a minimum 180-second
  deadline, and the Python preflight keeps its real bounded-runner baseline
  without re-running the full verifier.
- Model routing documented: per-agent `model`/`thoughtLevel` routing, catalog
  and custom-model boundaries, and the `measurement_scope` discipline are now
  described in `docs/reference/model-routing.md`; v1.3.0 release notes are
  archived at `docs/v1.3.0-release-notes.md`.
- Documentation reflects v1.3.1 (install/readiness, evidence, security,
  verification, host matrix, host routes, runtime subsystems). Node.js LTS 24
  (recommended) or 22 is the documented prerequisite; LTS 20 remains accepted
  for compatibility.
- Native onboarding experience: `bash scripts/install.sh` (repository root)
  verifies Node.js/Git prerequisites, validates the marketplace layout, runs
  the load-check and package doctor, prints the exact ZCode UI steps with the
  absolute market root (clipboard-copied on macOS), optionally runs the
  durable lifecycle onboard with `--project`, and ends with
  `PACKAGE READINESS: full` / `HOST READINESS: PENDING`; guided
  `/lazy-onboard`, `/lazy-update`, and `/lazy-offboard` commands cover
  install, update, and receipt-safe removal. Command count 17 → 20.

## v1.3.0 — ZCode rename-port of LazyQoder v1.3.0 (2026-09-22)

- LazyZCode v1.3.0 is the ZCode port of LazyQoder v1.3.0 (lazyqoder → lazyzcode,
  Qoder host surfaces → ZCode host surfaces). The port is additive; shared
  family semantics remain byte-identical (LazyBuddy / LazyTrae / LazyQoder).
- ZCode-native plugin manifest: `.zcode-plugin/plugin.json` with the
  marketplace entry in `plugins/marketplace.json` (plugin identity
  `lazyzcode@lazyzcode`), declaring 19 skills, 17 commands, 13 agents,
  7 hook events, and 6 MCP server declarations.
- 7-event ZCode hook surface (`SessionStart`, `UserPromptSubmit`,
  `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PostToolUseFailure`,
  `Stop`) with context recovery moved to session-start recovery plus
  user-prompt-submit context-pressure markers.
- ZCode install route documented as the primary route
  (**Settings → Plugin Management → Discover → “+” → paste market root →
  Personal → Install**); `manual-skills-mcp-fallback` remains recovery-only.
- MCP profile gate via the plugin `mcp_mode` user setting
  (`LAZYZCODE_MCP_MODE`: direct / assisted / planned / orchestrated /
  long-horizon; empty defers the gate).
- v1.3.0 feature set carried over from LazyQoder: dual activation, milestone
  decision gates, human plan-edit reconciliation, the cross-plan decision
  ledger, and V0–V3 verification tiers with receipt reuse.

## v1.2.3 — Platform compatibility patch port (2026-09-15)

- Ported the LazyBuddy/LazyTrae v1.2.3 platform compatibility wave:
  MCP declaration validation (typed errors, spaces supported), actionable
  setup/load-check output, plan-format compatibility (`## TODOs` and legacy
  `## Todos`), zero-task plan failure with actionable errors, and the
  v1.2.3 supported-route documentation boundary.
- All package versions, contracts, and schemas bumped to 1.2.3.

## v1.2.2 — Full family parity port (2026-09-14, historical)

- Historical: brought LazyZCode to feature parity with LazyBuddy/LazyTrae v1.2.2
  (both released 2026-09-05): 44 contracts + 64 fixtures, 25-hook surface
  with lifecycle-event.js, 6-server MCP manifest with profile gating,
  113-script lifecycle/ subsystem, adaptive tooling family, v1.2.x docs
  (migration guides, supported routes, release notes), and the compact
  TASK/DELTA/REFS/VERIFY dispatch semantics in start-work/review-work.
- Manifest migrated to the officially documented `.zcode-plugin/plugin.json`
  location; previous version 1.2.2.
- Commands 14 → 17 (ported Trae's handoff, ralph-loop, stop-continuation).
- 3 agents gained the previous v1.2.2 fields (model/effort/maxTurns/memory/isolation).
- zcode-ide-surface adapters renamed for the documented ZCode CLI
  (`zcode`); host-gated and not executed at package-check time.
- Package readiness only: host registration, runtime loading, and MCP
  connection remain host-owned and unobserved.

All notable changes to LazyZCode are documented here. Versions follow
[Semantic Versioning](https://semver.org/).

## [0.0.1] - 2026-07-19

Initial development build of the LazySeries workflow harness for ZCode IDE.
Not yet published to any marketplace.

### Added

- 19 `lazy-` skills, 14 `lazy-` commands, 13 `lazyzcode-` agents, 12 hook
  events, and 8 local MCP server declarations (`run-ledger`, `verification`,
  `status-dashboard`, `context-graph`, `code-intel`, `docs`, `codegraph`,
  `lsp`).
- ZCode IDE host entry point at `plugins/lazyzcode/.zcode/plugin.json`.
- ZCode IDE capability mapping (RepoWiki, Quest, Agent mode + Subagents, Expert
  teams, Model selector, Agent-mode MCP) in `zcode-ide-integration.md`.
- Onboard/offboard guidance in `AGENTS.md`.
- 5 skills ported from LazyTrae: `lazy-ast-grep`, `lazy-coding-agent-sessions`,
  `lazy-frontend`, `lazy-report-bug`, `lazy-refactor`.

### Changed

- Renamed all references from "ZCode CN" to "ZCode IDE" (product rename).
- Repo root cleaned: all source consolidated into `plugins/lazyzcode/` (aligned
  with sibling ports LazyBuddy/LazyTrae).
- Read-only agents (explorer, reviewer, security-auditor, gate-reviewer,
  verifier) have `Bash` removed for native tool-boundary enforcement.

### Fixed

- MCP `CWD` env var missing in `.mcp.json`.
- Verification `discover_checks` returned raw array → wrapped in `{"checks": [...]}`.
- Scripts missing execute permissions.
- Subagent `model:` fields used invalid identifiers → removed (inherit session model).

### Verification

- `bash plugins/lazyzcode/scripts/lazyzcode-load-check.sh` → `PACKAGE_READINESS=full`
- `bash plugins/lazyzcode/scripts/lazyzcode-plugin-doctor.sh` → 64/64 pass
