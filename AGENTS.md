# AGENTS.md — LazyZCode setup and removal guide

LazyZCode targets the **ZCode** host. Automated package checks run in CI on
Ubuntu and macOS as defined by the workflows; the supplied live-host reports
are historical macOS observations, and no current-session host activation is
established. Package
files, host settings, credentials, marketplace state, and live sessions remain
separate authorities.

## Current documentation release: v1.3.3

The current local package candidate is v1.3.3. The v1.3.3 tag and release asset are pending publication; fresh ZCode host readiness requires direct observation.
This guide names current
human-facing boundaries only and does not
promote package evidence to host proof. The route IDs are
`zcode-marketplace` (the default full-plugin route) and
`manual-skills-mcp-fallback` (recovery only). v2 native modes are
`invoke-documented`, `observe-only`, `descriptor-only`, and `unavailable`;
public labels are `documented-tested`, `documented-untested`,
`observed-build-specific`, and `unavailable`; evidence scopes are `package`,
`probe`, and `current-session`.

Automatic workflow selection uses existing risk and complexity signals to
choose the smallest sufficient workflow. Until the host is observed,
that result is selection-only: it does not claim native workflow loading or
dispatch, and **HOST READINESS: PENDING** remains authoritative.

For orchestrated package work, dispatch only the compact
`TASK/DELTA/REFS/VERIFY` record: current identity, owned-path delta, artifact
references, read-only pre-task provenance, and once-validated plan argv. Reject
shell composition and destructive, remote, host-mutating, or approval-required
argv before dispatch. Runtime criteria need a real entry artifact; stateful
criteria also need a before/after transition. Recover a lost result only when a
complete terminal report still matches the current run/task/revision/criteria
and has readable artifacts. If run creation is interrupted before `state.json`,
recover only its transaction material, preserve caller files, then retry.

## Durable onboarding (start here)

For new installations, use **Node.js LTS 24 (recommended)** or **Node.js
LTS 22 (supported alternative)**, plus **Git**. Node.js LTS 20 is also
accepted by the lifecycle for compatibility; its CI jobs do not set the
recommended install runtime. Bootstrap `onboard` only from
the verified official origin `https://github.com/elvinzhao10/LazyZCode.git`.
The source checkout is transport only and may be deleted after promotion.

The stable command is `node "<install-root>/LazyZCode/launcher.js"`. The
default install root is `~/Library/Application Support/LazySeries` on macOS,
`${XDG_DATA_HOME:-~/.local/share}/lazyseries` on Linux, and
`%LOCALAPPDATA%\LazySeries` on Windows. The exact tree is
`LazyZCode/{active.json,launcher.js,releases/,receipts/,rollback/,staging/,locks/}`.
Never install into a temporary/cache directory or treat package state as proof
that a host loaded it. Lifecycle commands are `onboard`, `update`, `status`,
`offboard`, and `recover-bootstrap-lock`.

If lifecycle state collides with an existing path, preserve the caller
workspace. Only an explicitly verified lifecycle-owned sibling bootstrap lock
or product `staging/`/`locks/` artifact is recoverable; never remove or replace
caller workspace files.

## Current-message routing contract

Before taking onboarding action, scan the whole current user message,
including every line. Route only explicit direct actions for this turn. Text
presented as a quote, history, example, transcript, or instruction under
discussion is not a new action. A compatible later detail refines the earlier
route; when explicit current-message routes conflict, the rightmost conflicting
route wins.

If the host or operation is still ambiguous, ask one focused question and take
no action. The supported host is **ZCode**; detect it via
**Settings → Plugins** (the Personal catalog and Manage installed view). Keep host
authority and proof boundaries unchanged.

## `onboard` protocol

When the user types `onboard`:

1. Confirm the host is ZCode (open **Settings → Plugins**). Do not
   run a host route while the environment is ambiguous.
2. Run `status` through the durable `launcher.js`. If absent, use the verified
   source entrypoint to run `onboard`; if blocked, preserve the state and report
   the exact issue.
3. When upgrading from an earlier release, inventory receipt-owned versus
   modified/unknown assets first. Preserve user changes and host settings until
   the new session is observed. Never infer host readiness from a PATH entry,
   file existence, or a load-check.
4. Run only safe package checks and local filesystem/command setup. From the
   release root, use `bash plugins/lazyzcode/scripts/lazyzcode-load-check.sh`
   and `bash plugins/lazyzcode/scripts/lazyzcode-plugin-doctor.sh`; these validate
   package manifests, skills, declarations, and local contracts without
   installing a host plugin, changing host settings, or contacting providers.
   During development, `zcode plugins validate plugins/lazyzcode` validates the
   manifest without installing anything.
5. Report **package readiness** separately. Package checks do not prove plugin
   discovery, command/skill loading, hooks, agents, SessionStart, or an MCP
   connection.
6. Before any host-managed mutation (marketplace add, plugin install, connector
   change, account, credential, or remote provider), ask for explicit approval
   naming the exact action. Never automate trust or install.
7. After approval, give exactly one concrete action and wait. Do not bundle
   discovery, installation, reload, and verification in one handoff.
8. After the user responds, inspect the app and record only what is visibly
   observed. If host inspection is unavailable, a user-pasted verbatim status
   or screenshot counts as observed evidence. If a reload or new session is
   needed, issue the next single action, wait, and inspect again.
9. Verify one real skill or command and every expected MCP connection — six
   servers — in a fresh session. Report the observed host result separately
   from package readiness; without observation, **HOST READINESS: PENDING**
   remains the only honest result.

Route status is explicit: the ZCode plugin marketplace (`zcode-marketplace`)
is the **default full-plugin route**. The `manual-skills-mcp-fallback` is a
recovery-only route. Neither label proves the current host session:
without current observation, **HOST READINESS: PENDING**.

## Host artifact boundary

| Route | Safe package artifact | Host action and expected observation |
| --- | --- | --- |
| **ZCode marketplace (`zcode-marketplace`)** | Root `marketplace.json` for the GitHub URL, local `plugins/marketplace.json` for `<repo>/plugins`, and `plugins/lazyzcode/.zcode-plugin/plugin.json`; 19 skills, 20 commands, 13 agents, 7 hook events, and 6 MCP servers. | **Settings → Plugins → Create → Add marketplace** with `https://github.com/elvinzhao10/LazyZCode` (or local `<repo>/plugins`), then **Personal → lazyzcode → Install** as a separate approved action. Verify a fresh session. |
| **Manual fallback (`manual-skills-mcp-fallback`)** | Skills import/copy from `plugins/lazyzcode/skills/` only, plus six individual manual local MCP connectors. | Use only after the full-plugin route is removed with receipt-scoped ownership. Observe one imported skill and all six connector statuses; commands, agents, and hooks remain excluded. |

## ZCode plugin marketplace handoff

ZCode manages plugins through **Settings → Plugins**. The supported handoff is
one action at a time. The public repository URL has a root `marketplace.json`;
for an offline checkout, use the directory containing the local manifest
(`<repo>/plugins`), not the nested plugin directory:

1. **Action 1 — add marketplace:** after approval, open
   **Settings → Plugins → Create → Add marketplace**, enter
   `https://github.com/elvinzhao10/LazyZCode` (or local `<repo>/plugins`), and wait for the catalog to
   appear. Do not install yet.
2. **Action 2 — install:** after a separate approval, open the **Personal**
   tab, open the `lazyzcode` plugin card, and click **Install**. Installed
   plugins are enabled by default; enabling grants code-execution trust.
   Wait for the install result.
3. **Action 3 — observe:** as a later action, start a fresh session for the
   project, then inspect one real skill (Skill tool / **Settings → Skills**,
   Plugin Skills group) or command (a slash menu entry such as
   `/lazy-ulw-plan`) plus all six MCP connections
   (`plugin:lazyzcode:<server>`).

**Updates:** bump the `version` in
`plugins/lazyzcode/.zcode-plugin/plugin.json` and the matching
`plugins/marketplace.json` and root `marketplace.json` entries, then marketplace **gear → Refresh** →
plugin details → **Update**.

Do not combine these actions, pre-approve trust, or claim host readiness from
marketplace JSON alone. Repeating safe package checks preserves existing
project configuration.

## Read-only preflight

Never inspect or mutate private ZCode configuration or registries to
reproduce installation. The agent may render/check package inputs without
changing host state:

```bash
bash plugins/lazyzcode/scripts/lazyzcode-zcode-preparation-check.sh \
  --project-dir "<absolute-project-root>"
```

This preflight is read-only and prints `HOST_PREPARATION=not-applied`,
`HOST_MUTATION=none`, and `HOST_READINESS=pending`; `--apply` refuses. It is a
package check, not an installer and not host proof. Durable `status --route
zcode-marketplace` emits the exact observation, removal, and recovery receipt
templates. Only a receipt bound to the active source/version and current
build/session, with one loaded skill, command, agent, hook, and all six MCP
connections, may report host ready.

## Manual-skills-MCP fallback

Import only `plugins/lazyzcode/skills/` through **Settings → Skills** or the
documented local import. Add each compatible local MCP connector manually in
Settings: `run-ledger`, `verification`, `status-dashboard`, `context-graph`,
`code-intel`, and `docs`. A package file, manifest, or `load-check` result is
not a live host session and must never be described as loading commands,
agents, hooks, or MCP. If the user supplies real full-plugin proof from a
loaded session, record that observation before relying on any broader surface.
This fallback explicitly excludes commands, Agents, and hooks.

Before changing host settings, prepare the connector values without mutation
from `plugins/lazyzcode/.mcp.json`: replace `${CLAUDE_PLUGIN_ROOT}` with the
absolute `<release-root>/plugins/lazyzcode` and `${CLAUDE_PROJECT_DIR}` with
the absolute `<project-root>`. Every entry must use `command: bash`, one
absolute `args` path
`<release-root>/plugins/lazyzcode/mcp/<server>/server.sh`, `cwd: <project-root>`,
and environment values `CWD=<project-root>` and
`CLAUDE_PROJECT_DIR=<project-root>`. The six `<server>` values are exactly
`run-ledger`, `verification`, `status-dashboard`, `context-graph`,
`code-intel`, and `docs`. Do not edit the shipped `.mcp.json`. The paste-ready
six-entry template is in [Host routes](docs/reference/host-routes.md#manual-connector-specification).
After approval, add one connector, handle any trust prompt as a separate
action, wait for inspection, and only then continue to the next server.

Do not run a full plugin route and the `manual-skills-mcp-fallback` together;
coexistence is unsupported and may duplicate Skills or MCP processes. To
switch, stop the session, remove only LazyZCode's old plugin/Skills entry and
six connectors through the host UI, choose one route, start a fresh session,
then verify that route. Each step is a separate approved action.

## Safe package commands

```bash
# Run from the active durable release; these are package checks only.
node "<install-root>/LazyZCode/launcher.js" status --project "<project-root>"
```

Do not enable optional remote, browser, or architecture capabilities during
onboarding.

## `offboard` protocol

When the user types `offboard`, confirm which route is being removed (the ZCode
plugin, or manually imported skills/connectors). Run durable `offboard` without
`--yes`, present the exact product-root plan, and repeat with `--yes` only
after confirmation. Inspect the selected package receipt first, remove only
exact receipt-owned local assets, and preserve unknown, modified, linked,
caller-owned, project, and host-managed paths. For host state, use
**Settings → Plugins → Manage installed → lazyzcode → Uninstall** (or the
disable toggle) and remove only connectors the user added. Report the package
result separately from the user-observed host result in a new session; never
scan or guess host directories and never remove another host's settings. An
upgrade rollback must likewise remove only the selected release's
receipt-owned assets after approval; never overwrite user-modified
prior-release assets. Removing the plugin is receipt-safe: LazyZCode keeps no
host-side state, and project `.lazyzcode/` state directories can be deleted per
project if their run history is no longer wanted.
Recovery is limited to an explicitly verified lifecycle-owned sibling bootstrap
lock or product `staging/`/`locks/` artifact; the caller workspace is always
preserved.

If `status` reports `STALE_RUNTIME`, do not edit `active.json` or receipts.
Use a fresh checkout from the verified GitHub origin for scoped offboard and
re-onboard with the current Node.js LTS runtime. Treat `rollback/` as retained
recovery evidence, not a hand-edit surface. A moved same-version ref likewise
requires the printed full SHA and explicit `--confirm-revision <full-sha>`.
