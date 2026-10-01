# Host capability matrix

LazyZCode deliberately aligns policy and package safety across hosts while keeping host adapters distinct. The same package family may be present on two hosts without both exposing the same loading or registration behavior. This page describes the ZCode host and where it diverges from sibling ports in the LazySeries family.

## Onboarding baseline

## Current v1.3.4 evidence boundary

The current v1.3.4 documentation targets the **ZCode** host; no current
host activation is claimed. The ZCode plugin marketplace
route (`zcode-marketplace`) is the default full-plugin route. The
`manual-skills-mcp-fallback` route is recovery-only and mutually exclusive
with a full-plugin route in the same project.

| v2 field | Allowed values and boundary |
| --- | --- |
| Native mode | `invoke-documented`, `observe-only`, `descriptor-only`, or `unavailable`. |
| Public label | `documented-tested`, `documented-untested`, `observed-build-specific`, or `unavailable`. |
| Evidence scope | `package`, `probe`, or `current-session`; `package` does not prove a live host. |

Use **Node.js LTS 24 (recommended) or 22 (supported alternative)** and
**Git**; the lifecycle also accepts Node.js LTS 20 for compatibility.
Bootstrap `onboard` only from
`https://github.com/elvinzhao10/LazyZCode.git`; then run `update`, `status`,
and plan-first `offboard` with
`node "<install-root>/LazyZCode/launcher.js"`. The durable tree is
`LazyZCode/{active.json,launcher.js,releases/,receipts/,rollback/,staging/,locks/}`
and survives source deletion. Moving a same-version ref requires full-SHA
confirmation; stale runtime recovery is scoped offboard/re-onboard. None of
this proves a host: **HOST READINESS: PENDING** until observation.

Automatic selection chooses the smallest sufficient existing workflow from task
risk and complexity. It remains selection-only until host readiness is observed;
selection never proves native workflow loading or host dispatch.

Open or link the durable release selected by `status` in ZCode, give the agent
`https://github.com/elvinzhao10/LazyZCode`, and type `onboard`. The agent
runs safe package checks and reports package readiness separately from host
readiness. Before a host-managed change it asks for approval, gives one exact
action, and waits. It then inspects the host or uses a user-pasted
status/screenshot; reload or new session is a later action. Verify one real
skill/command and all six MCP connections in a fresh session. Without
observation, **HOST READINESS: PENDING**.

Route status is explicit: `zcode-marketplace` is the **default full-plugin
route** through **Settings → Plugins**. The
`manual-skills-mcp-fallback` is recovery only.

## What each route needs

| Route | Safe package artifact | Required host proof |
| --- | --- | --- |
| **ZCode marketplace (`zcode-marketplace`)** | Root `marketplace.json` for the GitHub URL, local `plugins/marketplace.json` for `<repo>/plugins`, and the nested plugin manifest; 19 skills, 20 commands, 13 agents, 7 hook events, and 6 MCP servers. Install via **Settings → Plugins → Create → Add marketplace** with `https://github.com/elvinzhao10/LazyZCode`, then **Personal → Install**; validate in development with `zcode plugins validate plugins/lazyzcode`. | A fresh session showing one real skill/command and all six MCP connections. |
| **Manual fallback (`manual-skills-mcp-fallback`)** | Import/copy `plugins/lazyzcode/skills/` only, then configure each of six local MCP connectors manually. | Use only after receipt-scoped removal of the full-plugin route. Observe one imported skill and each connector; commands, agents, and hooks remain excluded. |

Before requesting that host mutation, run this read-only preflight from the
release root:

```bash
bash plugins/lazyzcode/scripts/lazyzcode-zcode-preparation-check.sh \
  --project-dir "<absolute-project-root>"
```

It prints `HOST_PREPARATION=not-applied`, `HOST_MUTATION=none`, and
`HOST_READINESS=pending`; `--apply` refuses. It is not an installer and never
proves host readiness.

## Native-surface mapping on ZCode

ZCode has no rules-injection mechanism, no daemon/serve/prewarm CLI, and no
IDE plan directories. Project memory is `AGENTS.md` (workspace scope, plus
`~/.zcode/AGENTS.md` for user scope), and model routing is per-agent
`model`/`thoughtLevel` frontmatter. LazyZCode maps its harness primitives onto
the native surfaces ZCode actually provides:

| Harness primitive | LazyZCode asset | ZCode native surface |
| --- | --- | --- |
| Project memory | `lazy-init-deep` + managed AGENTS.md block | `AGENTS.md` (workspace and user scope) |
| Planning | `lazy-ulw-plan` skill + command | Slash menu entry / Skill-tool invocation |
| Execution | `lazy-start-work` with Agent-tool subagents | Agent dispatcher |
| Review | `lazy-review-work` five lanes | Parallel Agent dispatch (5 lanes) |
| Model routing | Agent frontmatter | `model` / `thoughtLevel` per agent |
| Automation | `hooks/hooks.json` | 7 hook events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PostToolUseFailure`, `Stop` |
| Local services | `.mcp.json` | 6 MCP servers, auto-connected, namespaced `plugin:lazyzcode:<server>` |

Commands run inside a ZCode session as natural language or through the slash
menu; LazyZCode mounts skills, and command files surface as slash menu entries
named `lazy-ulw-plan` and so on. Skill auto-triggering is decided by the model
from each skill's `name`/`description` frontmatter via the Skill tool.

## Structural differences

The host adapter differs, but the safety model does not:

- **Host integration:** ZCode decides plugin discovery, connector registration, session lifetime, and event delivery.
- **State/path:** package run state and receipt-owned tooling roots are local; marketplace directories, plugin data, credentials, and connector state remain host/user-owned.
- **Inventory:** six local MCP servers are packaged, gated by the `LAZYZCODE_MCP_MODE` profile (`direct`, `assisted`, `planned`, `orchestrated`, `long-horizon`; empty defers the gate). Optional remote exports and browser work remain separate explicit decisions.

## Package-built versus host-native behavior

| Behavior | LazyZCode contribution | Raw host contribution | Learner takeaway |
| --- | --- | --- | --- |
| Workflow guidance | Ships skills, commands, and agent role text. | Decides whether/how those assets are discovered and exposed. | A Markdown command definition is not a running command. |
| Hook policy | Ships event mapping and scripts that validate supported input. | Delivers an event and decides the host lifecycle semantics. | A passing hook test does not prove a host delivered the event. |
| Local MCP | Ships six launchers and server programs. | Starts the process, negotiates connection, and shows tool availability. | A declaration is not a connection. |
| Run/evidence state | Implements package-local scripts and boundaries. | Supplies session context and user-visible integration. | Local records describe package work, not host state. |
| Optional providers | Implements policy, receipts, and export fragments. | Stores credentials and applies connector/network policy. | Selection/receipt status is not provider authorization or connection. |

The complete dependency classification is in [Dependency and host boundary reference](reference/dependency-and-host-boundaries.md).

## Readiness and fallback claims

The package contract uses four explicit evidence scopes: `package-ready`,
`observed-build-route`, `manual-skills-mcp-fallback`, and `live-host-proof`.
Load-check, doctor, and capability reports emit only `package-ready`; they do
not claim that a host loaded a plugin or connected an MCP process. A route seen
in one build is an `observed-build-route`, not universal host support.

The manual fallback is Skills plus six manually configured local MCP
connectors. It explicitly excludes agents, commands, and hooks. It must not be
run alongside a full plugin route for the same project: coexistence is
unsupported and may duplicate Skills or MCP processes. Stop the session,
remove only the old LazyZCode entries in the host UI, choose one route, restart,
and verify that route before making a live-host-proof claim.

## Host evidence scope

Automated package CI runs on Ubuntu and macOS as defined in the workflows.
Manual host loading, route discovery, hooks, and MCP connection remain
per-session observations; the supplied host reports are historical macOS
evidence only.

## Migration and removal

To change routes, stop the active session, remove only LazyZCode's
receipt-scoped plugin/Skills entry and connectors that the user added through
the host UI (**Settings → Plugins → Manage installed → lazyzcode →
Uninstall**), choose one route, and verify it in a fresh session. Preserve
other plugins, connectors, credentials, project settings, and host-managed
paths. Package removal remains separate from observed host removal. Sibling
ports (LazyBuddy, LazyTrae, LazyQoder) manage their own hosts with their own
routes; shared semantics are byte-identical where contracts say so, but routes
and host proof are per host.
