#!/usr/bin/env python3
"""T4 tests — reconcile human plan edits with execution authority (ZCode v1.3.0).

One table-driven suite mirroring the sibling repos' reconciliation coverage.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tooling"))

from lazyzcode_plan_reconcile import (  # noqa: E402
    accept_result,
    classify_plan_edits,
)

BASE = """# Plan

## TODOs

- [ ] T1: Scaffold (depends_on: [])
  - Acceptance: files exist
- [ ] T2: Billing (depends_on: T1)
  - Acceptance: billing works
- [ ] T3: Navigation (depends_on: [])
  - Acceptance: nav works
"""


def plan_with(t2_acceptance=None, checked=()):
    text = BASE
    if t2_acceptance:
        text = text.replace("  - Acceptance: billing works", f"  - Acceptance: {t2_acceptance}")
    for tid in checked:
        text = text.replace(f"- [ ] {tid}:", f"- [x] {tid}:")
    return text


ROWS = [
    ("whitespace-only-unchanged", BASE, BASE + "\n\n", "unchanged", [], []),
    ("human-check-assertion-cosmetic", BASE, plan_with(checked=("T1",)), "cosmetic", [], []),
    ("human-uncheck-reopens", plan_with(checked=("T1",)), BASE, "cosmetic", [], ["T1"]),
    ("acceptance-change-semantic", BASE, plan_with(t2_acceptance="billing works differently"), "semantic", ["T2"], []),
]


@pytest.mark.parametrize("label,old,new,expect_class,expect_invalidated,expect_reopen", ROWS,
                         ids=[r[0] for r in ROWS])
def test_reconciliation_rows(label, old, new, expect_class, expect_invalidated, expect_reopen):
    result = classify_plan_edits(old, new)
    assert result["classification"] == expect_class, f"{label}: {result}"
    invalidated = sorted(i["task"] for i in result["invalidations"])
    assert invalidated == sorted(expect_invalidated), f"{label}: {invalidated}"
    assert sorted(result["reopen"]) == sorted(expect_reopen)


def test_scoped_invalidation_transitive_only():
    result = classify_plan_edits(BASE, plan_with(t2_acceptance="changed"))
    invalidated = {i["task"] for i in result["invalidations"]}
    assert "T2" in invalidated
    assert "T3" not in invalidated, "independent task must not be invalidated"


def test_added_and_removed_tasks():
    new = BASE + "- [ ] T4: Reporting (depends_on: T2)\n  - Acceptance: reports\n"
    result = classify_plan_edits(BASE, new)
    assert result["added"] == ["T4"]
    assert not any(i["task"] == "T1" for i in result["invalidations"])
    removed = BASE.replace("- [ ] T2: Billing (depends_on: T1)\n  - Acceptance: billing works\n", "")
    result2 = classify_plan_edits(BASE, removed)
    assert result2["removed"] == ["T2"]


def test_reorder_cosmetic():
    lines = BASE.strip().splitlines()
    t2_start = next(i for i, l in enumerate(lines) if "T2:" in l)
    t3_start = next(i for i, l in enumerate(lines) if "T3:" in l)
    t2_block = lines[t2_start:t2_start + 2]
    t3_block = lines[t3_start:t3_start + 2]
    reordered = lines[:t2_start] + t3_block + t2_block + lines[t3_start + 2:]
    result = classify_plan_edits(BASE, "\n".join(reordered) + "\n")
    assert result["classification"] == "cosmetic"
    assert result["invalidations"] == []


def test_idempotent_restart():
    r1 = classify_plan_edits(BASE, plan_with(t2_acceptance="x"))
    r2 = classify_plan_edits(BASE, plan_with(t2_acceptance="x"))
    assert r1 == r2


def test_stale_result_guard():
    assert accept_result({"plan_sha256": "aaa"}, "aaa") == (True, "ok")
    ok, reason = accept_result({"plan_sha256": "aaa"}, "bbb")
    assert ok is False and "stale" in reason.lower()
    ok, reason = accept_result({}, "bbb")
    assert ok is False and "no plan_sha256" in reason
