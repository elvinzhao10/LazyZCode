# Host routes

## v1.3.4 route and host readiness

This guide describes the current v1.3.4 package for the ZCode host.
Native-host readiness remains pending. The ZCode plugin marketplace route
(`zcode-marketplace`) is the default full-plugin route. The
`manual-skills-mcp-fallback` route is recovery-only and mutually exclusive
with a full-plugin route for one project.

v2 reports native mode as `invoke-documented`, `observe-only`,
`descriptor-only`, or `unavailable`; public label as `documented-tested`,
`documented-untested`, `observed-build-specific`, or `unavailable`; and
evidence scope as `package`, `probe`, or `current-session`. A `package` result
does not prove a live host, and a `probe` never substitutes for a
current-session receipt.

Automatic workflow selection chooses the smallest sufficient existing workflow
from task risk and complexity. Before a current host observation it is
selection-only, not evidence that a host loaded or dispatched that workflow.

Use **Node.js LTS 24 (recommended) or 22 (supported alternative)** and
**Git**; the lifecycle also accepts Node.js LTS 20 for compatibility.
Bootstrap `onboard` only from
`https://github.com/elvinzhao10/LazyZCode.git`; then run `update`, `status`,
and plan-first `offboard` through
`node "<install-root>/LazyZCode/launcher.js"`. The exact durable tree is
`LazyZCode/{active.json,launcher.js,releases/,receipts/,rollback/,staging/,locks/}`.
The source checkout may be deleted. A moved same-version ref needs
`--confirm-revision <full-sha>`; stale runtime recovery is scoped
offboard/re-onboard, never a receipt edit. None of these package facts changes
**HOST READINESS: PENDING** without observation.

Open or link the durable release selected by `status` in ZCode, give the agent
`https://github.com/elvinzhao10/LazyZCode`, and type `onboard`. The agent runs
package checks and safe local setup, then reports **package readiness**
separately from **host readiness**.

Before a marketplace, plugin, Skills, connector, account, or credential
change, the agent asks for explicit approval. It then gives exactly one
host action and waits. After the response it inspects the app. A reload or
new session is a later one-action handoff. Verify one real skill/command and
every expected MCP connection in a fresh session; without that observation,
host readiness is **pending**. If host inspection is unavailable, a
user-pasted verbatim status or screenshot is observed evidence; otherwise
**HOST READINESS: PENDING**.

| Host route | Safe package artifact | Required host observation |
| --- | --- | --- |
| **ZCode marketplace (`zcode-marketplace`)** | Root `marketplace.json` for the public GitHub URL, local `plugins/marketplace.json` for `<repo>/plugins`, and the nested plugin manifest; local package validation via `zcode plugins validate plugins/lazyzcode`. | Add the marketplace and install through the UI actions below; after installation, observe one real skill/command plus all six MCP connections in a fresh session. |
| **Manual fallback (`manual-skills-mcp-fallback`)** | Import/copy `plugins/lazyzcode/skills/` only, then configure each of six local MCP connectors manually. | Use only after receipt-scoped removal of the full-plugin route. Observe one imported skill and each connector; commands, agents, and hooks remain excluded. |

## ZCode plugin marketplace route (default)

ZCode manages plugins through **Settings → Plugins**. One approved action at a time:

1. **Add marketplace:** after approval, open **Settings → Plugins → Create →
   Add marketplace** and enter `https://github.com/elvinzhao10/LazyZCode`.
   For an offline checkout, choose the local market root (`<repo>/plugins`),
   not the nested `plugins/lazyzcode/` plugin directory. Inspect the version
   the marketplace actually displays; do not infer host activation from this documentation and do not
   install in the discovery action.
2. **Install:** after a separate approval, open the **Personal** tab, open the
   `lazyzcode` plugin card, and click **Install**. Installed plugins are
   enabled by default. Enabling a plugin grants code-execution trust.
3. **Observe:** as a later action, start a fresh session for the project and
   verify one real LazyZCode skill or command plus all six MCP connections.

**Updates:** bump the `version` in
`plugins/lazyzcode/.zcode-plugin/plugin.json` and the matching
`plugins/marketplace.json` and root `marketplace.json` entries; then use the marketplace
**gear → Refresh**, open the plugin details, and click **Update** when
offered. Source edits are not hot reload; a catalog refresh is not a plugin
update.

**Validation (development only):** `zcode plugins validate plugins/lazyzcode`
checks the manifest and declared resources. It is a package check, not an
install and not host proof.

The nested `plugins/lazyzcode/` path is not the marketplace root; the market
root is the directory that contains `marketplace.json`.

### What the plugin declares on ZCode

- 19 skills (Skill tool + **Settings → Skills**, Plugin Skills group).
- 20 commands, surfaced as slash menu entries named `lazy-ulw-plan`,
  `lazy-start-work`, and so on. ZCode does not namespace command names by
  plugin.
- 13 agents, dispatched through the Agent dispatcher.
- 7 hook events (`SessionStart`, `UserPromptSubmit`, `PreToolUse`,
  `PermissionRequest`, `PostToolUse`, `PostToolUseFailure`, `Stop`),
  auto-enabled when the plugin is enabled.
- 6 MCP servers auto-connected from the plugin `.mcp.json`, namespaced
  `plugin:lazyzcode:<server>`, gated by the `mcp_mode` plugin user setting
  (`LAZYZCODE_MCP_MODE`: `direct`, `assisted`, `planned`, `orchestrated`,
  `long-horizon`; empty defers the profile gate).

ZCode has no rules-injection mechanism and no daemon/serve/prewarm CLI.
Project memory is `AGENTS.md` (workspace scope, plus `~/.zcode/AGENTS.md` for
user scope); model routing is per-agent `model`/`thoughtLevel` frontmatter.

## Read-only preflight

Never inspect or mutate private ZCode configuration or registries. This
package preflight remains read-only:

```bash
bash plugins/lazyzcode/scripts/lazyzcode-zcode-preparation-check.sh \
  --project-dir "<absolute-project-root>"
```

It prints `HOST_PREPARATION=not-applied`, `HOST_MUTATION=none`, and
`HOST_READINESS=pending`; `--apply` refuses. It is not an installer or host
proof. Durable `status --route zcode-marketplace` emits observation, removal,
and recovery receipt templates. Package-only checks remain pending. A receipt
is ready only when its active source/version, current build/session, loaded
skill, command, agent, hook, and all six MCP statuses validate together.

## Manual connector specification

This is the non-mutating, paste-ready source for the
`manual-skills-mcp-fallback` route. Replace both placeholders with permanent
absolute paths before asking to change host settings. Do not edit the shipped
`plugins/lazyzcode/.mcp.json`.

```json
{
  "mcpServers": {
    "run-ledger": {
      "command": "bash",
      "args": ["<release-root>/plugins/lazyzcode/mcp/run-ledger/server.sh"],
      "cwd": "<project-root>",
      "env": {"CWD": "<project-root>", "CLAUDE_PROJECT_DIR": "<project-root>"}
    },
    "verification": {
      "command": "bash",
      "args": ["<release-root>/plugins/lazyzcode/mcp/verification/server.sh"],
      "cwd": "<project-root>",
      "env": {"CWD": "<project-root>", "CLAUDE_PROJECT_DIR": "<project-root>"}
    },
    "status-dashboard": {
      "command": "bash",
      "args": ["<release-root>/plugins/lazyzcode/mcp/status-dashboard/server.sh"],
      "cwd": "<project-root>",
      "env": {"CWD": "<project-root>", "CLAUDE_PROJECT_DIR": "<project-root>"}
    },
    "context-graph": {
      "command": "bash",
      "args": ["<release-root>/plugins/lazyzcode/mcp/context-graph/server.sh"],
      "cwd": "<project-root>",
      "env": {"CWD": "<project-root>", "CLAUDE_PROJECT_DIR": "<project-root>"}
    },
    "code-intel": {
      "command": "bash",
      "args": ["<release-root>/plugins/lazyzcode/mcp/code-intel/server.sh"],
      "cwd": "<project-root>",
      "env": {"CWD": "<project-root>", "CLAUDE_PROJECT_DIR": "<project-root>"}
    },
    "docs": {
      "command": "bash",
      "args": ["<release-root>/plugins/lazyzcode/mcp/docs/server.sh"],
      "cwd": "<project-root>",
      "env": {"CWD": "<project-root>", "CLAUDE_PROJECT_DIR": "<project-root>"}
    }
  }
}
```

Every entry uses `bash`, its absolute release-local `server.sh`, and explicit
consumer-project context in both `cwd` and the `CWD` /
`CLAUDE_PROJECT_DIR` environment. Never fall back to the package directory
or caller shell directory. After approval, add exactly one named connector,
wait; handle a trust prompt as a separate action, wait; then inspect that
connector before proceeding to the next one.

## Skills/manual-MCP fallback boundary

The supported fallback route is Skills-only import/copy from
`plugins/lazyzcode/skills/` plus six individual manual local MCP connectors in
Settings. A package file, manifest, or `lazyzcode-load-check.sh` result must
never be described as loading commands, Agents, hooks, or MCP. The fallback
explicitly excludes commands, Agents, and hooks. Use the full-plugin route
when the current loaded host proves it; otherwise retain **HOST READINESS:
PENDING** for unsupported capabilities.

### Route coexistence and migration

The full plugin route and the Skills/manual-MCP fallback are mutually
exclusive and unsupported together for a project. Do not import the fallback
Skills or add its six manual MCP connectors while a full LazyZCode plugin
session is active; the routes can double-load Skills or MCP processes, and
package checks cannot declare that both routes are live.

To switch routes safely:

1. Stop the current host session.
2. Remove only LazyZCode's old plugin/Skills entry and its six connectors using
   **Settings → Plugins → Manage installed → lazyzcode → Uninstall** (and
   the connector/MCP settings UI for manually added entries).
   Do not scan or edit host-private files.
3. Choose exactly one route: full plugin installation, or Skills import plus
   manual MCP connectors.
4. Start a fresh session and verify the selected route's required skill or
   command and all six expected MCP connections.

The package result remains `readiness_scope=package-ready`; the fallback is the
`manual-skills-mcp-fallback` scope, while an observed build route or live host
proof must be recorded separately.

## Troubleshooting the handoff

- **Marketplace entry missing:** confirm the GitHub repository URL points to
  the root `marketplace.json`; for a local checkout, select the market root
  containing `marketplace.json` (`<repo>/plugins`), not the plugin
  subdirectory, and use the **Personal** tab after adding.
- **Plugin card missing after adding:** use the marketplace
  **gear → Refresh** to re-read the catalog; source edits are not hot reload.
- **Update not offered:** the marketplace entry `version` and the installed
  `plugin.json` `version` must both be bumped and refreshed; update detection
  compares them.
- **Duplicate Skills or MCP processes:** stop the session and follow the
  migration checklist above. Never keep plugin and manual routes active
  together.
- **Connector panel and live calls disagree:** record both as
  build-specific observations. Package checks and a panel count alone do not
  prove a live connection; verify each expected MCP through the current host
  session.
- **MCP starts in the wrong project:** each manual connector must use the
  absolute release-owned launcher and explicit consumer project context. Stop
  rather than falling back to the package directory or caller shell directory.

## Minimal live-test prompt

After the approved setup and required fresh session, send:

> Use one loaded LazyZCode skill or command appropriate to this route for a
> harmless read-only project check. Then test `run-ledger`, `verification`,
> `status-dashboard`, `context-graph`, `code-intel`, and `docs`. Report the
> host/build and each capability as observed or unavailable with the exact
> error; keep package readiness separate from host readiness. Do not infer from
> files or connector counts.

## Package boundary and removal

`lazyzcode-load-check.sh`, `scripts/lazyzcode-plugin-doctor.sh`, and local
metadata validation establish package readiness only. They do not prove plugin
discovery, marketplace activation, SessionStart, hook execution, a running
session, or MCP connection. Use **Settings → Plugins → Manage installed →
lazyzcode → Uninstall** and remove only connectors the user added. Never scan
or guess host paths; report package removal separately from the user-observed
host result.
