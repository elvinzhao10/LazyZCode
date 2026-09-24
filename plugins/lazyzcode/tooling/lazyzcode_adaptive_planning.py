"""LazyZCode v1.3.0 progressive milestones and scoped decision gates (T3).

Implements the v1.3.0 shared semantics for parent plans with progressive
milestones and scoped, owner-owned decision gates:

* ``milestone_flags``: ``provisional`` (a provisional milestone and its tasks
  MUST NOT dispatch), ``parent_plan_id`` (authoritative parent), and
  ``dependency_links`` (task/milestone dependencies; cycles and dangling links
  are rejected).
* Decision gates use the canonical shape
  (``question`` / ``recommendation`` / ``alternatives`` / ``owner`` /
  ``needed_by`` / ``status`` + ``assumptions``). A recommendation never becomes
  owner approval automatically; only tasks that transitively depend on an open
  gate are blocked.
* The next milestone is executable; later milestones may remain provisional.
"""
from __future__ import annotations

from typing import Final

DECISION_GATE_REQUIRED: Final = (
    "question",
    "recommendation",
    "alternatives",
    "owner",
    "needed_by",
    "status",
)
VALID_GATE_STATUS: Final = ("open", "answered", "blocked", "superseded")
GATE_BLOCKING_STATUS: Final = ("open", "blocked")


def validate_decision_gate(gate: object) -> list[str]:
    """Return a list of errors for a decision gate; empty means valid."""
    errors: list[str] = []
    if not isinstance(gate, dict):
        return ["decision_gate: not an object"]
    missing: set[str] = set()
    for field in DECISION_GATE_REQUIRED:
        if field not in gate or gate[field] in (None, ""):
            missing.add(field)
            errors.append(f"decision_gate: missing required field '{field}'")
    status = gate.get("status")
    if "status" not in missing and status not in VALID_GATE_STATUS:
        errors.append(f"decision_gate: invalid status '{status}'")
    alternatives = gate.get("alternatives")
    if "alternatives" not in missing:
        if not isinstance(alternatives, list) or not alternatives:
            errors.append("decision_gate: 'alternatives' must be a non-empty array")
        elif not any(
            isinstance(alt, dict) and alt.get("id") for alt in alternatives
        ):
            errors.append("decision_gate: each alternative requires an 'id'")
    assumptions = gate.get("assumptions")
    if assumptions is not None and not isinstance(assumptions, list):
        errors.append("decision_gate: 'assumptions' must be an array when present")
    return errors


def decision_gate_blocks(gate: object) -> bool:
    """A gate blocks its transitive dependents until a real answer exists.

    No auto-approval: a ``recommendation`` never flips status to ``answered``;
    only ``answered`` (or ``superseded``) releases the block.
    """
    if not isinstance(gate, dict):
        return True
    return gate.get("status") in GATE_BLOCKING_STATUS


def _collect_ids(plan: dict) -> set[str]:
    ids: set[str] = set()
    for milestone in plan.get("milestones", []) or []:
        if isinstance(milestone, dict) and isinstance(milestone.get("id"), str):
            ids.add(milestone["id"])
        for task in milestone.get("tasks", []) or []:
            if isinstance(task, dict) and isinstance(task.get("id"), str):
                ids.add(task["id"])
    return ids


def _milestone_links(milestone: dict) -> list[str]:
    """Task/milestone dependency edges used for cycle + dangling-link checks.

    ``dependency_links`` are the authoritative intra-plan edges. ``parent_plan_id``
    and ``child_plan_ids`` are plan-level references (authoritative parent /
    cross-plan children) and are validated for shape, not resolved against the
    milestone id set.
    """
    links: list[str] = []
    flags = milestone.get("milestone_flags") or {}
    for link in flags.get("dependency_links", []) or []:
        if isinstance(link, str) and link:
            links.append(link)
    return links


def detect_dependency_cycle(plan: dict) -> list[str] | None:
    """Return a cycle path (list of ids) if the dependency graph has one."""
    graph: dict[str, list[str]] = {}
    ids = _collect_ids(plan)
    for milestone in plan.get("milestones", []) or []:
        if not isinstance(milestone, dict):
            continue
        mid = milestone.get("id")
        if not isinstance(mid, str):
            continue
        graph.setdefault(mid, [])
        for link in _milestone_links(milestone):
            if link in ids:
                graph[mid].append(link)
    # Only consider nodes that exist; dangling links handled separately.
    visiting: set[str] = set()
    done: set[str] = set()
    path: list[str] = []

    def visit(node: str) -> list[str] | None:
        if node in done:
            return None
        if node in visiting:
            idx = path.index(node)
            return path[idx:] + [node]
        visiting.add(node)
        path.append(node)
        for nxt in graph.get(node, []):
            cycle = visit(nxt)
            if cycle is not None:
                return cycle
        path.pop()
        visiting.discard(node)
        done.add(node)
        return None

    for start in list(graph):
        cycle = visit(start)
        if cycle is not None:
            return cycle
    return None


def validate_plan_graph(plan: dict) -> list[str]:
    """Validate a parent plan record.

    Rejects: cycles, missing referenced IDs, dangling child/parent links,
    milestones without stable IDs, and malformed gates.
    """
    errors: list[str] = []
    if not isinstance(plan, dict):
        return ["plan: not an object"]
    for field in ("outcome", "constraints", "assumptions", "decisions", "gates", "acceptance"):
        if field not in plan:
            errors.append(f"plan: missing parent-plan field '{field}'")
    milestones = plan.get("milestones")
    if not isinstance(milestones, list) or not milestones:
        errors.append("plan: 'milestones' must be a non-empty array")
        return errors
    ids = _collect_ids(plan)
    for milestone in milestones:
        if not isinstance(milestone, dict):
            errors.append("plan: milestone is not an object")
            continue
        mid = milestone.get("id")
        if not isinstance(mid, str) or not mid:
            errors.append("plan: milestone missing stable 'id'")
            continue
        flags = milestone.get("milestone_flags")
        if flags is not None and not isinstance(flags, dict):
            errors.append(f"plan: milestone '{mid}' milestone_flags not an object")
        if isinstance(flags, dict) and "parent_plan_id" in flags:
            pid = flags["parent_plan_id"]
            if not isinstance(pid, str) or not pid:
                errors.append(f"plan: milestone '{mid}' parent_plan_id must be a non-empty string")
        for link in _milestone_links(milestone):
            if link not in ids:
                errors.append(
                    f"plan: milestone '{mid}' references missing id '{link}'"
                )
        for task in milestone.get("tasks", []) or []:
            if isinstance(task, dict) and isinstance(task.get("id"), str):
                for dep in task.get("depends_on", []) or []:
                    if dep not in ids:
                        errors.append(
                            f"plan: task '{task['id']}' depends on missing id '{dep}'"
                        )
    cycle = detect_dependency_cycle(plan)
    if cycle is not None:
        errors.append("plan: dependency cycle detected: " + " -> ".join(cycle))
    for gate in plan.get("gates", []) or []:
        errors.extend(validate_decision_gate(gate))
    return errors


def is_milestone_dispatchable(
    milestone: dict,
    resolved_gate_ids: set[str] | None = None,
) -> bool:
    """A milestone is dispatchable only when it is not provisional and any gate
    that targets it (or its tasks) is resolved."""
    if not isinstance(milestone, dict):
        return False
    flags = milestone.get("milestone_flags") or {}
    if flags.get("provisional") is True:
        return False
    if isinstance(milestone.get("id"), str):
        gate_target = milestone["id"]
        gates = milestone.get("gates") or []
        for gate in gates:
            if isinstance(gate, dict) and decision_gate_blocks(gate):
                affected = gate.get("affected_tasks") or []
                if not affected or gate_target in affected or gate.get("needed_by") == gate_target:
                    return False
    return True


def next_dispatchable_milestone(plan: dict) -> dict | None:
    """The next executable milestone (first non-provisional, gate-clear one)."""
    if not isinstance(plan, dict):
        return None
    for milestone in plan.get("milestones", []) or []:
        if is_milestone_dispatchable(milestone):
            return milestone
    return None
