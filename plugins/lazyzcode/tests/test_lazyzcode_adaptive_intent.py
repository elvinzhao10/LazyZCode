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


def test_backticked_filename_keeps_execution_authority() -> None:
    # Regression: a bare backtick span is usually a filename or code reference
    # in an ordinary implementation request ("fix the bug in `src/parser.js`"),
    # not a shown command. It must not strip execution authority.
    assert derive_execution_intent("fix the bug in `src/parser.js` and run the tests") == "execute"


def test_shown_command_still_plans() -> None:
    # S4 stays intact: framed shown-commands are displayed, not executed.
    assert derive_execution_intent("show me the command to run `npm test`") == "plan_only"
    assert derive_execution_intent("run this command `npm run build` and tell me the output") == "plan_only"


def test_current_plan_only_phrasing_outranks_persisted_execute() -> None:
    # Nothing in memory can override current instructions: a persisted
    # `execute` intent must lose to present-tense plan-only phrasing.
    assert derive_execution_intent(
        "just plan this, do not implement", {"execution_intent": "execute"},
    ) == "plan_only"
    # Without current plan-only phrasing the persisted intent still applies.
    assert derive_execution_intent(
        "continue with the next task", {"execution_intent": "execute"},
    ) == "execute"


def test_explanation_and_shown_commands_never_gain_execution_authority_from_memory() -> None:
    # The plan-only invariant is absolute: an explanation or a shown command
    # must not grant execution authority — a persisted `execute` intent cannot
    # change that. Memory only speaks when the current request is silent.
    assert derive_execution_intent(
        "explain what you just did", {"execution_intent": "execute"},
    ) == "plan_only"
    assert derive_execution_intent(
        "show me the command to run `npm test`", {"execution_intent": "execute"},
    ) == "plan_only"
