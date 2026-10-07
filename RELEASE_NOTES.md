# LazyZCode v1.4.0 - shared dashboard surface and honest capability labels

A documentation and surface release across the LazySeries siblings. It vendors
the family's shared dashboard core and documents the ZCode-native adapter
without changing host-readiness boundaries or the MCP profile gate.

## Project platform (2026-10-07)

- The persistent project record is vendored as the family's second pinned
  tree: `plugins/lazyzcode/shared/project/` + `project.vendor.json` re-pin to
  family tree `95c0e0fc…` (source revision `7bf5bd8`). ZCode's adapter keeps
  its own authority — transactions, bounded producers/verifier publication,
  and the `LAZYZCODE_MCP_MODE` profile gate — over the shared runtime's
  init/read/command/observe routes, registered original-source editing,
  reconciliation, and telemetry.
- The capability record completes to the family key set with the three
  exercised project keys (`project_platform`, `project_source_editing`,
  `project_telemetry`, each `available` exactly where the port gate exercised
  it), and the project-adapter suite now asserts no capability key ever claims
  observed host adoption (mutation-proven).
- Boundaries stay explicit in the project context summary: the vendored
  git-observation collectors are byte-pinned but wired to no ZCode-exposed
  route (commit links are run-side `repo_head`/`content_revision`); host
  embedding, chat handoff, and host wake remain unobserved; native host
  readiness stays pending.

## Eval-driven fixes

- A portable dashboard core is vendored under
  `plugins/lazyzcode/shared/dashboard/` with hash-pinned vendoring metadata
  (`dashboard.vendor.json`); the vendored bytes are not edited per package.
- The ZCode-native adapter (`plugins/lazyzcode/shared/dashboard-host/`) is
  covered by an adapter suite: edits stay pending until an exact revision is
  consumed, a distinct independent verifier proves them, queue persistence
  never executes work, and the owned loopback lifecycle emits signed receipts.
- The status-dashboard MCP server exposes six tools: the four status views
  plus `dashboard_service` (start, inspect, stop, or return the local browser
  dashboard entry) and `copy_task_context` (copy a validated native ZCode
  producer context without executing or consuming it). The
  `v133-status-dashboard-mcp-regression.sh` test drives the JSON-RPC behavior
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

See [the dated platform audit](docs/reference/platform-status-2026-10-02.md).
That snapshot records the v1.3.5 review date and is preserved as a historical
document; it does not describe the dashboard surface.
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

See [the dated platform audit](docs/reference/platform-status-2026-10-02.md).
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
