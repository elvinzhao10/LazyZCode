"""LazyZCode v1.3.0 execution-intent resolution.

Dual-entry convergence (T2): both the explicit ``/lazy-start-work`` route and a
natural-language implementation request must converge on the same execution
authority and gates. The persisted ``execution_intent`` (``plan_only`` |
``execute``) is stored separately from ``workflow_mode`` / ``stage`` and
defaults to ``plan_only``.

Plan-only invariant: an explanation, a quoted command, or an explicit plan-only
request MUST NOT mutate product files and MUST NOT grant execution authority.
A mere file edit, a quoted example, or an ambiguous ``yes`` with several pending
questions can never flip ``execution_intent`` to ``execute``; only an explicit
later execution request may.
"""
from __future__ import annotations

import re
from typing import Final

from lazyzcode_adaptive_policy import current_action_text

PLAN_ONLY_PATTERN: Final = re.compile(
    r"\b(?:plan only|plan-only|just (?:the )?plan|do not implement|don'?t implement|"
    r"do not (?:run|execute|apply|make|code|build|change)|"
    r"don'?t (?:run|execute|apply|make|code|build|change)|"
    r"no (?:implementation|execution|code|changes?)|without implementing)\b",
    re.I,
)
# Explanation / documentation framing dominates: a request to explain, describe,
# or answer "how/what" never executes code even if it names an action verb.
EXPLANATION_PATTERN: Final = re.compile(
    r"\b(?:explain|describe|document|summarise|summarize|compare|"
    r"tell me|what (?:is|are|was|were)|how (?:do|does|did|to|can|should)|why (?:do|does|is|are))\b",
    re.I,
)
# A quoted / referred command is shown, not executed (S4: "show the command to run").
QUOTED_COMMAND_PATTERN: Final = re.compile(
    r"show (?:me|the|us)?\s*(?:the|that)?\s*command\b|"
    r"\bthe command to\b|"
    # A bare backtick span is usually a filename or code reference in an
    # implementation request ("fix the bug in `src/parser.js`"), so it only
    # signals a shown command when framed with command-looking context
    # (imperative inside the span, or "run/execute/use this command").
    r"(?:\b(?:run|execute|use|try)\s+(?:this\s+|that\s+|the\s+)?command\s*`[^`]+`)|"
    # "`x` is ..." is descriptive framing (talking ABOUT the command).
    r"`[^`]+`\s+is\b|"
    r"\b(?:example|sample)\s+(?:command|script)\b",
    re.I,
)
EXECUTION_VERB_PATTERN: Final = re.compile(
    r"\b(?:add|analyze|audit|build|change|configure|correct|create|debug|deploy|"
    r"diagnose|export|fix|implement|install|investigate|migrate|publish|refactor|"
    r"release|remove|rename|resume|review|send|setup|simplify|streamline|test|"
    r"update|upload|use|validate)\b",
    re.I,
)


def normalise_intent(value: object) -> str | None:
    """Return a canonical intent for a persisted/context value, or None."""
    if value == "plan_only" or value == "execute":
        return value
    if isinstance(value, str) and value in ("plan_only", "execute"):
        return value
    return None


def derive_execution_intent(request: str, context: dict | None = None) -> str:
    """Resolve the persisted execution intent.

    Priority:
      1. An explicit plan-only phrase in the CURRENT request -> ``plan_only``.
         Current instructions outrank memory: a persisted ``execute`` intent
         can never override a present-tense "just plan, do not implement".
      2. Explanation / documentation framing, or a quoted/referenced command
         (shown, not run) -> ``plan_only``. These never grant execution
         authority, so they also outrank a persisted ``execute`` intent.
      3. A persisted intent supplied via ``context["execution_intent"]``
         (applies when the current request carries no signal of its own —
         e.g. an ambiguous "continue" resumes an executing run).
      4. A clear implementation verb -> ``execute``.
      5. Otherwise (ambiguous) -> ``plan_only`` (default; ambiguous approval can
         never grant execution authority).
    """
    active_request = current_action_text(request)
    if PLAN_ONLY_PATTERN.search(active_request) is not None:
        return "plan_only"
    if EXPLANATION_PATTERN.search(active_request) is not None:
        return "plan_only"
    if QUOTED_COMMAND_PATTERN.search(active_request) is not None:
        return "plan_only"
    if isinstance(context, dict):
        persisted = normalise_intent(context.get("execution_intent"))
        if persisted is not None:
            return persisted
    if EXECUTION_VERB_PATTERN.search(active_request) is not None:
        return "execute"
    return "plan_only"


def is_plan_only(intent: str) -> bool:
    return intent == "plan_only"


def strips_execution_authority(intent: str) -> bool:
    """Plan-only intent never grants execution authority (T2 invariant)."""
    return is_plan_only(intent)
