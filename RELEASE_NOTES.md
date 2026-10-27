# LazyZCode v1.4.0

LazyZCode 1.4.0 adds the shared local project dashboard and persistent project
record to the existing planning, execution and verification workflows.

## Dashboard and project work

- An authenticated local dashboard with eight destinations: **Overview, Project,
  Plans, Health, Execution, Git, Evidence and Research**.
- A project record, editable plans, queue planning and research capture, with
  source revisions and evidence references visible for review.
- A run monitor that separates execution progress from verified completion,
  plus reported token usage, resource activity and retained-run history.
- A Health inventory of package components, separate from observed host activity.

The collapsible sidebar, contextual Details and expandable pan/zoom maps keep
navigation within the project. Source edits use authenticated native project
binding and revision checks. Queue edits do not start work. Plans and research
retain source revision and evidence references; these references are not
immutable source copies or verification verdicts. Unknown usage stays unknown,
and recorded comparisons do not establish efficiency savings.

The `status-dashboard` MCP server exposes seven tools, including
`dashboard_service`, `copy_task_context` and typed `project` operations.

The dashboard and project cores are hash-pinned in the package's
[vendor manifests](plugins/lazyzcode/shared/dashboard.vendor.json), with a separate
[project manifest](plugins/lazyzcode/shared/project.vendor.json). See the
[documentation index](docs/README.md) for package architecture and usage.

## Host capability matrix

ZCode uses the root marketplace manifest for the repository URL and
`plugins/marketplace.json` for an offline checkout. Its full-plugin route is
separate from the recovery-only Skills/manual-MCP route. The
`LAZYZCODE_MCP_MODE` gate remains in force; an empty mode defaults to
orchestrated. The [platform audit](docs/reference/platform-status-2026-10-27.md)
records ZCode 3.16.3 as the reviewed release, without claiming activation.

## Known risks

**HOST READINESS: PENDING.** Package checks do not prove plugin loading, hook
execution, model selection or live MCP connections. Browser embedding, chat
handoff and host wake remain unobserved. No current-session model selection or provider entitlement is established.

## Migration and upgrade

Use Node.js 24 LTS (recommended) or Node.js 22 LTS, Git and Python 3.10+.
Core lifecycle compatibility with Node.js 20 does not extend to the optional
TypeScript language server, which requires Node.js **22.22.2+**. The optional
provider pairs language-server 6.x with TypeScript 6.0.3 for its tsserver
integration; a newer TypeScript package is not automatically compatible.

Use the [installation guide](docs/03-install-and-host-verification.md) and
[AGENTS.md](AGENTS.md) for the selected route. Update only receipt-owned assets
and preserve modified or unknown files,
project history and host settings. Do not combine a full-plugin route
with its fallback. After updating, observe a fresh host session separately
from package checks.

## Rollback

Keep the previous release and its receipts. Rollback and removal remain
receipt-scoped; follow the [removal guide](docs/08-safe-removal.md) instead of
deleting host directories.

## Eval-driven fixes

Source writes check the expected revision before mutation, and project stores
reject a foreign runtime identity. Package verification covers these local
boundaries separately from native host acceptance.

## Measured efficiency

Usage and retained-run comparisons display recorded inputs only. Missing usage
is not zero, fixture measurements are not live host measurements, and this
release makes no token, time, resource or cost-saving claim.

## Release verification and distribution

The [release workflow](.github/workflows/release.yml) checks the tag against the
package version and gates publication on package, lifecycle and Node/Python verification plus publication checks.
It builds `lazyzcode-v1.4.0.tar.gz` for the selected tag and publishes it as a GitHub Release
asset. Archive checks are part of that workflow; existing published assets
are retained. This workflow does not publish to npm.

Final CI and release-job outcomes belong to the tagged commit's Actions run;
these notes do not substitute for that result or for current-session host
acceptance. Reproduction commands are in the
[test and release guide](docs/09-test-and-release-verification.md).

Historical release entries remain in [CHANGELOG.md](CHANGELOG.md) and dated
platform audit documents.
