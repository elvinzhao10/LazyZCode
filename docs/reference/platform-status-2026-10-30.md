# LazyZCode platform audit — 2026-10-30

Current published documentation baseline remains v1.4.0; local 1.4.1 changes are unreleased.

## Official documentation checked

The official [changelog](https://zcode.z.ai/en/changelog) still lists **3.16.3 on October 23**. No newer listed release was verified during this audit.

The current [hooks guide](https://zcode.z.ai/en/docs/hooks) documents plugin auto-discovery, ignores project hook configuration, applies user hooks before plugin hooks, and requires a new session after changes. Stop continuation is limited to three rounds. Both direct-process and compatibility-shell execution are documented. The package's marketplace route and these restrictions stay in force; local files, a load-check and hook declarations do not prove discovery or live delivery.

Verification requires **Python 3.11 or newer** because the runner uses standard-library StrEnum and assert_never. Python 3.10 is rejected before importing runner modules.

## Package capability and proof boundary

This audit covers lifecycle/onboarding/update/offboard/recovery; project init/sync/ownership; Skills, commands, agents and hooks; MCP and optional tooling; adaptive workflow/model selection; plans, loops and delegation; evidence, completion and security gates; dashboard/project records and editing; versioned verification, regression provenance, review admission, checkpoint history and compaction. Package checks and isolated native fixtures are distinct from current-session host acceptance.

The local development changes retain direct handling for simple tasks. Existing named workflows and approval/verification requirements remain authoritative. No blanket speed, token or cost saving is claimed from workflow selection. The five Python-backed adapters omit review-content scanning only on internal producer paths with no existing review; public reads and all reviewed subjects retain fresh capture. No HEAD-only cache is introduced.

**HOST READINESS: PENDING** wherever no fresh host/build/session receipt is observed. No host installation, trust/account change, provider call, credential change or publication was performed by this audit. The coordination report records exact test outcomes and unresolved contradictions. The previous dated audit remains historical context.
