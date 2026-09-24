"""Verification tiers (v1.3.0) for LazyZCode.

Canonical source: the lazyseries-v1.3.0 plan, behavior 9 -- four verification
tiers V0/V1/V2/V3 shared across LazyBuddy, LazyTrae, and LazyZCode. The shared
contract fixture ``contracts/fixtures/lazyseries-v130-scenarios.v1.json`` is the
executable data for the T1-T6 behavioral fixtures; its ``behaviors.f_execution_tiers``
are *presentation* tiers (small/medium/complex), which are distinct from the
*verification* tiers V0-V3 defined here.

This module CONSUMES the canonical tier rules from the plan spec (it does not
fork a divergent local copy). If a structured ``verification_tiers`` block is ever
published in the shared fixture it is loaded and used; otherwise the embedded
canonical definitions -- a verbatim mirror of plan behavior 9 -- apply.

T6 reductions (plan behavior; T6 selection rules):
  * Default to the lowest sufficient tier. Test count, file count, plan size,
    agent count, or a request being called "complex" can NEVER promote
    verification.
  * Promote only for the changed boundary or observed risk.
  * A failing focused check triggers diagnosis and reruns only itself plus the
    directly affected integration; it does NOT trigger every suite.
  * One comprehensive gate runs once, after the final relevant change (normally
    protected CI).

Status surface (requirement 2): the machine-status v2 schema
(``contracts/lazyzcode-machine-status.v2.schema.json``) is frozen
(``additionalProperties: false``; ``lifecycle/machine-status.js`` validateMachineStatus
uses exact-key checks), so the default-status projection is exposed through the
policy explanation surface (``lazyzcode_adaptive_selection_explanation.py``)
rather than added to the machine-status path. See ``status_projection`` and the
wrapper there.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Final

TIERS: Final = ("V0", "V1", "V2", "V3")

# Canonical verification-tier definitions (plan behavior 9). Consumed verbatim;
# a published shared-fixture block overrides these via _load_shared_tiers().
TIER_DEFS: Final = {
    "V0": {
        "label": "inspect",
        "scope": (
            "documentation, metadata, formatting, or inert fixture changes"
        ),
        "action": (
            "run syntax/schema/static checks only when applicable; no new test "
            "is required by default"
        ),
    },
    "V1": {
        "label": "focused",
        "scope": "localized reversible behavior",
        "action": (
            "run the smallest existing test or direct user-surface scenario "
            "covering the changed boundary"
        ),
    },
    "V2": {
        "label": "integrated",
        "scope": (
            "cross-module, state, parser, migration, lifecycle, or "
            "host-routing behavior"
        ),
        "action": "run focused checks plus one real consumer/integration scenario",
    },
    "V3": {
        "label": "comprehensive",
        "scope": (
            "security/trust boundaries, release packaging, shared contract/schema "
            "changes, broad infrastructure changes, or an unexplained focused failure"
        ),
        "action": (
            "run the repository's comprehensive gate once, normally in protected CI"
        ),
    },
}

# Changed-boundary category -> lowest sufficient base tier.
BOUNDARY_TIER: Final = {
    # V0 inspect
    "doc": "V0",
    "metadata": "V0",
    "formatting": "V0",
    "inert_fixture": "V0",
    # V1 focused
    "localized": "V1",
    # V2 integrated
    "cross_module": "V2",
    "state": "V2",
    "parser": "V2",
    "migration": "V2",
    "lifecycle": "V2",
    "host_routing": "V2",
    # V3 comprehensive
    "security_trust": "V3",
    "release_packaging": "V3",
    "shared_contract": "V3",
    "broad_infrastructure": "V3",
}

# Inputs that MUST NOT promote verification under any circumstance (T6 rule).
NON_PROMOTING_INPUTS: Final = (
    "test_count",
    "file_count",
    "agent_count",
    "plan_size",
    "complex",
)


def _tier_index(tier: str) -> int:
    return TIERS.index(tier)


def _max_tier(first: str, second: str) -> str:
    return first if _tier_index(first) >= _tier_index(second) else second


def select_tier(changed_boundary: dict, risk: dict | None = None) -> str:
    """Return the lowest sufficient verification tier for a change.

    ``changed_boundary`` is a mapping with at least ``category`` (one of
    :data:`BOUNDARY_TIER`). It MAY carry :data:`NON_PROMOTING_INPUTS`
    (``test_count``, ``file_count``, ``agent_count``, ``plan_size``,
    ``complex``) -- those are read for test clarity but explicitly ignored; they
    can never raise the selected tier.

    ``risk`` is an optional mapping of observed risk flags. The only risk flag
    that may promote is ``unexplained_failure`` (an observed risk, not a
    count/size signal), which raises to V3. Security/trust/shared-contract/
    release/broad boundaries are expressed via the boundary category.

    Promotion happens ONLY for the changed boundary or an observed risk that
    names a real boundary. Counts, file size, and the word "complex" never
    promote.
    """
    if not isinstance(changed_boundary, dict):
        raise TypeError("changed_boundary must be a mapping with a 'category' key")
    category = changed_boundary.get("category")
    if category not in BOUNDARY_TIER:
        raise ValueError(
            f"unknown boundary category {category!r}; expected one of "
            f"{sorted(BOUNDARY_TIER)}"
        )
    tier = BOUNDARY_TIER[category]
    risk = risk or {}
    # Observed risk promotion (named boundary only).
    if risk.get("unexplained_failure"):
        tier = _max_tier(tier, "V3")
    # Non-promoting inputs are intentionally ignored (T6 no-promotion rule).
    for noisy in NON_PROMOTING_INPUTS:
        _ = changed_boundary.get(noisy)
    return tier


@dataclass
class VerificationReceipt:
    """Compact verification receipt (T6 receipt contract).

    Carries tier, exact argv/surface, covered behavior, tree/revision, relevant
    environment fingerprint, result, and artifact reference. Reviewers/QA consume
    it by reference; identical green commands are never rerun solely because a
    new phase or agent started.
    """

    tier: str
    result: str  # "pass" | "fail"
    covered_behavior: str = ""
    argv: tuple = field(default_factory=tuple)
    surface: str | None = None
    tree: str = ""
    revision: str = ""
    environment_fingerprint: dict = field(default_factory=dict)
    artifact_ref: str | None = None

    def is_green(self) -> bool:
        return self.result == "pass"


def _declared_inputs(receipt: VerificationReceipt) -> dict:
    return {
        "tier": receipt.tier,
        "argv": tuple(receipt.argv),
        "tree": receipt.tree,
        "revision": receipt.revision,
        "environment_fingerprint": dict(receipt.environment_fingerprint),
    }


def reuse_receipt(
    existing: VerificationReceipt | None,
    declared_inputs: dict,
    covered_behavior: str,
) -> bool:
    """Return True iff a green receipt may be reused.

    A receipt is reusable ONLY when it is green (``result == "pass"``) AND its
    declared inputs (tier, argv, tree, revision, environment fingerprint) and its
    covered behavior are unchanged. Otherwise the check must rerun.
    """
    if not isinstance(existing, VerificationReceipt):
        return False
    if not existing.is_green():
        return False
    if existing.covered_behavior != covered_behavior:
        return False
    current = _declared_inputs(existing)
    declared = {
        "tier": declared_inputs.get("tier"),
        "argv": tuple(declared_inputs.get("argv", ())),
        "tree": declared_inputs.get("tree", ""),
        "revision": declared_inputs.get("revision", ""),
        "environment_fingerprint": dict(
            declared_inputs.get("environment_fingerprint", {})
        ),
    }
    return all(current[key] == declared[key] for key in declared)


def rerun_scope(
    failed_receipt: VerificationReceipt,
    directly_affected_integration: str | None = None,
) -> dict:
    """Minimal rerun plan after a focused check fails (T6 rerun rule).

    Rerun only the failed check, then any *directly affected* integration check.
    It MUST NOT include an unrelated suite or the full comprehensive (V3) gate --
    that runs once after the final relevant change, normally in protected CI.

    ``failed_receipt``: the failing (non-green) :class:`VerificationReceipt`.
    ``directly_affected_integration``: optional identifier of the single
        integration scenario affected by the failed boundary; rerun only that one.
    """
    if not isinstance(failed_receipt, VerificationReceipt):
        raise TypeError("failed_receipt must be a VerificationReceipt")
    plan = {
        "rerun": [failed_receipt.tier],
        "skip_comprehensive_gate": True,
        "affected_integration": None,
    }
    # A failed focused (V1) check reruns itself plus exactly the directly
    # affected integration (V2) scenario -- never the whole suite.
    if directly_affected_integration is not None:
        plan["rerun"].append("V2")
        plan["affected_integration"] = directly_affected_integration
    return plan


def status_projection(
    outcome: str,
    current_milestone: str | None = None,
    blockers: list | None = None,
    decisions: list | None = None,
    next_action: str | None = None,
    material_verification: dict | None = None,
) -> dict:
    """Default status projection (requirement 2).

    Shows outcome, current milestone, blockers/decisions, next action, and only
    material verification state. Surfaced via the policy explanation surface
    because the machine-status v2 schema is frozen (see module docstring).

    ``host_readiness`` is always reported pending: this lane makes no activation
    claim (ZCode boundary constraint).
    """
    return {
        "outcome": outcome,
        "current_milestone": current_milestone,
        "blockers": list(blockers or []),
        "decisions": list(decisions or []),
        "next_action": next_action,
        "material_verification": material_verification,
        "host_readiness": "pending",
    }


_FIXTURE_PATH = (
    Path(__file__).resolve().parent.parent
    / "contracts"
    / "fixtures"
    / "lazyseries-v130-scenarios.v1.json"
)


def _load_shared_tiers() -> dict | None:
    """Consume V0-V3 definitions from the shared fixture when published.

    The fixture currently carries presentation tiers (small/medium/complex) under
    ``behaviors.f_execution_tiers``, not the verification tiers; this returns None
    so the embedded canonical definitions (plan behavior 9) are used. If a future
    fixture publishes a ``verification_tiers`` block, it is consumed verbatim and
    not forked.
    """
    try:
        data = json.loads(_FIXTURE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    verification = data.get("verification_tiers")
    if not isinstance(verification, dict):
        return None
    # Validate the shape minimally; any divergence is rejected rather than forked.
    loaded: dict = {}
    for tier in TIERS:
        spec = verification.get(tier)
        if not isinstance(spec, dict) or "scope" not in spec:
            return None
        loaded[tier] = spec
    return loaded


# Consume shared definitions when present; otherwise the canonical plan spec.
SHARED_TIERS: Final = _load_shared_tiers() or TIER_DEFS
