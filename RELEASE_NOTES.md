# LazyZCode v1.4.0 - shared dashboard surface and honest capability labels

A documentation and surface release across the LazySeries siblings. It vendors
the family's shared dashboard core and documents the ZCode-native adapter
without changing host-readiness boundaries or the MCP profile gate.

## Current audit (2026-10-27)

The current dashboard vendor manifest records source `62f3a0de…`, tree
`b525d678…` and 85 files; the project manifest records source `9b8aa938…`,
tree `16561f3…` and 31 files. The status-dashboard server lists seven tools,
including `project`. Empty MCP mode defaults to orchestrated. ZCode 3.16.3 is the latest release reviewed; native
activation remains unobserved. See the [platform audit](docs/reference/platform-status-2026-10-27.md).

## Completion pass (2026-10-19; historical)

A scoped completion pass over the 1.4.0 surfaces; every bullet cites the
branch commit that delivers it.

- Per-repo dashboard isolation: the family-wide per-repo store isolation and
  foreign-runtime refusal matrix (8d45d22) — a foreign runtime's state and
  event writes are refused, and each repository's dashboard stores stay
  isolated to this package's own roots.
- Served-project truth reconciled (48144e4): the ZCode served dashboard does
  expose the live git view (`/api/project/git` answers 200 behind the
  authenticated session and invokes the vendored `git-observation/local`
  collector); run-side commit links stay `repo_head`/`content_revision`.
- ZCode host-harness rescan, conservative adoption (72862c2): capability
  observations refreshed against the live rescan; no unobserved capability
  is claimed. A pre-existing flaky node test phase (ajv bootstrap) was
  stabilized without changing what it asserts (914b8b5).
- Family repin (4156dfa): both vendored families re-pinned at source
  revision `bb696092` — dashboard tree `e55a9c00…`, project tree `16561f3…`
  — carrying the family's completed project-dashboard UI (dark-first design
  tokens v2, de-tabbed shell with the static retractable sidebar and
  in-place navigation, six redesigned views, navigation guards,
  measured-and-held performance budgets) into this package byte-identically.
- Residuals, honestly: host embedding, chat handoff, and host wake remain
  unobserved; host readiness stays pending; the `LAZYZCODE_MCP_MODE`
  profile gate is unchanged.

## Project platform (2026-10-07)

- The persistent project record is vendored as the family's second pinned
  tree: `plugins/lazyzcode/shared/project/` + `project.vendor.json`
  re-pinned at delivery prep to family tree `1feb5646…` (source revision
  `537f393`) and in the completion repin to tree `16561f3…` at source
  revision `bb696092` (4156dfa, alongside the dashboard family at tree
  `e55a9c00…`). ZCode's adapter keeps
  its own authority — transactions, bounded producers/verifier publication,
  and the `LAZYZCODE_MCP_MODE` profile gate — over the shared runtime's
  init/read/command/observe routes, registered original-source editing,
  reconciliation, and telemetry.
- The capability record completes to the family key set with the three
  exercised project keys (`project_platform`, `project_source_editing`,
  `project_telemetry`, each `available` exactly where the port gate exercised
  it), and the project-adapter suite now asserts no capability key ever claims
  observed host adoption (mutation-proven).
- Boundaries stay explicit in the project context summary: the served dashboard
  does expose a live git view — a live probe saw `/api/project/git` answer 200
  behind the authenticated session and invoke the vendored
  `git-observation/local` collector, reporting `observed` with the fixture's
  commit facts (unauthenticated reads reject 401); run-side commit links stay
  `repo_head`/`content_revision`; host embedding, chat handoff, and host wake
  remain unobserved; native host readiness stays pending.

## Eval-driven fixes

- A portable dashboard core is vendored under
  `plugins/lazyzcode/shared/dashboard/` with hash-pinned vendoring metadata
  (`dashboard.vendor.json`); the vendored bytes are not edited per package.
- The ZCode-native adapter (`plugins/lazyzcode/shared/dashboard-host/`) is
  covered by an adapter suite: edits stay pending until an exact revision is
  consumed, a distinct independent verifier proves them, queue persistence
  never executes work, and the owned loopback lifecycle emits signed receipts.
- The status-dashboard MCP server exposes seven tools: the four status views
  plus `dashboard_service` (start, inspect, stop, or return the local browser
  dashboard entry) and `copy_task_context` (copy a validated native ZCode
  producer context without executing or consuming it), plus `project` for
  typed project actions. The `v133-status-dashboard-mcp-regression.sh` test drives the JSON-RPC behavior
  directly, and the MCP profile gate (`LAZYZCODE_MCP_MODE`) is unchanged.
- The dashboard-host adapter suite, MCP test script, v133 direct regression,
  marketplace route contract, publication regression, package verification,
  product-naming check and the Node.js 20 supported-floor spot were re-run for
  this release.

## Measured efficiency

No latency, token, cost or native-host performance improvement is claimed.
The dashboard service is a local loopback convenience surface; it does not
change execution authority or add host capabilities.

## Host capability matrix

Adapter capabilities are reported explicitly: `browser`, `transactional_edits`,
`project_queue`, `context_copy` and `observations` are `available`;
`embedding`, `chat_handoff` and `wake` are `unobserved`;
`native_host_readiness` is `pending`. The browser UI offers Work,
Verification and Plan-edit views, a task inspector, an evidence preview
dialog, and queue planning; queue edits can create, amend and reorder queued
plans, and queue edits never start work.

See [the dated platform audit](docs/reference/platform-status-2026-10-27.md).
That snapshot records the current package audit and distinguishes documented host capabilities from observation.
**HOST READINESS: PENDING** until the selected current client demonstrates
discovery, skill/command execution, relevant hooks and MCP connections.

## Migration and upgrade

Use the receipt-aware lifecycle update with an explicit project binding.
Preserve populated run state, modified assets, unknown files and host settings.
Read [AGENTS.md](AGENTS.md), [README.md](README.md) and the selected host
guide.

## Known risks

Authenticated current-client acceptance remains pending. The dashboard
surface is a package capability: a copied configuration, manifest validation,
or isolated lifecycle fixture cannot establish host loading. Embedding, chat
handoff and wake remain unobserved, and nothing in this release claims host
support for them. Vendored dashboard bytes are hash-pinned; local edits would
break the pin, not extend the surface.

## Rollback

Retain the previous release and receipts. Existing 1.3.5 tags and assets
remain intact. Follow the scoped lifecycle removal or rollback plan,
preserving user-modified and foreign assets. Host-managed registrations
require their selected client's removal flow.

## Prior release notes

# LazyZCode v1.3.5 - runtime verification and platform clarity

A maintenance release across the six LazySeries siblings. It carries forward
the workflow and run-integrity foundation from 1.3.0 through 1.3.4.

## Eval-driven fixes

- Runtime-floor checks execute named package, installation and lifecycle tests.
  Missing or unknown exercises and failed subprocesses cannot report PASS.
- Optional TypeScript LSP installation is tested separately with engine-strict
  dependency installation and the installed server executable.
- Hook payloads are bounded before parsing and kept out of process arguments.
  Invalid or oversized events preserve each adapter's exit and state contract.
- Current product names, configuration scopes and native extension capabilities
  are distinguished from legacy routes and unverified live integration.

## Measured efficiency

Hook boundary repairs avoid payload-sized process arguments and bound input
memory. The first host-independent verification unit is vendored identically
in sibling packages, with product-specific exercises in small adapters.
No latency, token, cost or native-host performance improvement is claimed.
Persistent LSP sessions and event-ledger compaction remain future measured work.

## Host capability matrix

ZCode's event and output contracts stay host-specific. Do not infer sibling hook support or manufacture unsupported events from package parity.

See [the dated platform audit](docs/reference/platform-status-2026-10-27.md).
**HOST READINESS: PENDING** until the selected current client demonstrates
discovery, skill/command execution, relevant hooks and MCP connections.
Official feature documentation and package tests are separate evidence.

## Dependencies and runtime requirements

Node.js 24 is recommended. Core lifecycle compatibility remains Node.js 20;
LazyTrae's standalone CLI also retains its separate Node.js 18 compatibility
tier. Optional TypeScript language-server 6.x requires Node.js 22.22.2 or later;
5.x providers retain their own Node.js 20 requirement.
Python language-server providers are aligned at basedpyright 1.40.1.
LazyTrae uses fast-uri 4.2.1 directly and the patched 3.1.8 Ajv edge, with
security and normalization regressions preserved.

## Migration and upgrade

Use the receipt-aware lifecycle update with an explicit project binding.
Preserve populated run state, modified assets, unknown files and host settings.
Select the exact client and version before following a native installation route.
Kimi Code clients can share configuration; Kimi Work is a separate target.

Read [AGENTS.md](AGENTS.md), [README.md](README.md) and the selected host guide.
Use a newly versioned archive; existing 1.3.4 tags and assets remain intact.

## Known risks

Authenticated current-client acceptance remains pending. A copied configuration,
manifest validation, or isolated lifecycle fixture cannot establish host loading.
Optional providers must satisfy their own runtime floor.
Native features added upstream are not automatically wired into the adapter.

## Rollback

Retain the previous release and receipts. Follow the scoped lifecycle removal
or rollback plan, preserving user-modified and foreign assets. Host-managed
registrations require their selected client's removal flow; never remove
credentials, sessions or entire shared configuration directories.
