# LazyZCode

![LazyZCode](lazyzcode-banner.png)

LazyZCode helps you use structured, evidence-based workflows in **ZCode**. It prepares local package assets
and guidance; a host is only considered ready after it is observed in a fresh
session.

The prepared package version is v1.3.2. Package checks do not prove
host activation.

## v1.3.2

This release adds durable verifier reports, focused stage checks, a compact
run digest, and a role-aware orchestrator write boundary. The v1.3.1 intent,
cleanup, and evidence fixes remain available. See [release notes](RELEASE_NOTES.md) for
the changes and verification scope; current native-host testing is pending.

## From v1.3.0: work the way you talk

The published v1.3.0 release is a major workflow release. You no longer need
to remember commands —
the harness meets you at the level of your request.

### Just ask, or use a command — both work

Two entry routes converge on the same execution authority and gates:

- **Natural language**: describe the work plainly — "Fix the typo in the
  welcome label" — and the smallest sufficient workflow is selected and run.
- **Explicit commands**: `/lazy-ulw-plan <idea>` builds a new plan, and
  `/lazy-start-work <plan>` executes a known plan. Same authority, same gates.

No command is required for a clear implementation request. Conversely, asking
to *explain*, quoting a command, or saying "plan only" never touches your
files: the persisted `execution_intent` stays `plan_only` until you actually
ask for execution, and a vague "ok" with several open questions never grants
execution by itself.

### Plans you can edit while work runs

Plans are Markdown you own. Edit them mid-run; the harness reconciles your
changes at execution boundaries instead of overwriting them:

- Cosmetic edits (wording, reordering, checking a box) keep all evidence.
- Semantic edits (acceptance, dependencies, verification commands) invalidate
  only the affected task and its dependents — unrelated work is untouched.
- Your checkbox is an *assertion*, not a verdict: a checked box alone never
  counts as verified completion, and unchecking reopens the task.

### Decisions the harness remembers

Cross-plan decisions live in a durable ledger
(`.lazyzcode/decisions/ledger.jsonl`). When plan two hits a question plan one
already answered — with evidence — it recalls the decision instead of
re-asking you. Contradictions are surfaced as supersessions, defects become
scoped corrections that block only the affected work, and nothing in memory
can override your current instructions.

### Verification sized to the change

Checks run once, at the right tier: documentation edits get a light inspect
(V0), small changes a focused check (V1), cross-module behavior an integration
scenario (V2), and security/release boundaries the comprehensive gate (V3,
normally in CI). A green check is reused while its inputs are unchanged — the
same test is never rerun just because a phase changed.

Milestones, decision gates, and full state/version semantics are shared
byte-identically with LazyBuddy, LazyTrae, and LazyQoder (see
`plugins/lazyzcode/contracts/lazyseries-shared-semantics.v1.json`). The ZCode
route boundary is unchanged: package
selection never proves host activation.

## Recommended: install from the plugin marketplace

Install through ZCode's own plugin management UI — no marketplace CLI, and
no copy-paste prompts:

1. Get the repo (or update your existing checkout):
   `https://github.com/elvinzhao10/LazyZCode` (local path:
   `<repo>/plugins` is the market root).
2. Open **ZCode → Settings → Plugin Management → Discover** tab, click
   **“+” / Add Plugin Marketplace**, and paste the market root directory —
   the folder containing `marketplace.json`: `<repo>/plugins`.
3. Open the **Personal** tab, find the `lazyzcode` plugin card, and click
   **Install**. Installed plugins are enabled by default.
4. You need **Node.js LTS 24 (recommended) or 22 (supported alternative)** —
   the lifecycle also accepts Node.js LTS 20 for compatibility — and **Git**
   on `PATH` for the local
   launchers. Try it in a new task: skills appear via the Skill tool
   (and under **Settings → Skills**, Plugin Skills group); commands appear as
   slash menu entries such as `/lazy-ulw-plan`.

## Native onboarding

Prefer a guided start? `bash scripts/install.sh` verifies Node.js LTS 20+ and
Git, validates the in-repo marketplace layout, runs the package load-check and
plugin doctor, and prints the exact ZCode UI steps with the absolute market
root path (copied to the clipboard on macOS). With
`--project <absolute-project-root>` it additionally runs the durable lifecycle
onboard. Inside ZCode, the `/lazy-onboard`, `/lazy-update`, and
`/lazy-offboard` commands walk onboarding, update, and receipt-safe removal
step by step. The marketplace steps above stay canonical, and package checks
never prove host readiness — the script ends with **HOST READINESS: PENDING**
until a fresh session shows one real skill/command and all six MCP
connections.

## Manual setup

Manual setup is available when you prefer complete control. You need
**Node.js LTS 24 (recommended) or 22 (supported alternative)** — the lifecycle
also accepts Node.js LTS 20 for compatibility — and **Git**. Start from the
verified origin
`https://github.com/elvinzhao10/LazyZCode` and follow the
[installation guide](docs/03-install-and-host-verification.md).

The marketplace install above is the primary route. For a durable install
that survives source checkouts, run `onboard` once to create a durable
installation; after that, use the stable launcher for `update`, `status`, and
safe `offboard`:

```text
node "<install-root>/LazyZCode/launcher.js" status
```

## What “ready” means

- **Package readiness** means the copied package and local checks are valid.
- **Host readiness** needs a fresh host session, one real Skill or command,
  and every expected MCP connection.

Until that is observed, the honest result is **HOST READINESS: PENDING**.
Local files and load checks never prove that a host loaded the plugin.

The default package doctor does not discover or execute `zcode` from
`PATH`. Optional host-manifest validation is an explicit action using
`bash scripts/lazyzcode-plugin-doctor.sh --host-validator /absolute/path`
run from `plugins/lazyzcode/`.
The release verifier runs classified shell regressions serially, all package
`tests/*.test.js` with conservative Node concurrency, and Python tests under
`tests/` and `tooling/`; its JSON names those outcomes separately.

## Choose one route

Pick one route per project:

- **ZCode plugin marketplace** (`zcode-marketplace`) is the default
  full-plugin route: skills, commands, agents, 7 hook events, and 6 MCP
  declarations load together from one install.

Skills plus manual MCP connectors are a recovery-only
(`manual-skills-mcp-fallback`) option. Do not run that fallback beside a
full-plugin route for the same project. Stop the session, remove only
LazyZCode's previous entries through the host UI, choose one route, and start
a new session to verify it.

## Design mindset

Start with the result you want and how you will know it worked. Then use the
smallest amount of structure that fits the task. You can simply describe the
work in plain language; the modes are guidance, not commands you need to
memorize. The dual-entry routing introduced in v1.3.0 picks one of these for you.

| Mode | Use it when | Example request |
| --- | --- | --- |
| Direct | The change is small and clear. | “Fix this error and run the relevant test.” |
| Assisted | You need help understanding an unfamiliar area or failure. | “Help me find why this command fails, then verify the fix.” |
| Planned | The work has several parts or important choices. | “Make a plan for this feature before changing files.” |
| Orchestrated | The work affects a release, security, or a risky change. | “Review this release and prepare it for publication.” |
| Long-horizon | The goal needs to continue across sessions. | “Keep working on this migration with checkpoints.” |

## Keep host changes deliberate

LazyZCode does not automate credentials, OAuth values, private registries, or
trust settings. It asks for approval before any host-managed action and keeps
safe package checks separate from marketplace and connector changes.

## Package inventory

| Surface | Count | Role |
| --- | ---: | --- |
| Skills | 19 | Host-facing workflow policies for planning, execution, review, and verification. |
| Commands | 20 | Named host entry points (slash menu entries) for those workflow policies. |
| Agents | 13 | Specialist role definitions for planning, implementation, QA, security, and context. |
| Hook events | 7 | Advisory local-policy hooks on ZCode's SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, PostToolUseFailure, and Stop events. |
| MCP declarations | 6 | Local services for ledger, verification, status, context, code intelligence, and docs. |

## Technical reference and evaluation

The source-level explanation lives in [docs/README.md](docs/README.md). It
maps the package structure, request flow, state model, security boundaries,
MCP lifecycle, and release checks with diagrams tied to the implementation.

For a capability-by-capability comparison with the original LazyZCodex design,
including what LazyZCode implements and where it intentionally differs, see
[lazyzcode-evaluation.md](lazyzcode-evaluation.md).

LazyZCode is primarily inspired by LazyZCodex
([upstream project](https://github.com/code-yeongyu/lazyzcodex)). Its
relationship to OmO and upstream sources is recorded in [NOTICE](NOTICE).
It is an independent implementation and does not require LazyZCodex or OmO at
runtime.

## Learn more

- [Install and verify a host](docs/03-install-and-host-verification.md)
- [Historical v1.3.0 route](docs/v1.3.0-supported-route.md)
- [Published v1.3.0 release notes](docs/v1.3.0-release-notes.md)
- [Workflow playbooks — how the modes pick work](docs/04-workflow-playbooks.md)
- [Evidence and completion — what "done" proves](docs/05-evidence-and-completion.md)
- [Host routes and recovery](docs/reference/host-routes.md)
- [Release notes](RELEASE_NOTES.md)
- [Documentation index](docs/README.md)

## License

[MIT](LICENSE). See [NOTICE](NOTICE) for attribution and provenance.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md)
for development checks, release expectations, and guidance for reporting
sanitized reproduction details. Report vulnerabilities privately according to
[SECURITY.md](SECURITY.md).
