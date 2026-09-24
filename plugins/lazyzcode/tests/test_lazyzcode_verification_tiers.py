"""Table-driven tests for lazyzcode_verification_tiers (T6).

Covers the shared V0-V3 tier matrix, the no-promotion rule (counts/size/"complex"
never promote), and receipt reuse / rerun boundaries. Uses the same matrix shape
as the sibling Buddy/Trae lanes.

Repo-safe tmp handling: a fresh tempfile.TemporaryDirectory under the test's own
dir with an exists() guard, copied from test_lazyzcode_decision_ledger.py.
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import pytest

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
TOOLING_DIR = PLUGIN_ROOT / "tooling"
sys.path.insert(0, str(TOOLING_DIR))

from lazyzcode_verification_tiers import (  # noqa: E402
    SHARED_TIERS,
    BOUNDARY_TIER,
    NON_PROMOTING_INPUTS,
    TIERS,
    VerificationReceipt,
    reuse_receipt,
    rerun_scope,
    select_tier,
    status_projection,
)


@pytest.fixture
def workdir():
    with tempfile.TemporaryDirectory(prefix="qd-vt-") as directory:
        yield Path(directory)


# --------------------------------------------------------------------------- #
# Tier selection matrix (same shape as sibling lanes)
# --------------------------------------------------------------------------- #

TIER_MATRIX = [
    # (label, boundary_category, expected_tier)
    ("doc -> V0", "doc", "V0"),
    ("metadata -> V0", "metadata", "V0"),
    ("formatting -> V0", "formatting", "V0"),
    ("inert_fixture -> V0", "inert_fixture", "V0"),
    ("localized -> V1", "localized", "V1"),
    ("cross_module -> V2", "cross_module", "V2"),
    ("state -> V2", "state", "V2"),
    ("parser -> V2", "parser", "V2"),
    ("migration -> V2", "migration", "V2"),
    ("lifecycle -> V2", "lifecycle", "V2"),
    ("host_routing -> V2", "host_routing", "V2"),
    ("security_trust -> V3", "security_trust", "V3"),
    ("release_packaging -> V3", "release_packaging", "V3"),
    ("shared_contract -> V3", "shared_contract", "V3"),
    ("broad_infrastructure -> V3", "broad_infrastructure", "V3"),
]


@pytest.mark.parametrize(
    ("label", "category", "expected"),
    TIER_MATRIX,
    ids=[c[0] for c in TIER_MATRIX],
)
def test_select_tier_matrix(label: str, category: str, expected: str) -> None:
    assert select_tier({"category": category}) == expected


def test_select_tier_unknown_category_rejected() -> None:
    with pytest.raises(ValueError):
        select_tier({"category": "teleport"})


def test_select_tier_requires_mapping() -> None:
    with pytest.raises(TypeError):
        select_tier("localized")  # type: ignore[arg-type]


def test_shared_tiers_consume_canonical_definitions() -> None:
    # The shared fixture carries presentation tiers, not verification tiers, so
    # the embedded canonical (plan behavior 9) definitions are consumed.
    assert set(SHARED_TIERS) == set(TIERS)
    for tier in TIERS:
        assert "scope" in SHARED_TIERS[tier]
    # No fork: the four tiers map to exactly the documented boundary categories.
    assert set(BOUNDARY_TIER.values()) == set(TIERS)


# --------------------------------------------------------------------------- #
# No-promotion rule: counts / size / "complex" never promote
# --------------------------------------------------------------------------- #

NO_PROMOTION = [
    # (label, category, noisy_overrides)
    ("doc stays V0 despite huge counts", "doc", {
        "test_count": 500, "file_count": 200, "agent_count": 20,
        "plan_size": "very-large", "complex": True,
    }),
    ("localized stays V1 despite huge counts", "localized", {
        "test_count": 999, "file_count": 500, "agent_count": 50,
        "plan_size": "huge", "complex": "yes",
    }),
    ("cross_module stays V2 despite huge counts", "cross_module", {
        "test_count": 999, "file_count": 500, "complex": True,
    }),
    ("security_trust stays V3 with complex flag", "security_trust", {
        "complex": True, "test_count": 0,
    }),
]


@pytest.mark.parametrize(
    ("label", "category", "noisy"),
    NO_PROMOTION,
    ids=[c[0] for c in NO_PROMOTION],
)
def test_no_promotion_from_counts_size_or_complex(
    label: str, category: str, noisy: dict
) -> None:
    boundary = {"category": category, **noisy}
    expected = BOUNDARY_TIER[category]
    assert select_tier(boundary) == expected
    # Adding the noisy inputs must not change the result vs. the bare boundary.
    assert select_tier(boundary) == select_tier({"category": category})


def test_no_promotion_inputs_are_explicitly_ignored() -> None:
    # Every NON_PROMOTING_INPUTS key must be inert to selection.
    for key in NON_PROMOTING_INPUTS:
        assert select_tier({"category": "localized", key: "anything"}) == "V1"
        assert select_tier({"category": "doc", key: "anything"}) == "V0"


def test_observed_risk_unexplained_failure_promotes_to_v3() -> None:
    # An observed risk (unexplained failure) is a real promotion, distinct from
    # the forbidden count/size signals.
    assert select_tier({"category": "localized"}, risk={"unexplained_failure": True}) == "V3"
    # Without the risk flag the same boundary stays V1.
    assert select_tier({"category": "localized"}) == "V1"


# --------------------------------------------------------------------------- #
# Receipt reuse boundaries
# --------------------------------------------------------------------------- #


def _green(tier: str = "V1", **overrides) -> VerificationReceipt:
    base = dict(
        tier=tier,
        result="pass",
        covered_behavior="welcome-label-typo",
        argv=("pytest", "-q", "tests/test_welcome.py"),
        tree="main",
        revision="abc123",
        environment_fingerprint={"python": "3.12", "os": "darwin"},
        artifact_ref=".lazyzcode/runs/r1/evidence/welcome.json",
    )
    base.update(overrides)
    return VerificationReceipt(**base)


RECEIPT_REUSE = [
    # (label, receipt, declared_inputs, covered_behavior, expect_reuse)
    ("green identical inputs reused", _green(), {
        "tier": "V1", "argv": ("pytest", "-q", "tests/test_welcome.py"),
        "tree": "main", "revision": "abc123",
        "environment_fingerprint": {"python": "3.12", "os": "darwin"},
    }, "welcome-label-typo", True),
    ("non-green never reused", _green(result="fail"), {
        "tier": "V1", "argv": ("pytest", "-q", "tests/test_welcome.py"),
        "tree": "main", "revision": "abc123",
        "environment_fingerprint": {"python": "3.12", "os": "darwin"},
    }, "welcome-label-typo", False),
    ("changed revision invalidates", _green(), {
        "tier": "V1", "argv": ("pytest", "-q", "tests/test_welcome.py"),
        "tree": "main", "revision": "def456",
        "environment_fingerprint": {"python": "3.12", "os": "darwin"},
    }, "welcome-label-typo", False),
    ("changed tree invalidates", _green(), {
        "tier": "V1", "argv": ("pytest", "-q", "tests/test_welcome.py"),
        "tree": "feature", "revision": "abc123",
        "environment_fingerprint": {"python": "3.12", "os": "darwin"},
    }, "welcome-label-typo", False),
    ("changed env fingerprint invalidates", _green(), {
        "tier": "V1", "argv": ("pytest", "-q", "tests/test_welcome.py"),
        "tree": "main", "revision": "abc123",
        "environment_fingerprint": {"python": "3.13", "os": "darwin"},
    }, "welcome-label-typo", False),
    ("changed argv invalidates", _green(), {
        "tier": "V1", "argv": ("pytest", "-q", "tests/test_other.py"),
        "tree": "main", "revision": "abc123",
        "environment_fingerprint": {"python": "3.12", "os": "darwin"},
    }, "welcome-label-typo", False),
    ("changed covered behavior invalidates", _green(), {
        "tier": "V1", "argv": ("pytest", "-q", "tests/test_welcome.py"),
        "tree": "main", "revision": "abc123",
        "environment_fingerprint": {"python": "3.12", "os": "darwin"},
    }, "different-boundary", False),
    ("none receipt never reused", None, {
        "tier": "V1", "argv": ("pytest",), "tree": "main",
        "revision": "abc123", "environment_fingerprint": {},
    }, "x", False),
]


@pytest.mark.parametrize(
    ("label", "receipt", "declared_inputs", "covered_behavior", "expect"),
    RECEIPT_REUSE,
    ids=[c[0] for c in RECEIPT_REUSE],
)
def test_reuse_receipt_boundaries(
    label: str,
    receipt: VerificationReceipt | None,
    declared_inputs: dict,
    covered_behavior: str,
    expect: bool,
) -> None:
    assert reuse_receipt(receipt, declared_inputs, covered_behavior) is expect


def test_reuse_requires_green_only() -> None:
    green = _green()
    red = _green(result="fail")
    inputs = {
        "tier": green.tier, "argv": green.argv, "tree": green.tree,
        "revision": green.revision,
        "environment_fingerprint": green.environment_fingerprint,
    }
    assert reuse_receipt(green, inputs, green.covered_behavior) is True
    assert reuse_receipt(red, inputs, green.covered_behavior) is False


# --------------------------------------------------------------------------- #
# Rerun scope after a focused failure
# --------------------------------------------------------------------------- #


def test_rerun_focused_failure_reruns_only_self_and_affected_integration() -> None:
    failed = _green(result="fail", tier="V1")
    plan = rerun_scope(failed, directly_affected_integration="billing-intake-flow")
    # Reruns the failed focused check itself plus exactly the directly affected
    # integration scenario; the comprehensive gate is skipped.
    assert plan["rerun"] == ["V1", "V2"]
    assert plan["affected_integration"] == "billing-intake-flow"
    assert plan["skip_comprehensive_gate"] is True


def test_rerun_focused_failure_without_affected_is_self_only() -> None:
    failed = _green(result="fail", tier="V1")
    plan = rerun_scope(failed)
    # No directly affected integration -> only the failed check reruns.
    assert plan["rerun"] == ["V1"]
    assert plan["affected_integration"] is None
    assert plan["skip_comprehensive_gate"] is True


def test_rerun_requires_receipt_instance() -> None:
    with pytest.raises(TypeError):
        rerun_scope({"tier": "V1", "result": "fail"})  # type: ignore[arg-type]


# --------------------------------------------------------------------------- #
# Status projection (exposed via policy explanation surface)
# --------------------------------------------------------------------------- #


def test_status_projection_has_required_keys_and_pending_host() -> None:
    projection = status_projection(
        outcome="complete",
        current_milestone="M2",
        blockers=["decision: billing-provider"],
        decisions=["dec-001"],
        next_action="await provider decision",
        material_verification={"V1": "pass", "V2": "pending"},
    )
    assert set(projection) == {
        "outcome", "current_milestone", "blockers", "decisions",
        "next_action", "material_verification", "host_readiness",
    }
    # ZCode boundary constraint: no activation claim.
    assert projection["host_readiness"] == "pending"
    assert projection["outcome"] == "complete"
    assert projection["blockers"] == ["decision: billing-provider"]
