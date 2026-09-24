from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tooling"))

from lazyzcode_adaptive_planning import (
    decision_gate_blocks,
    detect_dependency_cycle,
    is_milestone_dispatchable,
    next_dispatchable_milestone,
    validate_decision_gate,
    validate_plan_graph,
)


# --- Canonical decision gate shape (T3) -------------------------------------

VALID_GATE = {
    "question": "Which billing provider should the billing milestone integrate?",
    "recommendation": "Provider X (existing contract, lowest integration cost).",
    "alternatives": [
        {"id": "provider-x", "summary": "Existing contract provider", "tradeoffs": "Lower cost."},
        {"id": "provider-y", "summary": "New provider", "tradeoffs": "More features."},
    ],
    "owner": "product-owner",
    "needed_by": "milestone-billing",
    "status": "open",
    "assumptions": ["Billing is the only consequential decision surfaced now."],
}


@pytest.mark.parametrize(
    "gate,expected_errors",
    [
        (VALID_GATE, []),
        ({}, ["decision_gate: missing required field 'question'",
              "decision_gate: missing required field 'recommendation'",
              "decision_gate: missing required field 'alternatives'",
              "decision_gate: missing required field 'owner'",
              "decision_gate: missing required field 'needed_by'",
              "decision_gate: missing required field 'status'"]),
        ({"question": "q", "recommendation": "r", "alternatives": [],
          "owner": "o", "needed_by": "m", "status": "open"}, ["decision_gate: 'alternatives' must be a non-empty array"]),
        ({"question": "q", "recommendation": "r", "alternatives": [{"summary": "x"}],
          "owner": "o", "needed_by": "m", "status": "open"},
         ["decision_gate: each alternative requires an 'id'"]),
        (dict(VALID_GATE, status="approved"), ["decision_gate: invalid status 'approved'"]),
    ],
)
def test_validate_decision_gate(gate: dict, expected_errors: list[str]) -> None:
    assert validate_decision_gate(gate) == expected_errors


def test_gate_no_auto_approval() -> None:
    # A recommendation never auto-answers; only answered/superseded releases.
    assert decision_gate_blocks(dict(VALID_GATE, status="open")) is True
    assert decision_gate_blocks(dict(VALID_GATE, status="blocked")) is True
    assert decision_gate_blocks(dict(VALID_GATE, status="answered")) is False
    assert decision_gate_blocks(dict(VALID_GATE, status="superseded")) is False


# --- Plan graph validation (T3) --------------------------------------------

BASE_PLAN = lambda: {
    "outcome": "Team expense tracker.",
    "constraints": ["No new procurement without owner sign-off."],
    "assumptions": ["Billing is the only consequential decision now."],
    "decisions": [],
    "gates": [dict(VALID_GATE)],
    "acceptance": ["All milestones accepted."],
    "milestones": [
        {
            "id": "milestone-discovery",
            "milestone_flags": {"provisional": False, "parent_plan_id": "plan-1", "dependency_links": []},
            "tasks": [{"id": "T1", "depends_on": []}],
            "gates": [],
        },
        {
            "id": "milestone-billing",
            "milestone_flags": {"provisional": True, "parent_plan_id": "plan-1", "dependency_links": ["milestone-discovery"]},
            "tasks": [{"id": "billing-integration", "depends_on": ["T1"]}],
            "gates": [dict(VALID_GATE)],
        },
    ],
}


def test_valid_plan_graph_passes() -> None:
    assert validate_plan_graph(BASE_PLAN()) == []


def test_cycle_rejected() -> None:
    plan = BASE_PLAN()
    plan["milestones"][0]["milestone_flags"]["dependency_links"] = ["milestone-billing"]
    errors = validate_plan_graph(plan)
    assert any("cycle" in e for e in errors)
    assert detect_dependency_cycle(plan) is not None


def test_missing_id_rejected() -> None:
    plan = BASE_PLAN()
    plan["milestones"][1]["milestone_flags"]["dependency_links"] = ["does-not-exist"]
    errors = validate_plan_graph(plan)
    assert any("does-not-exist" in e for e in errors)


def test_dangling_child_link_rejected() -> None:
    # A dependency link (child link) that resolves to no known milestone/task id
    # is dangling and must be rejected.
    plan = BASE_PLAN()
    plan["milestones"][1]["milestone_flags"]["dependency_links"] = ["does-not-exist"]
    errors = validate_plan_graph(plan)
    assert any("does-not-exist" in e for e in errors)


def test_missing_parent_plan_field_rejected() -> None:
    plan = BASE_PLAN()
    del plan["acceptance"]
    errors = validate_plan_graph(plan)
    assert any("acceptance" in e for e in errors)


def test_milestone_missing_stable_id_rejected() -> None:
    plan = BASE_PLAN()
    del plan["milestones"][0]["id"]
    errors = validate_plan_graph(plan)
    assert any("stable 'id'" in e for e in errors)


# --- Progressive dispatch (T3) ---------------------------------------------

def test_provisional_milestone_must_not_dispatch() -> None:
    plan = BASE_PLAN()
    assert is_milestone_dispatchable(plan["milestones"][0]) is True
    assert is_milestone_dispatchable(plan["milestones"][1]) is False  # provisional


def test_next_dispatchable_is_first_non_provisional() -> None:
    plan = BASE_PLAN()
    nxt = next_dispatchable_milestone(plan)
    assert nxt is not None
    assert nxt["id"] == "milestone-discovery"


def test_open_gate_blocks_its_transitive_dependents_only() -> None:
    plan = BASE_PLAN()
    # The billing milestone is provisional anyway; an answered gate would
    # still keep it non-dispatchable. Flip to answered and ensure the block
    # rule is scoped to the gate's affected tasks / needed_by.
    plan["milestones"][1]["milestone_flags"]["provisional"] = False
    plan["milestones"][1]["gates"][0]["status"] = "open"
    assert is_milestone_dispatchable(plan["milestones"][1]) is False
    plan["milestones"][1]["gates"][0]["status"] = "answered"
    assert is_milestone_dispatchable(plan["milestones"][1]) is True
