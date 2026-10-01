# LazyZCode package verification contract

This public, package-owned matrix lets a copied `plugins/lazyzcode/` discover
its checks without repository-root documentation. It reports package evidence
and names the host observation required before a user-facing integration claim.

## Package checks

| Verification Step | Command | Expected | Artifact |
| --- | --- | --- | --- |
| Package readiness | `bash scripts/lazyzcode-load-check.sh` | `PACKAGE_READINESS=full` or an explained degraded state | command output |
| Package health | `bash scripts/lazyzcode-plugin-doctor.sh` | `Doctor check: ALL PASS`; package-only, with no PATH host execution | command output |
| Explicit host validation | `bash scripts/lazyzcode-plugin-doctor.sh --host-validator "/absolute/path/to/zcode"` | The named executable reports semantic validation success | command output |
| MCP integration | `bash scripts/lazyzcode-mcp-test.sh` | `MCP test: ALL PASS` | command output |
| Package verification | `bash scripts/lazyzcode-verify.sh` | JSON with `"all_pass":true` | command output |
| Security acceptance matrix | `bash tests/v015-security-regression.sh && bash tests/v018-docs-ssrf-regression.sh` | Every v1 security case has positive and negative controls; evidence remains redacted | command output |

## Repository publication check

The installed package checks above do not read repository-root learner pages.
Release CI runs `bash tests/publication-regression.sh` separately from a full
repository checkout to validate the learner route, local links, and public
semantic claims.

## Capability and host boundary

Package readiness and doctor validate copied package assets, the 14 `zcode-`
skills, 14 commands, 13 `lazyzcode-` agents, 12 hook events, eight local MCP
servers (`run-ledger`, `verification`, `status-dashboard`, `context-graph`,
`code-intel`, `docs`, `codegraph`, `lsp`), the optional-capability policy, and
receipt-safe removal rules. They do not prove a live ZCode IDE host loaded the
package, executed a hook, or connected an MCP server. A manual host
observation in a new session or the applicable ZCode IDE UI is still required.

### Canonical capability readiness and automatic-tooling contract

The readiness check renders the **9-record canonical capability readiness**
(`contracts/lazyseries-capability-readiness.v1.json`, `contract_version`
`0.18.0`) produced by `tooling/lazyzcode_capability_readiness.py`:
`local_search` (ripgrep), `structural_search` (ast-grep), `code_navigation`
(lsp), `architecture_search` (codegraph), `documentation_search` (context7),
`web_search` (web), `external_code_search` (grep_app), `browser_automation`
(playwright), and `filesystem_read` (filesystem). `lazyzcode-load-check.sh`
fails the package unless exactly nine integrity-valid records are returned.

The readiness records are governed by the **automatic-tooling contract**
(`contracts/automatic-tooling-contract.v1.json`, `contract_version` `1.1.0`).
That contract defines the local-foundation / ask-once / remote provisioning
tiers, the `deny`-default permission model, the `darwin`-only operating bounds,
and the cost/egress/data policy. Package checks validate the contract digest and
the receipt-owned tooling roots; they do not download or connect optional remote
providers. Neither the readiness records nor the package checks assert a live
host connection.

## Readiness vocabulary and route boundaries

Every record emitted by a package check has `readiness_scope=package-ready`.
That scope means only that the copied package and its local contracts are
internally consistent. The contract also names three scopes that package checks
must never synthesize: `observed-build-route` (a route seen in a particular host
build), `manual-skills-mcp-fallback` (Skills import plus six manually configured
local MCP connectors), and `live-host-proof` (a fresh host session showing the
requested Skill/command and every expected MCP connection).

The manual fallback is intentionally Skills-only: it excludes agents, commands,
and hooks. Do not run it alongside the full plugin route for the same project;
the two routes can double-load Skills or MCP processes and their coexistence is
unsupported. To migrate safely, stop the host session, remove the old route's
Skills/plugin and only its six LazyZCode connectors through the host UI, select
one route, start a new session, and verify the selected route's exact surface.
Package checks do not inspect host-private directories or claim that migration
or live proof occurred.

## Intentional host differences

| Difference class | LazyZCode documentation rule |
| --- | --- |
| Host integration | ZCode IDE uses its IDE / JetBrains / VS Code extension or CLI plugin flow; manifest entry is `plugins/lazyzcode/.zcode-plugin/plugin.json`. The eight local MCP servers bridge through ZCode IDE Agent-mode MCP. |
| State/path | Receipt-owned tooling roots stay package-local; host-managed paths and `.zcode` state are not scanned or removed. |
| Inventory | Eight local MCP servers are bundled. Context7 and `grep_app` are optional remote export fragments; filesystem and Playwright are not bundled local MCP servers. |

## Scope and paired evidence

Release CI covers Ubuntu and macOS runners for the local package checks; live
host observation remains a user-owned step and is not part of CI. Normal CI
does not require a sibling repository. Release-only paired parity may receive
explicitly supplied sibling roots to compare documentation or contracts; it is
not a runtime, installation, or normal-CI dependency. Historical host
observations were collected on a single macOS workstation and are retained as
records of those specific sessions, not as a claim about every host build.
The repository-level evaluation is additional public evidence; this package
matrix remains self-contained.

## License and attribution

LazyZCode is distributed under the MIT License (see `plugins/lazyzcode/LICENSE`
and the repository root `LICENSE`). Portions of the workflow-harness design and
skill text derive from LazyCodex; see the repository root `NOTICE` for full
attribution and copyright notices.
