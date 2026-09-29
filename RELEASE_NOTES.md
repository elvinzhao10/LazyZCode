# LazyZCode v1.3.3 — reliability and release consistency

**Status:** local release candidate. Package, lifecycle, language, and publication checks passed locally; fresh ZCode activation and release publication have not been observed.

## Eval-driven fixes

- Versioned plugin cache roots use native ZCode variables, with bounded path and manifest checks. Restricted-role hooks reject conflicting identities, malformed or oversized mutating input, and unrestricted shell dispatch.
- Execution context rejects unsupported shell wrappers before dispatch. Deferred optional MCP servers retain a protocol endpoint and invalid profile values fail explicitly.

## Measured efficiency

No token, latency, or cost improvement has been measured for this patch.

## Host capability matrix

Package checks exercise the ZCode plugin route. Fresh host activation and MCP behavior still require observation on a recorded build and session.

## Migration and upgrade

Update from v1.3.2 through the normal host route. Preserve caller state and verify installed package identity.

## Known risks

Role enforcement depends on trusted host identity and an explicitly restricted run. Package checks do not establish host sandboxing or live connection health.

## Rollback

Use lifecycle rollback to the prior verified v1.3.2 release while preserving run evidence and caller state.

## Prior release notes

# LazyZCode v1.3.2 — durable verification handoff

**Status:** v1.3.2 release. Source, publication, and six GitHub Actions CI jobs passed for the merged candidate. Fresh ZCode activation remains pending; package verification alone does not establish host readiness.

## Eval-driven fixes

- The verifier contract writes a run-scoped, revision-bound report as checks finish; the orchestrator contract blocks a verdict when that report is missing, incomplete, or stale. Generic completion APIs do not yet enforce this report format.
- The orchestrator contract requires focused checks between stages, one full matrix at closure, a compact run digest, and completion events instead of active polling. It forbids duplicate dispatch while owned paths or evidence are changing.
- Where the host supplies agent identity, the PreToolUse hook denies an orchestrator Write/Edit outside its own state directory. Host payloads without identity still require the agent contract to enforce this boundary.

## Measured efficiency

The B3 postmortem identifies repeated whole-suite verification and polling as major token sinks. v1.3.2 has no measured token, latency, or cost reduction yet.

## Native plugin and release verification

ZCode auto-discovers the standard `hooks/hooks.json` file. The v1.3.2 package removes the redundant manifest hook declaration that caused `Duplicate plugin hooks file ignored` in an earlier manually installed candidate. The root GitHub marketplace catalog, bundled plugin catalog, and plugin manifest are bound by the release route contract; the package includes six MCP launchers and seven hook events. The tag-triggered workflow verifies the package, lifecycle, language suite, and release archive before publication.

An earlier v1.3.2 candidate may not display an Update button because its version is unchanged. In Settings → Plugins, uninstall that candidate, refresh the marketplace, reinstall from the published repository, and start a fresh ZCode session. Verify that the duplicate warning is absent and that the expected Skills, commands, agents, hooks, and MCP connections actually load.

## Host capability matrix

| Host | Package route | Current session |
| --- | --- | --- |
| ZCode | Existing documented routes | Pending live observation |

## Migration and upgrade

Upgrade from v1.3.1 using the documented lifecycle after inventorying managed and modified assets. Preserve caller files and existing run evidence. The report gate applies to new verification attempts; old conversational verdicts do not become durable evidence.

## Known risks

The role-aware hook depends on host-provided agent identity and does not classify arbitrary Bash writes. Quota termination can still leave an in-progress report; it must remain blocked until independently resumed or rerun.

## Rollback

Use the lifecycle rollback to the prior verified release. Keep v1.3.2 run evidence for diagnosis and do not mark in-progress reports complete.

## Prior release notes (v1.3.1)

# LazyZCode v1.3.1 — surgical fix round (2026-09-24)

**Status:** Published stable release. LazyZCode v1.3.1 is the ZCode port of the
LazyQoder v1.3.1 surgical fix round: a repair of confirmed local defects, not a
feature wave. Repository and release-package checks define the release gate;
ZCode activation in a fresh host session still needs live testing.

## Eval-driven fixes

- **Safer execution:** Workflow intent ignores quoted or historical command
  mentions while retaining explicit requests to start work. Isolation reports
  namespace allocation accurately — it does not claim to have created a Git
  worktree — and release/recovery removes the task root only when empty.
  Cleanup preserves populated allocations, linked files, and caller-owned
  changes.
- **Better evidence:** Outcome comparisons hash the supplied task, budget, and
  permission snapshots and reject mismatched cohorts. Reports distinguish
  absent, partial, and validated evidence, count explicit host-billed costs
  from failed runs, and reject fixture telemetry as execution data. Baseline
  runners emit `measurement_scope: fixture-validation`; the outcome comparison
  accepts only explicit `execution` scope. Hashes verify supplied bytes, not
  the truth of their contents.
- **Predictable delegation:** Subagents keep the current session model by
  default. A plan may propose `efficient` or `performance` for named tasks,
  but switching requires an explicit plan decision and `--allow-switch`. The
  selector is advisory and does not change host settings or imply that a model
  is available on the account. ZCode routing stays on per-agent
  `model`/`thoughtLevel` frontmatter; see
  [the model-routing guide](docs/reference/model-routing.md).
- **Package and tooling fixes:** Dependency search handles extension-bearing
  imports with fewer search processes (blast-radius lookup uses one search
  process instead of four, and repository overview uses one import scan
  instead of candidate discovery plus repeated per-file scans), and
  verification avoids repeating the full suite for Python preflight.
  Package-boundary checks receive a minimum 180-second deadline. No
  end-to-end speed or cost gain has been measured.
- **Current guidance:** README, contributor, lifecycle, and verification
  documentation reflect v1.3.1, mirroring the upstream LazyQoder v1.3.1
  documentation refresh. The v1.3.0 release notes are archived at [docs/v1.3.0-release-notes.md](docs/v1.3.0-release-notes.md), and a new
  [model-routing guide](docs/reference/model-routing.md) documents the
  catalog, custom-model, cost, and host-observation boundaries.

## Measured efficiency

No measured productivity or native-cost improvement is claimed. Local
repository, installed-package, release-root, machine-status, and
verifier-policy checks passed; their JSON results name each outcome, and the
retained fixture telemetry is scope-marked, not a live efficiency result.

## Host capability matrix

| Host | Release route | Live status |
| --- | --- | --- |
| ZCode | Plugin marketplace route (`zcode-marketplace`): full plugin — skills/commands/agents/hooks/MCP via **Settings → Plugin Management**. Manual fallback (`manual-skills-mcp-fallback`): skills-only import plus six manual connectors. | Pending fresh-session test |

Package checks are package evidence only. Every host remains **pending host
proof** until it is observed in a fresh session; this release does not claim
that any host loaded, enabled, or connected anything.

## Migration and upgrade

From v1.3.0: the update is additive. The v1.3.0 release was the ZCode
rename-port of the previous LazyQoder v1.3.0 baseline (lazyqoder → lazyzcode,
Qoder host surfaces → ZCode host
surfaces); v1.3.1 changes no route IDs, manifests, or state shapes. `.lazyzcode/`
project state, receipts, and durable `LazyZCode/` installs carry over.

Before upgrading, record the installed version and lifecycle ownership, then
validate the exact v1.3.1 archive. Keep host readiness pending until the
selected route is observed in a fresh ZCode session.

## Known risks

Repository and CI checks do not establish that a release archive loads in a
host. Installation, activation, hooks, MCP, specialist dispatch, cancellation,
and completed-task behavior remain unobserved in fresh ZCode sessions. Shared
semantics stay byte-identical with LazyBuddy, LazyTrae, and LazyQoder, but
routes and host proof are per host. Evidence hashes bind supplied bytes but do
not establish their independent truth.

## Rollback

Stop the host session and use the lifecycle offboard/rollback route for the
previous release. Remove only unmodified receipt-owned assets; preserve
modified, unknown, linked, caller-owned, and host-managed files. Start a fresh
session to verify the restored installation.
