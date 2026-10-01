# LazyZCode Plugin

## v1.3.4 installation

**Node.js LTS 24 (recommended) or 22 (supported alternative)** and **Git** are recommended. The lifecycle also accepts Node.js LTS 20 for compatibility. Bootstrap `onboard` only
from `https://github.com/elvinzhao10/LazyZCode.git`, then use
`node "<install-root>/LazyZCode/launcher.js"` for `update`, `status`,
`recover-bootstrap-lock`, and plan-first `offboard`. The exact tree is
`LazyZCode/{active.json,launcher.js,releases/,receipts/,rollback/,staging/,locks/}`;
the source checkout may be deleted. Same-version ref movement requires
`--confirm-revision <full-sha>`, and a stale runtime requires scoped
offboard/re-onboard rather than receipt edits. Package success leaves **HOST
READINESS: PENDING** without current observation. Historical ZCode IDE feedback
about undocumented host state is not an installation route.

> Self-contained workflow harness for ZCode CLI, ZCode IDE, and the ZCode app's Skills/manual-MCP fallback.

This package belongs to the LazyZCode learning project. It is
primarily inspired by LazyCodex, while [NOTICE](NOTICE) records LazyCodex and
OmO upstream attribution. It is an independent implementation and does not
require LazyCodex or OmO at runtime.

## Durable onboarding

Bootstrap from a verified official source checkout, then use the
durable launcher rather than treating that checkout as the installed runtime:

```bash
node "<verified-source-root>/plugins/lazyzcode/scripts/lazyzcode-lifecycle.js" \
  onboard --source https://github.com/elvinzhao10/LazyZCode \
  --install-root "<absolute-install-root>" --project "<absolute-project-root>" --json
node "<install-root>/LazyZCode/launcher.js" status \
  --install-root "<install-root>" --project "<project-root>" --json
```

The source checkout is transport only and may be removed after promotion. The
durable install root must be absolute, non-root, and outside disposable
downloads or caches. Open or link the active durable release in the selected
ZCode CLI, ZCode IDE, or ZCode app host, give the agent `https://github.com/elvinzhao10/LazyZCode`,
and type `onboard`. The agent asks which host is in use, runs safe package
checks, and reports **package readiness** separately from **host readiness**.
Before any host-managed marketplace, plugin, Skills, connector, account, or
credential action it asks for approval, then gives one exact action and waits.
After the response it inspects the app with Computer Use; reload/new session is
a separate action. If Computer Use is unavailable, a user-pasted verbatim
status or screenshot is observed evidence. Without either, **HOST READINESS:
PENDING**.

If lifecycle state collides with an existing path, preserve the caller
workspace. Only an explicitly verified lifecycle-owned sibling bootstrap lock
or product `staging/`/`locks/` artifact is recoverable; never remove or replace
caller workspace files.

Route status is explicit: `zcode-marketplace` is the default full-plugin route
through **Settings → Plugins**. `manual-skills-mcp-fallback` is
recovery-only and mutually exclusive with the full-plugin route. Neither
route is current host proof until observed.

## Quick Start

`.zcode-plugin/plugin.json` is the documented ZCode CLI host entry point.
`.zcode-plugin/plugin.json` is the ZCode app marketplace source for Skills,
commands, agents, hooks, and all six MCP servers. Package metadata remains
pending until current build/session evidence is observed. Skills import/copy
plus six individual manual local MCP connectors is recovery-only.

1. **Onboard** — bootstrap the durable release, open or link that active
   release in the selected host, and type `onboard` after providing the GitHub
   repository link.
2. **Verify the package** — from this `plugins/lazyzcode/` directory, run `bash scripts/lazyzcode-load-check.sh`, then `bash scripts/lazyzcode-plugin-doctor.sh`. These checks report package readiness, not host loading or MCP connection.
3. **Verify the host** — in ZCode CLI, confirm one `/lazy-<command>` or Skill and all six MCP connections in a new session. In ZCode IDE, confirm an imported Skill and each manually configured local connector; do not infer commands, agents, hooks, or MCP loading from files or load-check output without full-plugin proof.
4. **Use the workflow** — in ZCode CLI, `/lazy-<command>` commands; in ZCode IDE, use the equivalent natural-language workflow or imported skill unless a verified plugin session exposes a command.

**Verification scope:** package CI targets Ubuntu and macOS. Repository-level public guides cover the
workflow and host-specific onboarding/offboarding; package readiness remains
package evidence, not proof of live host loading or MCP connection.

### Model routing

Package agents omit `model` and inherit the current session model, pinning a
`thoughtLevel` budget instead. Plans may classify work as `efficient`,
`inherit`, or `performance`; the read-only helper
`node contracts/model-routing.js --host zcode --task <class>` produces a
recommendation that stays advisory until the host visibly honors it. See
[docs/model-routing.md](docs/model-routing.md) for the full boundary.

## What this plugin provides

LazyZCode provides a workflow harness for ZCode CLI, ZCode IDE, and the ZCode app. ZCode app plugin/marketplace behavior must be verified in a live session; its local fallback uses imported skills:

- **Hierarchical project memory** (`/lazy-init-deep`) — generates `AGENTS.md` with directory scoring
- **Prometheus planning** (`/lazy-ulw-plan`) — decision-complete work plans; never writes product code
- **Orchestrated execution** (`/lazy-start-work`) — delegates to subagents; never implements directly
- **Verified completion loop** (`/lazy-ulw-loop`) — evidence-backed done claims with adversarial verification
- **5-agent parallel review** (`/lazy-review-work`) — goal/QA/code/security/context; all 5 must pass
- **Ultrawork mode** (`/lazy-ultrawork`) — binding directive with tier triage and Manual-QA discipline

### Execution evidence and recovery

`lazy-start-work` dispatches a compact `TASK/DELTA/REFS/VERIFY` record rather
than copying the whole plan into each worker prompt. The record binds the
current run/task/revision and criteria to an owned-path delta, read-only
pre-task provenance, artifact references, and once-validated plan argv. The
validator rejects shell composition plus destructive, remote, host-mutating,
or approval-requiring argv before dispatch; it does not execute those commands.

Runtime criteria need a real package/public entry artifact, and stateful
criteria also need a before/after transition artifact. A lost worker result can
update memory only through a complete, current identity-bound terminal report
whose artifact references are readable. Five-lane review retains unaffected
current PASS lanes and reruns only failed, missing, stale, or input-affected
lanes. If `create-run` is interrupted before `state.json` exists,
`recover-run.sh` rolls back only its transaction material, preserves caller
files, and leaves the run eligible for retry.

## Component Map

| Directory | Purpose | Status |
|-----------|---------|--------|
| `skills/` | 19 workflow skills | Full-plugin content; manual fallback imports Skills only |
| `commands/` | 20 current slash-command workflows | ZCode CLI; ZCode app only after a verified plugin/marketplace session |
| `agents/` | 13 agent role definitions | ZCode CLI; ZCode app only after a verified plugin/marketplace session |
| `hooks/hooks.json` | 7 hook events | Full-plugin declaration; host activation requires observation |
| `mcp/` and `.mcp.json` | 6 local MCP server declarations | ZCode CLI declarations; manual connector configuration is the verified ZCode app fallback |
| `scripts/` | state, loop, hooks, and validation utilities | Used by package readiness and workflow checks |
| `templates/AGENTS.md` | reusable onboarding guide | A template; no installer claims it was generated |

## Install

For current ZCode steps, use the installation and host-route guides in the
source repository. Those guides are outside this installable plugin package.
The marketplace root is `<repo>/plugins`, the directory containing
`marketplace.json`; the nested `plugins/lazyzcode/` directory is the plugin,
not the marketplace root. ZCode manages marketplace discovery and installation
through **Settings → Plugins**, and package checks do not perform
those host actions.

For read-only development validation from the repository root:

```bash
bash plugins/lazyzcode/scripts/lazyzcode-load-check.sh
bash plugins/lazyzcode/scripts/lazyzcode-plugin-doctor.sh
zcode plugins validate plugins/lazyzcode
```

The first two commands validate package inputs. The `zcode plugins validate`
command is optional when the host CLI is available; it validates declarations
without installing the plugin. All three are package evidence only. After the
full plugin is installed, observe one real skill or command and all six MCP
connections in a fresh session. The manual fallback imports Skills and six
individual connectors only; it does not load commands, agents, or hooks.

## ZCode CLI project-local configuration

`.zcode/settings.json` may be shared for non-secret project defaults.
`.zcode/settings.local.json` is local/machine scope and must remain ignored
and unstaged; secrets must never be committed. Repeating the local marketplace
route or package readiness checks preserves both files and does not write host
configuration.

Marketplace metadata and local file validation establish **package readiness**;
they are not evidence that commands, agents, hooks, or MCP loaded in a host.

The package readiness contract labels these reports `readiness_scope=package-ready`.
`observed-build-route`, `manual-skills-mcp-fallback`, and `live-host-proof` are
separate host-observation scopes. The fallback is Skills-only plus six manual
MCP connectors; agents, commands, and hooks are excluded. Do not combine the
fallback with a full plugin route for the same project. Stop the session,
remove the old LazyZCode route through the host UI, select one route, restart,
and verify it in a fresh session.

## Uninstall

Use ZCode CLI's plugin removal flow for a ZCode CLI or CLI installation,
then remove or disable only the LazyZCode MCP servers that were manually
registered. Use ZCode IDE's documented plugin/marketplace removal flow for a
verified ZCode IDE plugin installation. For the local-import fallback, remove
the imported `skills/` entries through ZCode IDE's Skills UI and remove the
manually configured connectors through Settings. Never guess, scan for, or
delete host-managed installation paths, `.zcode-plugin` compatibility
metadata, `.zcode` state, or MCP configuration belonging to another host.
The copied repository is independent of host removal and may be deleted only
after the host confirms the plugin/skills and connectors are gone. The root
`offboard` protocol records this package result separately from the
user-observed host result.

## Verify

`scripts/lazyzcode-verify.sh` requires Python 3.10 or newer before it starts
any Python helper. The canonical `all` suite also requires pytest. When
`python3` resolves to an older interpreter, it exits
with `ERROR: LazyZCode requires Python 3.10 or newer. Install Python 3.10+ and make it available as python3.`
Set `LAZYZCODE_PYTHON` to an explicit supported interpreter when `python3`
cannot be updated system-wide.

```bash
# Run from plugins/lazyzcode/.
bash scripts/lazyzcode-plugin-doctor.sh

# Smoke test: checks SKILL.md frontmatter and command stubs.
bash scripts/lazyzcode-smoke-test.sh

# Docs check: verifies no broken internal links, including templates/AGENTS.md.
bash scripts/lazyzcode-docs-check.sh

# From the release root, install locked verification dependencies in an isolated
# temporary root, then run the aggregate checks without modifying the package.
bash plugins/lazyzcode/scripts/lazyzcode-package-verify.sh
```

The wrapper requires npm registry access. It reads the shipped lockfile,
installs with `npm ci --ignore-scripts` from inside a temporary root, cleans
that root on exit or interruption, and keeps
the extracted release unchanged. The verifier itself is local-only and bounded.
Missing registry access must fail instead of reporting package verification
success. Its canonical Python suite also fails closed when the selected
supported interpreter does not provide pytest.

The canonical `all` aggregate preserves explicit shell-regression
classifications and runs those shell checks serially. It also discovers every
`tests/*.test.js` file and
runs Node tests with concurrency 2 by default (configurable from 1 through 4
with `LAZYZCODE_NODE_TEST_CONCURRENCY`), then runs
`python -m pytest tests tooling`. Its final JSON reports `shell_regressions`,
`node_tests`, and `python_tests`; nested verifier calls mark each as
`skipped-nested` instead of recursively scheduling them. The `core` and
`lifecycle` shell partitions report language suites as `skipped-suite` so
partitioned CI does not duplicate the canonical language run.

Verification-risk reports keep timing in memory and expose monotonic
`elapsed_ms` values for the full run and each gate. The checked-in efficiency
fixtures use `validation_elapsed_ms` so their historical validation duration
cannot be confused with a newly measured report-run duration.

The aggregate command is installed package health and does not read repository-
root learner pages. In a repository checkout, publication validation is a
separate release check: `bash plugins/lazyzcode/tests/publication-regression.sh`.

Package readiness, doctor, and capability-status output are read-only package
evidence. They do not activate optional providers, install a global host
integration, or prove that a live host session connected an MCP server. See the
package-owned [verification matrix](docs/verification-matrix.md) for the local
checks and manual host observations.

Verification timeouts are best-effort cleanup for trusted package-owned
commands. Each command receives its own process group; a deadline terminates
that group and reports any still-detectable descendants in JSON/stderr. This is
not a security sandbox or a guarantee that every descendant stopped. Use a VM or container-backed runner for genuinely untrusted commands; no no-fork sandbox is enabled by default.

## Optional local tooling

LazyZCode can use a local, package-owned fallback for `rg` (ripgrep) and `sg`
(ast-grep). It first detects compatible host tools without changing them. When
one is missing, installation is allowed only into an empty, absolute tooling
root chosen by the caller; it never installs into a target project, global
location, or host-managed path.

```bash
# Inspect host/owned providers without changing anything.
bash scripts/lazyzcode-tooling.sh detect --tooling-root "/absolute/path/to/lazyzcode-tools"

# Install locked fallback tools only when host providers are missing.
bash scripts/lazyzcode-tooling.sh install --tooling-root "/absolute/empty/lazyzcode-tools"

# Inspect repository-native checks without running them.
bash scripts/lazyzcode-tooling.sh verify --target "/absolute/project" --dry-run

# Run only explicitly selected, declared checks with a 60-second default limit.
bash scripts/lazyzcode-tooling.sh verify --target "/absolute/project" --run lint test

# Remove only an unmodified LazyZCode receipt-owned tooling root.
bash scripts/lazyzcode-tooling.sh uninstall --tooling-root "/absolute/path/to/lazyzcode-tools"
```

Repository verification recognizes package-manager lockfiles plus declared
`lint`, `typecheck`, `test`, and `build` scripts, explicit
`[tool.lazyseries.verification]` commands in `pyproject.toml`, and declared
Make targets. Dry runs do not change the target. Runs do not install target
dependencies or guess commands; a timed-out selected check exits `124`.

### Automatic capability selection and approvals

Automatic workflow selection chooses the smallest sufficient existing workflow
from task risk and complexity. It is selection-only until host readiness is
observed: package output must not claim native workflow loading or host
dispatch. The compact task packet is 1,637 bytes rather than 2,285 bytes
(648 bytes / 28.36% smaller); required safety, approval, evidence, review, and
completion gates are unchanged.

The installed package carries the versioned automatic-tooling contract and its
provider-policy adapter. Start with an offline status check or create the
reference-only user configuration:

```bash
bash scripts/lazyzcode-tooling.sh setup --non-interactive --json
bash scripts/lazyzcode-tooling.sh providers --policy ask-once --json
```

Automatic work is task-scoped: the broker selects the lightest eligible
provider for that task and does not write host MCP configuration or export a
registration. Local providers are free/read-only where available. Remote,
metered, browser, and architecture capabilities remain approval-aware; use
`approval grant|deny|revoke` with an explicit workspace, capability, provider,
and scope before persistent consent is recorded. Provider output identifies
cost, reachability, credential-reference state, and the current decision.

`remote-enable` is a separate persistent compatibility command. It records an
explicit optional Context7 or `grep_app` selection only in the verified
tooling root; `remote-export-mcp` prints a namespaced merge fragment for the
host UI. Neither command edits host configuration, replaces host entries, or
writes raw credentials. Treat every remote call as potential data egress and
cost even when its provider is marked read-only.

Playwright is also disabled until an approval decision permits browser
automation. CodeGraph remains a separate explicit install/init/enable flow;
the automatic broker does not create an index, launch a process, or enable
telemetry. The local `context-graph` MCP remains only a grep-based fallback.

### Optional language-aware navigation

LazyZCode can bridge a real language server over stdio for JavaScript/
TypeScript and Python only. It first detects source/configuration, then uses a
compatible project-local or host provider without changing it. If neither is
available, provision exactly one selected language into a separate empty,
absolute LSP tooling root. The bridge exposes only read-only operations the
provider advertises: definition, references, symbols, hover/type information,
and diagnostics. Rename is intentionally unavailable.

```bash
# Inspect without changing the project or tooling root.
bash scripts/lazyzcode-tooling.sh lsp-status \
  --target "/absolute/project" --tooling-root "/absolute/lazyzcode-lsp-tools"

# Provision the detected TS/JS or Python provider only in the empty root.
bash scripts/lazyzcode-tooling.sh lsp-install \
  --target "/absolute/project" --tooling-root "/absolute/empty/lazyzcode-lsp-tools"

# A host MCP configuration can launch this package-owned stdio bridge.
CWD="/absolute/project" LAZYZCODE_TOOLING_ROOT="/absolute/lazyzcode-lsp-tools" \
  bash mcp/lsp/server.sh

# Remove only an unmodified LSP receipt-owned root.
bash scripts/lazyzcode-tooling.sh lsp-uninstall \
  --target "/absolute/project" --tooling-root "/absolute/lazyzcode-lsp-tools"
```

The locked TS/JS provider is `typescript-language-server@5.3.0` with
`typescript@6.0.3`; it requires Node.js 20 or newer. The locked Python
provider is `basedpyright@1.39.10`. Missing, unsupported, and incompatible
providers are non-blocking readiness states. No target manifest, lockfile,
source file, global path, or host-managed configuration is modified.

### Conditional CodeGraph architecture exploration

CodeGraph is an optional, real local MCP capability for larger architecture and
cross-file relationship questions. It is disabled by default. LazyZCode keeps
`context-graph` available as a clearly labeled grep-based heuristic fallback;
it is not represented as semantic CodeGraph analysis.

CodeGraph is pinned to `@colbymchenry/codegraph@1.6.0` and can only be
provisioned in an explicit empty caller-owned tooling root. The lifecycle does
not invoke upstream `codegraph install` or `codegraph uninstall`, download a
fallback platform binary, enable CodeGraph telemetry, or change host MCP
configuration. Its npm cache, npm configuration, Python cache, and CodeGraph
runtime are confined to the receipt-owned tooling root. Start only after you
deliberately choose a project root:

```bash
# Inspect only. This never starts CodeGraph or creates .codegraph/.
bash scripts/lazyzcode-tooling.sh codegraph-doctor \
  --target "/absolute/project" --tooling-root "/absolute/lazyzcode-codegraph-tools"

# Provision the pinned package, build the project-local index, then enable it.
bash scripts/lazyzcode-tooling.sh codegraph-install \
  --target "/absolute/project" --tooling-root "/absolute/absent/lazyzcode-codegraph-tools"
bash scripts/lazyzcode-tooling.sh codegraph-init \
  --target "/absolute/project" --tooling-root "/absolute/lazyzcode-codegraph-tools"
bash scripts/lazyzcode-tooling.sh codegraph-enable \
  --target "/absolute/project" --tooling-root "/absolute/lazyzcode-codegraph-tools"

# Print an explicit MCP registration fragment; merge it through the host UI.
bash scripts/lazyzcode-tooling.sh codegraph-export-mcp \
  --target "/absolute/project" --tooling-root "/absolute/lazyzcode-codegraph-tools"

# Remove only an index proven by LazyZCode's receipt, then remove the tooling root.
bash scripts/lazyzcode-tooling.sh codegraph-uninstall \
  --target "/absolute/project" --tooling-root "/absolute/lazyzcode-codegraph-tools"
bash scripts/lazyzcode-tooling.sh uninstall \
  --tooling-root "/absolute/lazyzcode-codegraph-tools"
```

`codegraph-doctor` recommends the capability only at 500 supported source files
or 100,000 supported source lines. It makes no network, process, or index call.
The MCP launcher invokes only `codegraph serve --mcp` with fallback download
disabled. A pre-existing `.codegraph/` directory is preserved by uninstall.

### Optional remote documentation and example search

Context7 and `grep_app` are optional remote MCP registration fragments, not
bundled MCP servers and not part of the six-server package declaration. They
are disabled by default: install, status, and doctor never contact either
endpoint. Select one only when it materially helps: Context7 for current,
version-specific library documentation; experimental, unpinned `grep_app` for
public GitHub examples when local evidence is insufficient.

Use a verified receipt-owned tooling root, then export the fragment and merge
it through the host UI without replacing existing MCP entries. The fragment
uses namespaced keys, contains endpoints only, and deliberately contains no
credentials; any credential remains in the user's host environment.

```bash
# Inspect optional state without making a remote request.
bash scripts/lazyzcode-tooling.sh remote-status \
  --tooling-root "/absolute/lazyzcode-tools"

# Enable only the desired registration fragments.
bash scripts/lazyzcode-tooling.sh remote-enable \
  --tooling-root "/absolute/lazyzcode-tools" context7
bash scripts/lazyzcode-tooling.sh remote-enable \
  --tooling-root "/absolute/lazyzcode-tools" grep_app

# Print a merge-only MCP fragment; it does not edit host configuration.
bash scripts/lazyzcode-tooling.sh remote-export-mcp \
  --tooling-root "/absolute/lazyzcode-tools"

# Disable an optional registration without touching any host entry.
bash scripts/lazyzcode-tooling.sh remote-disable \
  --tooling-root "/absolute/lazyzcode-tools" context7
```

## License

MIT — see the package [LICENSE](LICENSE) and [NOTICE](NOTICE).

---

_This is the installable ZCode CLI, ZCode IDE, and ZCode app package for LazyZCode.
`.zcode-plugin/plugin.json` is the ZCode app marketplace source, not proof
that a host loaded it. Use the local `skills/` import plus manual MCP only as a
receipt-scoped recovery route. The repository-local `.zcode/` directory is
host-managed development state and is intentionally not part of the release
package._
