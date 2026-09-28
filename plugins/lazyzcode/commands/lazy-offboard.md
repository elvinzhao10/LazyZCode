---
description: "Guide receipt-safe LazyZCode removal through four independently approved scopes, preserving other plugins, host configuration, and credentials."
argument-hint: "[--project <absolute-project-root>] [--tooling-root <absolute-path>]"
---

Work through this guided removal in order. Each scope is an independent
removal decision: confirm every scope with the user before touching it, and
skip any scope the user does not approve. Never guess or scan for host-managed
installation paths.

$ARGUMENTS

# /lazy-offboard

## Usage

```
/lazy-offboard [--project <absolute-project-root>] [--tooling-root <absolute-path>]
```

Triggers: `offboard`, `uninstall LazyZCode`, `remove the plugin`, `clean up`.

## Guided procedure

1. **Inventory what exists (read-only).** Check which scopes apply: the ZCode
   plugin install (inspect **Settings → Plugins** in the host),
   a receipt-owned tooling root (only a user-supplied absolute path), the
   project-local `.lazyzcode/` state directory, and a durable lifecycle
   install (`node "<install-root>/LazyZCode/launcher.js" status`). Report the
   list before removing anything.
2. **Scope 1 — ZCode plugin install (host UI, receipt-safe).** LazyZCode keeps
   no host-side state, so removal through the host is safe:
   - Reversible pause: flip the plugin's enable/disable toggle in
     **Settings → Plugins**.
   - Full removal: **Installed** tab → `lazyzcode` → **Uninstall**, then
     confirm in the host UI.
   An agent with approved computer-use access may guide or perform these UI
   actions and must observe the host result. Never edit the host's private
   plugin registry or cache directly.
3. **Scope 2 — receipt-owned tooling root (optional, only with an explicit
   root).** If the user passes `--tooling-root <absolute-path>` (or names one),
   run:

   ```bash
   bash plugins/lazyzcode/scripts/lazyzcode-tooling.sh uninstall \
     --tooling-root <absolute-path>
   ```

   The command removes only an unmodified, receipt-owned installation and
   preserves modified, linked, foreign, caller-owned, project, global, and
   host-managed paths. If the tooling root owns a project index, the
   receipt-gated index uninstall must remove that index first; the root
   uninstall refuses until it is gone.
4. **Scope 3 — project-local `.lazyzcode/` state (explicit user choice per
   project).** Run state, evidence, handoffs, and the decision ledger live in
   `<project>/.lazyzcode/`. After the plugin is uninstalled, a user may delete
   `.lazyzcode/` from individual projects to drop their run history. Ask per
   project; never delete it silently, and never delete it while a removal of
   another scope is still pending confirmation.
5. **Scope 4 — durable lifecycle install (only for the launcher route).** For
   a durable onboard, remove exact receipt-owned state with the plan-first
   offboard:

   ```bash
   node "<install-root>/LazyZCode/launcher.js" offboard
   ```

   The first run prints a confirmation plan; rerun with `--yes` after the user
   approves it. The bootstrap checkout may be deleted independently; it is not
   itself a host installer.
6. **Confirm the result.** After the host UI action, observe in a fresh session
   that the plugin's skills, commands, and MCP entries are gone (or disabled,
   for a pause). If that observation is unavailable, report host removal as
   pending. The copied repository may be deleted after the durable route is
   verified or removed independently; it is not the installed bundle.

## Do not touch

- Other plugins, their marketplaces, and their enable states.
- Host configuration files (`~/.zcode/cli/config.json`, workspace
  `.zcode/config.json`) and `AGENTS.md` content you did not generate.
- Another host's MCP configuration, credentials, OAuth values, private
  registry settings, or trust settings.
- Project files, global tools, and any path not proven by a receipt.

Removing a tooling root does not authorize removal of a plugin, marketplace
installation, MCP registration, or credential state.

## Success criteria

- Every applied scope was independently approved by the user, in the order
  above.
- The host removal (if requested) was performed through the host UI and
  confirmed in that host.
- Receipt-gated uninstalls either completed with their receipt check or
  refused and preserved the root.
- The final report separates package removal from the observed host result.

Do not claim completion without verification.

## Package entry points

- `plugins/lazyzcode/scripts/lazyzcode-tooling.sh` — receipt-gated tooling
  uninstall (`uninstall --tooling-root <absolute-path>`; see also the LSP and
  project-index uninstall subcommands).
- `plugins/lazyzcode/scripts/lazyzcode-lifecycle.js` — durable lifecycle CLI
  (`status` and plan-first `offboard`; `--yes` after user approval).
- `<install-root>/LazyZCode/launcher.js` — stable durable launcher for
  `update`, `status`, and plan-first `offboard`.
- `docs/08-safe-removal.md` — the receipt-scoped removal protocol this command
  follows.
