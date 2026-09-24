---
description: "Generate hierarchical project memory. Inspect repo structure, score directories by complexity, generate zcode.md at root and subdirectory variants, and produce a .lazyzcode/context/ knowledge base."
argument-hint: "[--create-new] [--max-depth=N]"
skills: lazy-init-deep
---

Use the `lazy-init-deep` skill for this request.

$ARGUMENTS

# /lazy-init-deep

Generate hierarchical project memory. Scores directories by complexity, produces `zcode.md` at root and subdirectory variants, and writes a `.lazyzcode/context/` knowledge base for future agents.

## ZCode mapping

LazyZCode's hierarchical memory primitive maps to **AGENTS.md** (the project-memory file ZCode injects into every session; `/init` creates or updates it). The `lazy-init-deep` skill layers a writable `zcode.md` project-memory tree on top of `AGENTS.md` — a consumer helper preserves an existing `AGENTS.md` and only creates it when absent.

## Usage

```
/lazy-init-deep [--create-new] [--max-depth=N]
```

## Inputs

- Current workspace directory tree
- Project manifests (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, etc.)
- Existing `zcode.md` if present (update mode)
- CI/CD configuration, test directories, existing docs

## Outputs

- `zcode.md` at root (50-150 lines, quality-gate passing)
- Subdirectory `zcode.md` variants where complexity score warrants
- `.lazyzcode/context/index.md` — structured project overview
- `.lazyzcode/context/commands.json` — discovered dev/test/build/lint commands
- `.lazyzcode/context/project-map.json` — directory-to-purpose mapping
- Plugin load-check result. Resolve it safely before discovery:
  ```bash
  PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
  if [ -z "$PLUGIN_ROOT" ] && [ -f "$PWD/plugins/lazyzcode/scripts/lazyzcode-load-check.sh" ]; then
    PLUGIN_ROOT="$PWD/plugins/lazyzcode"
  elif [ -z "$PLUGIN_ROOT" ] && [ -f "$PWD/scripts/lazyzcode-load-check.sh" ]; then
    PLUGIN_ROOT="$PWD"
  fi
  [ -n "$PLUGIN_ROOT" ] || { echo "LazyZCode plugin root is unavailable; reopen the copied repository or install the plugin." >&2; exit 1; }
  bash "$PLUGIN_ROOT/scripts/lazyzcode-load-check.sh"
  ```
- From an unrelated workspace that uses a separately checked-out sibling plugin, provide its **absolute** path explicitly:
  ```bash
  CLAUDE_PLUGIN_ROOT="/absolute/path/to/plugins/lazyzcode" \
    bash "/absolute/path/to/plugins/lazyzcode/scripts/lazyzcode-load-check.sh"
  ```
  A successful check reports `PACKAGE_READINESS=full`. With no override, the resolver tries only the documented copied-repository and plugin-root layouts above; it does not search parents, siblings, marketplaces, or the filesystem. An unrelated workspace therefore reports that the plugin root is unavailable.
- InitDeep readiness evidence. Run the load check first, then verify its reported skills, commands, agents, hooks, and MCP declarations. This is package readiness only and does not prove a live host session or MCP connection. Do not enable optional capabilities, select providers, initialize optional architecture tooling, or export MCP configuration without a separate explicit user request. Record these exact fields in the completion report:
  ```text
  readiness_result: {load-check result}
  readiness_host: {package readiness boundary}
  capability_statuses: {observed read-only status summary}
  optional_policy: {unchanged unless separately explicitly requested}
  receipt_state: {observed receipt/ownership state or not inspected}
  evidence_paths: {load-check output and inspected package paths}
  ```
- Consumer compatibility pointer. After generating or updating `zcode.md`, explicitly run:
  ```bash
  CWD="$PWD" CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" \
    bash "$PLUGIN_ROOT/scripts/ensure-consumer-agents.sh"
  ```
  Record whether the helper reports `AGENTS_STATUS=created` or `AGENTS_STATUS=preserved`. It never merges or overwrites an existing `AGENTS.md`.

## Success Criteria

1. Root `zcode.md` exists and is 50-150 lines
2. No generic filler content
3. Hierarchy is correct (child does not repeat parent)
4. `.lazyzcode/context/` files exist and are parseable
5. Plugin load check passes before discovery and is included in the completion report. With no `CLAUDE_PLUGIN_ROOT`, only the copied repository root or plugin root layouts are tried; an unrelated workspace fails clearly.
6. The post-`zcode.md` consumer helper reports `AGENTS_STATUS=created` or `AGENTS_STATUS=preserved`.

## Constitution

This command is governed by its package-local skill contract below.

Do not claim completion without verification.

## Skill

See `../skills/lazy-init-deep/SKILL.md` for the full workflow logic, phase-by-phase procedure, scoring matrix, and verification gates.
