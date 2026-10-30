# Changelog

## Unreleased 1.4.1 — verification, history and scale

The combined former 1.4.1 and 1.4.2 scope is implemented in this development branch. Package metadata and the published baseline remain **1.4.0**; this PR does not publish a release. Live-host acceptance is **deferred by the maintainer as of 2026-10-30**, and remains pending.

- Retain versioned verification scenarios, compare attempts by their source/criterion/plan subject, and promote an observed failure into an unverified regression scenario.
- Bind rerun review to the exact plan, criterion and captured source. Pending, rejected, stale and used approvals cannot authorize another native attempt; independent verification remains required.
- Inspect checkpoint/decision history through authenticated, paginated reads. Deduplicate identical runtime events with transactional recovery while retaining the original ledger and failed attempts.
- Preserve first-review plan bytes, correct legacy review-state updates, and harden owned-process cleanup against PID reuse and exit races.
- Reduce repeated replay and unnecessary review-source capture in measured local cases. These measurements do not establish whole-task latency, token or cost savings.

The read-only preparation helper no longer prints a fabricated WorkBuddy build. It renders package inputs and leaves host readiness pending. Marketplace registration, installation and a fresh-session receipt remain separate actions.

See the [1.4.1 completion record](docs/verification/1.4.1-completion.md).

## 2026-10-27 platform audit

Correct current dashboard provenance and the status-dashboard MCP inventory to seven tools, including `project`; retain six server declarations. Correct empty MCP mode guidance to the orchestrated default. Document ZCode 3.16.3 contracts and pending native-host acceptance. No new efficiency claim is made.

## [1.4.0] - 2026-10-19 — completion pass (isolation, rescan, repin)

Historical 2026-10-19 completion pass: the family-wide per-repo store isolation and foreign-runtime refusal matrix (8d45d22); the reconciled served-project truth stating the live git view explicitly (`/api/project/git`, 200 behind the session, vendored local collector; run-side links stay `repo_head`/`content_revision`) (48144e4); the conservative ZCode rescan outcome — capability observations refreshed, no unobserved capability claimed (72862c2) — with the pre-existing flaky node test phase (ajv bootstrap) stabilized (914b8b5); and the family repin at source revision `bb696092` — dashboard tree `e55a9c00…`, project tree `16561f3…` — carrying the family's completed project-dashboard UI (dark-first tokens v2, de-tabbed sidebar shell with in-place navigation, six redesigned views, navigation guards, held performance budgets) into this package byte-identically (4156dfa). Host embedding, chat handoff, and wake stay unobserved; host readiness stays pending; the `LAZYZCODE_MCP_MODE` gate is unchanged. See RELEASE_NOTES.md "Completion pass (2026-10-19)".

## [1.4.0] - 2026-10-07 — project platform

Adopt the family's persistent project platform through the ZCode-native adapter: the vendored `plugins/lazyzcode/shared/project/` family re-pins to tree `1feb5646…` (source revision `537f393`; its README no longer links files the family selection excludes and its CLI entry guard resolves symlinked invocation paths instead of silently no-oping), while ZCode's transactions, bounded producers, verifier publication, and MCP mode gate remain the owning surfaces. Complete the capability record with the three exercised project keys — `project_platform`, `project_source_editing`, and `project_telemetry`, each `available` exactly where the port gate exercised it — and add the no-observed-host-adoption assertion to the project-adapter suite (mutation-proven). The project context summary gains the explicit git-observation boundary: the vendored collectors are byte-pinned but wired to no ZCode-exposed route, and commit links stay run-side (`repo_head`/`content_revision`). Host embedding, chat handoff, and wake remain unobserved; host readiness stays pending. See RELEASE_NOTES.md.

## [1.4.0] - 2026-10-05

Historical dashboard introduction: vendor the family's shared dashboard core and document the ZCode-native adapter: an authenticated loopback service behind `cli.mjs start|status|open|stop`, a browser UI with Work/Verification/Plan-edit views, task inspector, evidence preview and queue planning (queue edits never start work), six status-dashboard MCP tools (`dashboard_service`, `copy_task_context`) guarded by the v133 direct JSON-RPC regression, an unchanged MCP profile gate (`LAZYZCODE_MCP_MODE`), and honest capability labels (embedding/chat handoff/wake unobserved; host readiness pending). See RELEASE_NOTES.md.

## [1.3.5] - 2026-10-02

Execute real runtime-floor and provider checks, bound hook input while preserving host refusal contracts, and update current platform guidance. Optional TypeScript LSP requires Node 22.22.2; the core lifecycle retains its separate Node 20 floor. See RELEASE_NOTES.md for patch details and pending native host acceptance.

## [1.3.4] - 2026-09-30

Transactional run and hook updates preserve concurrent changes. MCP tools use native content envelopes and isolate malformed requests. Lifecycle and native-host support boundaries are documented in RELEASE_NOTES.md; current-session host acceptance remains pending.

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
