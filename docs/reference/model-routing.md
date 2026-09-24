# Model routing

LazyZCode describes task intent. ZCode chooses and bills the model. A package
alias or recommendation is not proof of a concrete backing model, account
availability, host loading, or a particular price.

The package's declared agents omit `model` and inherit the current session
model; each role pins a `thoughtLevel` for reasoning effort. Before dispatch,
propose delegation and any model switches in the plan, remind the user that
switching can change quality, latency, and cost, and record the decision. If
the plan is silent, keep the same model across all subagents and retries.
These are the plan options when switching is enabled:

| Task class | Optional plan choice | Use |
| --- | --- | --- |
| Mechanical work | `efficient` with low effort | Repository indexing, bounded search, and routine memory maintenance. |
| Default work | `inherit` | All roles keep the current parent-session model unless the plan explicitly enables a switch. |
| Quality-focused work | `performance` with high or xhigh effort | Planning, review, security review, final gates, and verification. |

`performance` is a provisional tier choice for those roles. It does not claim a
specific model or a quality guarantee. On ZCode the routing surface is the
per-agent `model` / `thoughtLevel` frontmatter in `agents/lazyzcode-*.md`,
applied by the Agent dispatcher. The tier names above are plan-level intents,
not host model IDs: package metadata alone does not prove the host applied
them, and they remain advisory until the current session visibly shows the
selection.

## Produce a recommendation

The shared helper is a read-only recommendation surface. It does not query a
host, select a model, write settings, or contact a provider. Run it from
`plugins/lazyzcode/`:

```bash
node contracts/model-routing.js --host zcode --task mechanical --list
node contracts/model-routing.js --host zcode --task architecture --risk high
node contracts/model-routing.js --host zcode --task review --failed-attempts 1
node contracts/model-routing.js --host zcode --task mechanical --allow-switch
```

The `--host` value is the ZCode entry declared in
`contracts/model-routing-policy.v1.json` — `--host zcode` (economy →
`efficient`, balanced → `auto`, strong → `performance`; dispatch kind
`agent-frontmatter`). That contract is authoritative for the exact host key
and profile mapping. Supported task classes are
`mechanical`, `implementation`, `architecture`, `review`, `security`, and
`visual`. Without `--allow-switch`, `chosenModel` is null and dispatch is
`inherit`. With switching enabled, the helper may return a documented host
alias (for example `performance`) or a qualified catalog `chosenModel` with an
`agent-frontmatter` dispatch value, but it never edits agent files or host
settings: applying the verdict is a plan/human action through the
`agents/lazyzcode-*.md` frontmatter. A recommendation remains **unobserved**
until the current host visibly offers and accepts a selection. The
orchestrator consults it once before a task's first dispatch, records the
result in the handoff, and reuses it for retries. Re-evaluate only when the
plan's switching decision, task class, risk, failed attempts, or explicit user
choice changes.

`--failed-attempts` means completed task-acceptance failures. It does not count
an expected test-first red state, a missing host catalog, or an unavailable
host. An explicit user model choice takes precedence when it meets the required
tier, declared availability, and required capabilities. The helper refuses an
underqualified choice; it does not silently substitute another model. `inherit`
roles deliberately retain the accepted session choice; do not invent a model
argument for an Agent call.

## Discover the current selection

ZCode has no package-visible catalog command. The model shown in the current
ZCode session (and any per-agent `model`/`thoughtLevel` value the dispatcher
reports) is the authoritative selection surface. LazyZCode never writes host
settings, `settings.json` overrides, or provider configuration: agent routing
ships only as frontmatter inside `agents/lazyzcode-*.md`, and the package makes
no claim about which concrete model the host resolves behind it.

## Custom models

Use a custom model only after the user has configured and validated it through
ZCode's supported UI. A validated custom model can then remain the parent
session selection for `inherit` roles.

After the plan enables switching, a documented host alias can be passed as
`--model` with `--allow-switch` and no catalog. An explicit direct or custom ID
requires safe-catalog input. The file is non-secret availability input and does
not query the host:

```json
{
  "schema_version": 1,
  "host": "zcode",
  "models": [
    {
      "id": "custom:example/review-model-v1",
      "origin": "custom",
      "tier": "strong",
      "available": true,
      "capabilities": ["tools", "code"],
      "costRank": 2
    }
  ]
}
```

Use it only with the exact current visible ID:

```bash
node contracts/model-routing.js --host zcode --task review \
  --allow-switch --catalog safe.json --model "custom:example/review-model-v1"
```

`costRank` is a declared relative rank, never a price, multiplier, or provider
bill. Supplying an entry does not register it with the host or prove it is
visible in the current task/session. If no current visible catalog entry is
supplied, the user-selected session model remains authoritative.

The shared catalog schema also permits an optional `subagentSupported` boolean.
It is accepted as caller-declared metadata for every host, but the current
routing policy uses it only for Trae. It does not make a custom model visible
to an Agent call. Custom-provider costs are billed by the provider and cannot
be compared safely with host-side multipliers.

## Related boundaries

- The MCP profile gate (`LAZYZCODE_MCP_MODE`) governs which of the six declared
  local MCP servers activate; it does not participate in model selection.
- The outcome-evaluation protocol
  (`plugins/lazyzcode/contracts/OUTCOME-EVALUATION.md`) defines cost
  attribution and the `measurement_scope` discipline: `fixture-validation`
  records are never execution evidence, and scope metadata is a caller
  declaration, not billing proof (see
  [evidence and completion](../05-evidence-and-completion.md)).

## Native testing boundary

Run package tests for frontmatter and helper behavior locally. Listing a real
account catalog, selecting a tier/direct/custom model, and observing a
per-agent override are host and user-owned checks. The repository has no ZCode
account catalog evidence, so it makes no availability claim.
