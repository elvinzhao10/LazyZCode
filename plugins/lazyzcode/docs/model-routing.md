# Model routing

LazyZCode describes task intent. ZCode chooses and bills the model. A package
alias or recommendation is not proof of a concrete backing model, account
availability, host loading, or a particular rate.

The package's declared agents omit `model` and inherit the current model;
each agent instead pins a `thoughtLevel` budget. Before dispatch, propose
delegation and any model switches in the plan, remind the user that switching
can change quality, latency, and cost, and record the decision. If the plan is
silent, keep the same model across all subagents and retries. Plans can use
these task-class options when switching is enabled:

| Task class | Optional plan choice | Use |
| --- | --- | --- |
| Mechanical work | `efficient` with low thoughtLevel | Repository indexing, bounded search, and routine memory maintenance. |
| Default work | `inherit` | All roles keep the current parent-session model unless the plan explicitly enables a switch. |
| Quality-focused work | `performance` with high or max thoughtLevel | Planning, review, security review, final gates, and verification. |

`performance` is a provisional tier choice for those roles. It does not claim
a specific model or a quality guarantee. ZCode exposes model selection and
per-agent `model`/`thoughtLevel` frontmatter through its own UI and agent
definitions; package metadata alone does not prove the host applied a tier.
The routing policy declares the `zcode` host profiles (economy → `efficient`,
balanced → `auto`, strong → `performance`) as documented-host-alias bindings;
they are advisory until the current session visibly honors them.

## Produce a recommendation

The shared helper is a read-only recommendation surface. It does not query a
host, select a model, write settings, or contact a provider:

```bash
node contracts/model-routing.js --host zcode --task mechanical --list
node contracts/model-routing.js --host zcode --task architecture --risk high
node contracts/model-routing.js --host zcode --task review --failed-attempts 1
node contracts/model-routing.js --host zcode --task mechanical --allow-switch
```

Supported task classes are `mechanical`, `implementation`, `architecture`,
`review`, `security`, and `visual`. Always pass `--host zcode`; the policy
also carries the other LazySeries family host ids for cross-repo parity, but
LazyZCode's own surface is `zcode`. Without a catalog, the recommendation is a
tier with `chosenModel: null`. With a caller catalog it may recommend a
qualified `chosenModel`, but it never binds an alias or catalog model behind
the user's back: a recommendation remains **unobserved** until the current
host visibly offers and accepts a selection. The orchestrator consults it
once before a task's first dispatch, records the result in the handoff, and
reuses it for retries. Without `--allow-switch`, `chosenModel` is null and
dispatch is `inherit`. Re-evaluate only when the plan's switching decision,
task class, risk, failed attempts, or explicit user choice changes.

`--failed-attempts` means completed task-acceptance failures. It does not
count an expected test-first red state, a missing host catalog, or an
unavailable host. An explicit user model choice takes precedence when it
meets the required tier, declared availability, and required capabilities.
The helper refuses an underqualified choice; it does not silently substitute
another model. `inherit` roles deliberately retain the accepted session
choice; do not invent a model argument for an Agent call.

## Discover the current selection

ZCode surfaces the current model and per-agent model/`thoughtLevel` choices
in its own UI (agent definitions and the composer model picker). Snapshots
published by the host document client version, account availability, service
updates, parameters, and displayed rates, and can differ from the current
session. Check the host before acting on a recommendation.

Per-agent overrides are user-owned: set `model` or `thoughtLevel` in the
agent definition or the host's agent settings. LazyZCode never writes host
settings, and the shipped agents intentionally omit `model` so they inherit
the current selection.

## Custom models

Use a custom model only after the user has configured and validated it
through ZCode's supported UI. A validated custom model can then remain the
parent-session selection for `inherit` roles.

After the plan enables switching, a documented host alias can be passed as
`--model` with `--allow-switch` and no catalog. An explicit direct or custom
ID requires safe-catalog input. The file is non-secret availability input and
does not query ZCode:

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

`costRank` is a declared relative rank, never a price or provider bill.
Supplying an entry does not register it with ZCode or prove it is visible in
the current task/session. If no current visible catalog entry is supplied,
the user-selected session model remains authoritative. The shared catalog
schema also permits an optional `subagentSupported` boolean; it is accepted
as caller-declared metadata for every host, but the current routing policy
uses it only for Trae.

Custom-provider costs are billed by the provider and cannot be compared
safely with host-billed rates.

## Native testing boundary

Run package tests for frontmatter and helper behavior locally. Listing a real
account catalog, selecting a tier/direct/custom model, and observing a
per-agent override are host and user-owned checks. A given checkout may have
no ZCode account catalog evidence, so it makes no availability claim.
