---
description: "Plan cross-platform migration workflows. Analyze source platform components, map them to target platform equivalents, and produce a migration plan with risk assessment."
argument-hint: "[--source=<platform>] [--target=<platform>]"
skills: lazy-migration-planner
---

Use the `lazy-migration-planner` skill for this request.

$ARGUMENTS

# /lazy-migration-planner

Cross-platform migration workflow planner. Analyzes source platform components, maps them to target platform equivalents, identifies gaps and risks, and produces a structured migration plan. Generalizes the adaptation methodology used in this project.

## ZCode mapping

LazyZCode's migration methodology targets the **ZCode Agent tool** (parallel subagent dispatch) and the plugin's **auto-connected MCP servers** for the actual porting work; the `lazy-migration-planner` produces the component-by-component mapping and risk assessment that drives that work.

## Usage

```
/lazy-migration-planner --source=<platform> --target=<platform> [--components=skills,hooks,agents,mcp]
```

## Inputs

- Source platform documentation and component definitions
- Target platform capabilities and constraints
- Component inventory (skills, commands, agents, hooks, MCP servers)
- Known platform differences (tool mapping, API surface, capability model)

## Outputs

- Migration plan with component-by-component mapping
- Risk assessment per component (HIGH/MEDIUM/LOW)
- Semantic deviation log (where 1:1 mapping is impossible)
- Effort estimate and phased delivery schedule

## Success Criteria

1. Every source component has a mapped target equivalent or documented skip reason
2. Risk assessment is honest (no LOW risk where semantics differ)
3. Semantic deviations are documented with mitigation strategies
4. Plan is self-contained (no external knowledge assumed)

## Constitution

This command is governed by its package-local skill contract below.

Do not claim completion without verification.

## Skill

See `../skills/lazy-migration-planner/SKILL.md` for the full migration methodology, platform analysis framework, risk matrix, and adaptation patterns.
