# ZCode platform status — 2026-10-27

Historical snapshot: see [the 2026-10-30 audit](platform-status-2026-10-30.md) for current documentation and compatibility changes.

Package: **LazyZCode 1.4.0**. Official documentation was reviewed on
2026-10-27; the latest listed host release is **ZCode 3.16.3, 2026-10-23**,
following 3.16.2 on October 20. This is a documentation and local-package
review, not a host activation receipt. **HOST READINESS: PENDING.**
[Official release notes](https://zcode.z.ai/en/changelog).

## Current host changes and boundaries

3.16.3 shares a document-plugin process, bounds background retention, and fixes
subagent visibility of documents opened in the session. These are vendor host
changes, not measured LazyZCode improvements. 3.16.2 adds the plugin marketplace,
on-demand tool search and input controls for model, thinking effort and team
plans. These do not establish that this package was loaded or that its own
routing changed. The host's workflow controls and per-subagent model settings
were also described in 3.15.1. [Release notes](https://zcode.z.ai/en/changelog).

| Feature family | Current contract and package boundary |
| --- | --- |
| Marketplace and manifests | [Plugins](https://zcode.z.ai/en/docs/plugin) documents `.zcode-plugin/plugin.json`, component directories, `.mcp.json` and user configuration. Root and local marketplace manifests declare 1.4.0. Add, install, enable and trust are host actions; verify in a fresh session. Remote workspaces require separate sync and observation. |
| Skills and commands | The package declares 19 skills and 20 commands; [skills](https://zcode.z.ai/en/docs/skill) and [commands](https://zcode.z.ai/en/docs/commands) describe discovery and invocation. Package presence does not prove a slash command or Skill executed. |
| Agents and models | Thirteen packaged agents use host-specific frontmatter and the package model policy. [Subagents](https://zcode.z.ai/en/docs/subagents) and [release notes](https://zcode.z.ai/en/changelog) describe host delegation and current controls; a selected model or tool allowlist requires live evidence, not an inferred guarantee. |
| Hooks | Seven events are packaged in `hooks/hooks.json`. [Hooks](https://zcode.z.ai/en/docs/hooks) documents plugin auto-discovery and both direct `process` argv and legacy shell `command`; the shipped shell commands use the supported compatibility executor. User hooks precede enabled plugin hooks. Project hook configuration is ignored; sessions snapshot hooks at startup. Stop continuation is bounded to three rounds. Test a fresh session and do not imply project hooks run. |
| MCP and tools | Six declared servers are profile-gated. The orchestrated status-dashboard server's `tools/list` currently returns seven tools, including `project`; this is not seven servers. [MCP](https://zcode.z.ai/en/docs/mcp-services) and [plugin](https://zcode.z.ai/en/docs/plugin) describe host registration. Each connection and project binding still needs live observation. |
| Lifecycle and recovery | Durable onboard/update/status/offboard and scoped recovery protect receipts and caller-owned files. Marketplace installation and settings are host-managed; package preflight cannot prove readiness. See the repository host routes and installation guide. |
| Workflow, plans and evidence | Selection uses risk and complexity, plans bind revisions, execution uses owned boundaries, and independent verification requires evidence. These are package contracts, not proof of host dispatch or a promise that native workflow controls execute them. |
| Dashboard and project | Authenticated loopback service, transaction-bound edits, queue, project records, source editing, evidence and usage views are package surfaces. Queue edits do not start work. Project writes require their typed revision-bound commands. Host embedding, chat handoff and wake remain unobserved. Monitor, progress, token/activity/efficiency charts, resource traces, health, research capture, hash-bound references and focus-preserving polling are retained in the pinned portable tree. |
| Security and release | Hook scripts and plugin sources execute locally; review before enabling. Preserve host credentials, settings and unknown or modified assets during removal. Release artifacts, package checks and a version probe do not prove installed or enabled host state. |
| Usage and efficiency | [Usage Stats](https://zcode.z.ai/en/docs/usage-stats) is a host surface; package telemetry and local policy checks have their own scope. No new latency, cost, token or safety reduction is claimed without comparable measurements. |

## Provenance and acceptance

The checked-in dashboard vendor manifest identifies source revision
`62f3a0de5dd2a04a5b3ce8a7b8ce0f7d29aea0af`, tree SHA-256
`b525d6786c8a2108a01f5c800a57e54faa36de50834381e57040815d9e0c948b`,
and 85 files. Project metadata identifies revision
`9b8aa938274187ff8515cfafbda950617a223efb`, tree SHA-256
`16561f3c3c1b7b95d9f5149bad33aacadbcf83e6eaca0cd40a4d5ce2b53a8052`,
and 31 files. Historical completion notes record their then-current pins.

For acceptance, record exact host build, project, package revision and session;
observe discovery, a real skill or command, agent and hook behavior, each MCP
connection and project binding, and receipt-safe removal. A local regression
or host version alone does not meet this requirement. See the repository MCP inventory.
