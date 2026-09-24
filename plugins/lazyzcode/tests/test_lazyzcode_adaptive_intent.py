from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tooling"))

from lazyzcode_adaptive_intent import (
    derive_execution_intent,
    is_plan_only,
    normalise_intent,
    strips_execution_authority,
)
from lazyzcode_adaptive_detector import classify_adaptive_decision


INTENT_BOUNDARY_CASES = (
    ("inline-backticked-command", "`/lazy-start-work fix the typo`", "plan_only"),
    ("quoted-command", '"/lazy-start-work fix the typo"', "plan_only"),
    ("fenced-quote", "```text\n> /lazy-start-work fix the typo\n```", "plan_only"),
    ("markdown-quote", "> /lazy-start-work fix the typo", "plan_only"),
    ("history", "History: /lazy-start-work fix the typo", "plan_only"),
    ("inline-reference-then-fix", "The docs mention `/lazy-start-work`. Fix the parser bug.", "execute"),
    ("history-then-fix", "History: /lazy-start-work fix the typo\nFix the parser bug.", "execute"),
    ("quoted-line-with-words", "> please run /lazy-start-work", "plan_only"),
    ("history-then-direct-command", "History: /lazy-start-work fix the typo\n/lazy-start-work fix the typo", "execute"),
    ("denial", "Do not execute /lazy-start-work.", "plan_only"),
    ("explanation", "Explain /lazy-start-work.", "plan_only"),
    ("bare-command", "/lazy-start-work fix the typo", "execute"),
    ("direct-command", "Please run /lazy-start-work fix the typo.", "execute"),
    ("clear-fix", "Fix the typo in the welcome label.", "execute"),
)


@pytest.mark.parametrize(
    ("prompt", "expected"),
    [
        # Clear implementation verbs -> execute (T2: no command required).
        ("Fix the typo in the welcome label.", "execute"),
        ("Implement the login endpoint.", "execute"),
        ("Add a migration for the users table.", "execute"),
        ("Refactor the billing module.", "execute"),
        # Plan-only phrases -> plan_only.
        ("Plan only; do not implement.", "plan_only"),
        ("Plan only, do not run anything.", "plan_only"),
        ("Just the plan, no implementation.", "plan_only"),
        ("Do not implement this yet.", "plan_only"),
        # Explanation / quoted command framing -> plan_only (never executes).
        ("Explain how the billing module works and show the command to run the migration.", "plan_only"),
        ("Describe the architecture of the parser.", "plan_only"),
        ("What is the difference between v1 and v2?", "plan_only"),
        ("Show me the command to deploy the service.", "plan_only"),
        ("`make test` is how you run the suite.", "plan_only"),
        # Ambiguous / no verb -> default plan_only.
        ("The welcome label looks off.", "plan_only"),
        ("", "plan_only"),
    ],
)
def test_derive_execution_intent_table(prompt: str, expected: str) -> None:
    assert derive_execution_intent(prompt) == expected


def test_persisted_intent_is_authoritative() -> None:
    # A persisted execute intent is honoured even for an ambiguous request.
    assert derive_execution_intent("The label looks off.", {"execution_intent": "execute"}) == "execute"
    # A persisted plan_only intent is honoured even for an execution verb.
    assert derive_execution_intent("Fix the typo.", {"execution_intent": "plan_only"}) == "plan_only"
    # Unknown persisted values fall through to request derivation.
    assert derive_execution_intent("Fix the typo.", {"execution_intent": "bogus"}) == "execute"


def test_normalise_intent() -> None:
    assert normalise_intent("plan_only") == "plan_only"
    assert normalise_intent("execute") == "execute"
    assert normalise_intent("bogus") is None
    assert normalise_intent(None) is None


def test_plan_only_invariant_helpers() -> None:
    assert is_plan_only("plan_only") is True
    assert is_plan_only("execute") is False
    # The plan-only invariant: plan_only never grants execution authority.
    assert strips_execution_authority("plan_only") is True
    assert strips_execution_authority("execute") is False


@pytest.mark.parametrize(("_case", "prompt", "expected"), INTENT_BOUNDARY_CASES)
def test_current_message_intent_ignores_inert_workflow_mentions(
    _case: str, prompt: str, expected: str,
) -> None:
    assert classify_adaptive_decision(prompt)["execution_intent"] == expected
