---
description: "Guide LazyZCode onboarding: verify the package, install through ZCode's plugin marketplace UI, and keep host readiness explicitly PENDING until a fresh session proves it."
argument-hint: "[--project <absolute-project-root>]"
---

Work through this guided onboarding in order. Stop at the first step that
cannot be completed and report honestly what is missing. Never simulate a host
result and never edit host-owned configuration.

$ARGUMENTS

# /lazy-onboard

## Usage

```
/lazy-onboard [--project <absolute-project-root>]
```

Triggers: `onboard`, `install LazyZCode`, `set up the plugin`, `verify the install`.

## Guided procedure

1. **Detect the current install state (read-only).** If
   `~/.zcode/cli/config.json` is readable, read its `plugins` key read-only to
   see whether a `lazyzcode` plugin entry already exists and is enabled.
   Treat an unreadable or missing file as "not detectable" and say so. This is
   a look, never a write: NEVER create, edit, or repair host configuration —
   all install, enable, and update actions happen through the ZCode UI.
2. **Verify the package from the repo checkout.** Run, from the repository
   root:
   - `bash plugins/lazyzcode/scripts/lazyzcode-load-check.sh` — must end with
     `PACKAGE_READINESS=full`.
   - `bash plugins/lazyzcode/scripts/lazyzcode-plugin-doctor.sh` — the package
     doctor (host=package) must pass.
   - `bash scripts/install.sh` — the native onboarding script re-runs the
     prerequisite, marketplace-layout, load-check, and doctor checks, then
     prints the exact UI steps with the absolute market root path (on macOS it
     also copies that path to the clipboard).
   If any check fails, fix the named package file first; do not continue.
3. **Install through ZCode's own UI (primary route).** There is no
   `zcode plugin marketplace add` CLI on end-user machines. Give the user the
   exact steps with the ABSOLUTE market root (`<repo>/plugins` — the folder
   containing `marketplace.json`, not the nested `plugins/lazyzcode/` plugin
   directory):
   1. Open **ZCode → Settings → Plugin Management** → **Discover** tab.
   2. Click **“+” / Add Plugin Marketplace** and paste the market root
      directory.
   3. Open the **Personal** tab, find the `lazyzcode` plugin card, and click
      **Install**. Installed plugins are enabled by default.
   Development machines with a `zcode` binary on `PATH` may additionally run
   `zcode plugins validate plugins/lazyzcode`; that is an optional,
   development-only package check, not an install and not host proof.
4. **Optional durable route (only when the user passed
   `--project <absolute-project-root>`).** Run the durable lifecycle onboard:

   ```bash
   node plugins/lazyzcode/scripts/lazyzcode-lifecycle.js onboard \
     --source https://github.com/elvinzhao10/LazyZCode.git \
     --project <absolute-project-root> \
     [--install-root <absolute-path>]
   ```

   The default install root is the lifecycle's own resolution
   (`~/Library/Application Support/LazySeries` on macOS). This step fetches
   from the official origin. On failure, print the lifecycle's error verbatim,
   keep package readiness as the only readiness claim, and do not retry by
   editing receipts or state.
5. **Verify host readiness in a fresh session.** Host activation can only be
   observed in a NEW ZCode session. Ask the user to start one and confirm
   each item of the fresh-session checklist:
   - One real skill loads via the Skill tool (for example `lazy-ulw-plan`).
   - One command appears as a slash menu entry (for example `/lazy-status`).
   - All six MCP connections are visible: `run-ledger`, `verification`,
     `status-dashboard`, `context-graph`, `code-intel`, `docs`.
   - Hooks are active (the plugin's hook events fire when the plugin is
     enabled).
   - The `mcp_mode` plugin user setting is visible (empty defers the profile
     gate, which defaults to `orchestrated`).
6. **Report readiness honestly.** Print exactly:
   - `PACKAGE READINESS: full` — only if step 2 passed.
   - `HOST READINESS: PENDING` — until a fresh session has observed one real
     skill or command plus all six MCP connections. Package checks, doctor
     output, and install receipts never prove host activation.

## Success criteria

- Package checks ran and the load-check reported `PACKAGE_READINESS=full`.
- The user received the exact UI steps with the absolute market root.
- The durable onboard (if requested) either completed with its receipt or its
  honest error was reported verbatim.
- The fresh-session checklist was handed to the user, and the final report
  ends with `HOST READINESS: PENDING` until that observation exists.

Do not claim completion without verification.

## Package entry points

- `scripts/install.sh` — repo-root native onboarding script (prerequisites,
  marketplace layout, load-check, doctor, UI handoff, optional lifecycle
  onboard with `--project`).
- `plugins/lazyzcode/scripts/lazyzcode-load-check.sh` — package-readiness gate
  (`PACKAGE_READINESS=full`).
- `plugins/lazyzcode/scripts/lazyzcode-plugin-doctor.sh` — package doctor
  (host=package).
- `plugins/lazyzcode/scripts/lazyzcode-lifecycle.js` — durable lifecycle CLI
  (`onboard|update|status|offboard|recover-bootstrap-lock`).
- `plugins/lazyzcode/scripts/lazyzcode-zcode-preparation-check.sh` — read-only
  host preflight; `--apply` refuses and nothing is mutated.
