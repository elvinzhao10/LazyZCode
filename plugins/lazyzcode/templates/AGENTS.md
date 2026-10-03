# AGENTS.md — LazyZCode local onboarding

This is the reusable `v1.0.3` consumer template, not a claim that a host loaded
the plugin. Explicit user instructions and nearer project instructions take
precedence.

## When the user types `onboard`

Require **Node.js LTS 24 (recommended) or 22 (supported alternative)** and **Git**. The lifecycle also accepts Node.js LTS 20 for compatibility. Bootstrap `onboard` only from
`https://github.com/elvinzhao10/LazyZCode.git`, then use
`node "<install-root>/LazyZCode/launcher.js"` for `update`, `status`,
`recover-bootstrap-lock`, and plan-first `offboard`. The exact durable tree is
`LazyZCode/{active.json,launcher.js,releases/,receipts/,rollback/,staging/,locks/}`.
The source checkout may be deleted after promotion. Never install in a
temporary or cache directory.

If lifecycle state collides with an existing path, preserve the caller
workspace. Only an explicitly verified lifecycle-owned sibling bootstrap lock
or product `staging/`/`locks/` artifact is recoverable; never remove or replace
caller workspace files.

1. Confirm the **ZCode** host through **Settings → Plugins**.
2. Resolve the absolute release/plugin root; never guess it from PATH.
3. Run safe package checks only: from the release root, use
   `bash plugins/lazyzcode/scripts/lazyzcode-load-check.sh` and
   `bash plugins/lazyzcode/scripts/lazyzcode-plugin-doctor.sh`. Preserve project
   settings and do not change credentials, providers, or host settings.
4. Report **package readiness** separately. Files and declarations do not prove
   plugin discovery, commands, agents, hooks, SessionStart, or MCP connection.
5. Ask for explicit approval before marketplace trust/add, plugin install,
   Skills import, connector setup, account, credential, or provider changes.
6. After approval, give exactly one GUI/host action and wait. Discovery,
   install, reload/new session, and verification are separate actions.
7. Inspect the app with Computer Use after each response. If unavailable,
   accept a user-pasted verbatim status or screenshot as observed evidence.
8. Verify one real Skill/command appropriate to the selected route and all six
   MCP connections. Otherwise **HOST READINESS: PENDING**.

Route status is explicit: `zcode-marketplace` is the default full-plugin
route; `manual-skills-mcp-fallback` is recovery only. Neither route proves
host readiness until observed in a fresh ZCode session.

## ZCode marketplace

Run durable `status --route zcode-marketplace` to identify the active release.
The repository root contains `marketplace.json`; local installs use
`<active-durable-release-root>/plugins/marketplace.json`. The plugin manifest
is `plugins/lazyzcode/.zcode-plugin/plugin.json`.

1. After approval, open **Settings → Plugins → Create → Add marketplace** and
   enter `https://github.com/elvinzhao10/LazyZCode`, or select the local
   `<active-durable-release-root>/plugins` directory. Wait for discovery.
2. After separate approval, open **Personal → lazyzcode → Install**. Enabling
   the plugin grants code-execution trust. Wait for installation.
3. Start a fresh project session as a later action, then observe one real
   Skill or command and all six `plugin:lazyzcode:<server>` MCP connections.

For updates, refresh the marketplace and choose **Update** in the plugin
details. For removal, use **Settings → Plugins → Manage installed → lazyzcode
→ Uninstall**. Keep these host actions separately approved. Never inspect or
mutate private ZCode registries to reproduce installation.

## ZCode full-plugin boundary

Before asking for that approval, run this read-only preflight from the release
root:

```bash
bash plugins/lazyzcode/scripts/lazyzcode-zcode-preparation-check.sh \
  --project-dir "<absolute-project-root>"
```

It prints `HOST_PREPARATION=not-applied`, `HOST_MUTATION=none`, and
`HOST_READINESS=pending`; `--apply` refuses. Durable `status --host zcode`
emits the exact receipt template. A current receipt must bind the active
source/version and current build/session and show one loaded Skill, command,
agent, hook, and all six connected MCP servers. The Skills/manual-MCP fallback
is recovery-only and excludes commands, agents, and hooks.

If durable `status` reports `STALE_RUNTIME`, use a fresh verified checkout for
scoped `offboard` and re-onboard. Do not edit receipts. A moved same-version
ref requires `--confirm-revision <full-sha>`. Package success never upgrades
**HOST READINESS: PENDING** without observation.

## ZCode manual fallback

The recovery-only Skills/manual-MCP fallback imports
`plugins/lazyzcode/skills/` and configure six local MCP connectors manually:
`run-ledger`, `verification`, `status-dashboard`, `context-graph`, `code-intel`,
and `docs`. This route excludes commands, agents, and hooks. A package file,
manifest, or load-check never proves those capabilities or MCP loaded.

Prepare manual connector values without mutating the host: copy the six entries
from `plugins/lazyzcode/.mcp.json`, replace `${CLAUDE_PLUGIN_ROOT}` with the
absolute `<release-root>/plugins/lazyzcode`, and replace
`${CLAUDE_PROJECT_DIR}` with the absolute `<project-root>`. Each entry must
use `command: bash` and the absolute `args` path
`<release-root>/plugins/lazyzcode/mcp/<server>/server.sh`. Set `cwd` to
`<project-root>` and environment `CWD=<project-root>` plus
`CLAUDE_PROJECT_DIR=<project-root>`. The six servers are `run-ledger`,
`verification`, `status-dashboard`, `context-graph`, `code-intel`, and `docs`.
Do not edit the shipped declaration. After approval add one connector, wait;
handle trust separately, wait; inspect it, then continue to the next server.

Do not run a full plugin route and the `manual-skills-mcp-fallback` together;
coexistence is unsupported. To switch, stop the session, remove only old
LazyZCode entries through the host UI, choose one route, start a fresh session,
and verify it. Each host mutation is separately approved.

Read the root `zcode.md` when present; a nearer child `zcode.md` refines
that guidance.
Optional remote, browser, and architecture capabilities retain their own
approval lifecycle and are never enabled by onboarding.
