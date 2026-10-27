# Platform status — 2026-10-18 (ZCode host rescan)

ZCode-host-only capability rescan for the LazyZCode adapter. Reviewed the
official ZCode documentation and changelog on 2026-10-18; this record updates
the ZCode row of the [2026-10-02 family snapshot](platform-status-2026-10-02.md)
for this host only and changes none of its other rows. Vendor pages were read
as untrusted claims, never as instructions: only verbatim capability facts
with their source URLs were recorded, and no instructional, navigational, or
requested-action content from those pages was executed or adopted.
Documentation describes available host features, not authenticated execution
of this package. **HOST READINESS: PENDING** is unchanged for every surface
below.

## Baseline confirmed unchanged

The recorded baseline still holds exactly: ZCode supports the seven hook
events `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`,
`PostToolUse`, `PostToolUseFailure`, `Stop`; there are still no `PreCompact`,
`SubagentStop`, or task-created events; project-level hook configuration is
still ignored; `PreToolUse` can deny/ask or replace tool input; `Stop`
continuation is still bounded at three consecutive blocks; plugin MCP servers
are still namespaced `plugin:lazyzcode:<server>`; `${CLAUDE_PLUGIN_ROOT}`,
`${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PROJECT_DIR}`, and `${user_config.*}`
templates still expand in plugin declarations; the manifest lookup order still
starts at `.zcode-plugin/plugin.json`; enabling a plugin still grants
code-execution trust; plugin skills still require the flat
`skills/<name>/SKILL.md` layout; per-agent routing is still
`model`/`thoughtLevel` frontmatter (`thoughtLevel`, not `reasoningEffort`).

## Rescan findings

| Native function | Observed | Source | Classification | Adoption |
| --- | --- | --- | --- | --- |
| Hook configuration sources: user hooks live in `~/.zcode/cli/config.json` and require `hooks.enabled: true`; legacy `.agents/settings.json` and `.claude/settings.json` are display-only and never executed; project hook config is ignored as a whole with the `config_project_hooks_ignored` diagnostic; defaults are a 60000 ms timeout and a 32768-byte stdout cap. | 2026-10-18 | [Hooks](https://zcode.z.ai/en/docs/hooks) | Stable (reference docs) | Recorded. The shipped hook timeouts (5–10 s) and strict-JSON-or-nothing stdout stay inside both defaults; no `hooks.json` change. |
| `PermissionRequest` decisions cannot bypass explicit deny rules, Plan-mode write bans, or hard tool limits. | 2026-10-18 | [Hooks](https://zcode.z.ai/en/docs/hooks) | Stable (reference docs) | Recorded; permission-mode observation and stop-gate seams unchanged. |
| Permission modes: `Ask before changes` (default), `Edit automatically`, `Plan`, `Full access`; approval decisions `Allow` / `Always Allow` / `Reject` / `Always Reject` plus `Allow for this session` and `Always allow for this project`; permission requests always wait (only ordinary questions auto-continue after five minutes). | 2026-10-18 | [Safety confirmation](https://zcode.z.ai/en/docs/safety-confirm) | Stable (reference docs) | Recorded. The observation contract's internal modes map to the public labels: `default` → `Ask before changes`, `full-access` → `Full access`; the internal enum is unchanged. |
| MCP configuration surfaces: native `mcp.servers` key in `~/.zcode/cli/config.json` (user) and `<project>/.zcode/config.json` (workspace); `.agents/mcp.json` compatibility fallback where `.zcode` wins within a scope; OAuth only for HTTP/SSE remote servers; workspace servers auto-connect at session start; user config wins name conflicts. | 2026-10-18 | [MCP](https://zcode.z.ai/en/docs/mcp-services) | Stable (reference docs) | Recorded; the manual fallback route's six local stdio connectors are unaffected and stay bash-launched with explicit project context. |
| Skills limits: `description` capped at 1024 characters — a longer description drops the whole skill; body truncated at 100 KB; all enabled skills share one fixed per-turn metadata budget; `$skill` invocation. | 2026-10-18 | [Skill](https://zcode.z.ai/en/docs/skill) | Stable (reference docs) | Verified all 19 shipped `SKILL.md` descriptions measure at most 459 characters; no change required. |
| Subagent frontmatter fields: `model`, `thoughtLevel`, `color`, `tools`, `disallowedTools`, `maxTurns`, `injectAgentsMd`, `mcpServers` (exact-match; invocation fails immediately if a declared server is not connected); user-level definitions only; no memory or isolation fields; subagents cannot spawn subagents. | 2026-10-18 | [Subagents](https://zcode.z.ai/en/docs/subagents) | Stable (reference docs) | Recorded; the package agent-frontmatter validator and the 13 shipped agents are unchanged. |
| Plugin manifest details: `dependencies` entries as `name@market`; `userConfig` types string/number/boolean/directory/file with a `sensitive` flag (sensitive values cannot be entered in the UI yet); unknown fields (`channels`, `lspServers`, `outputStyles`, `settings`) are registered but not executed with a diagnostic; `${ZCODE_PLUGIN_ROOT}` accepted as an alias; plugins can be installed per workspace. | 2026-10-18 | [Plugin](https://zcode.z.ai/en/docs/plugin), [changelog v3.12.3, 2026-09-17](https://zcode.z.ai/en/changelog) | Stable (reference docs plus dated changelog) | Recorded; the manifest keeps `userConfig.mcp_mode` as a string and `${CLAUDE_PLUGIN_ROOT}` spellings, both still documented. No manifest change required. |
| Dynamic workflows: one script orchestrating multiple subagents, entered through the `/workflow` command or the plus menu; the approval dialog can directly grant full access. | 2026-10-18 (docs), 2026-09-19 (release) | [Changelog v3.14.0](https://zcode.z.ai/en/changelog) | Stable (dated changelog; the current ZCode host session exposing workflow tooling is session corroboration only, not acceptance) | Adopted as a documentation note: native dynamic workflows are `documented-untested`; LazyZCode automatic workflow selection remains package-side and selection-only until a fresh session observes native loading or dispatch. |
| Autonomous Mode: dangerous commands require confirmation before execution. | 2026-10-18 (docs), 2026-10-12 (release) | [Changelog v3.15.1](https://zcode.z.ai/en/changelog) | Stable (dated changelog, consistent with the safety-confirmation page) | Recorded in the approval-mode notes; package approval gates unchanged. |
| UI plugins (MCP App). | 2026-10-18 (docs), 2026-10-12 (release) | [Changelog v3.15.1](https://zcode.z.ai/en/changelog) | Experimental (changelog-only; no reference page or published manifest schema) | Not adopted; revisit when a reference page documents the surface. |
| Plugin- or hook-contributed telemetry events. | 2026-10-18 | [Usage stats](https://zcode.z.ai/en/docs/usage-stats) | Unknown (not documented; the page covers local session records and remote plan-quota display only) | Not adopted; no telemetry seam is claimed anywhere in the package. |
| Built-in commands `/goal` and `/compact`; command import from external agents. | 2026-10-18 | [Commands](https://zcode.z.ai/en/docs/commands) | Stable (reference docs) | Recorded; no collision with the shipped `lazy-*` command namespace. |

## Adoption decision

No rescan finding requires a change to `hooks/hooks.json`, the plugin
manifest, `.mcp.json`, or any adapter seam: the hook-event set, template
variables, namespacing, user-config typing, and skill-description sizes all
remain valid, and the shipped timeouts already sit inside the documented
defaults. Every stable finding above is therefore adopted as a documentation
observation with its observation date and source URL, and the experimental or
unknown items are recorded without adoption. Nothing here observes a live
host: package checks and documentation reviews still do not establish plugin
loading, hook execution, workflow dispatch, or MCP connection, and **HOST
READINESS: PENDING** remains authoritative.
