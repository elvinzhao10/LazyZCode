"""Durable decision memory and correction handling for LazyZCode.

This module implements the `decisions/ledger.jsonl` semantics described in
``lazyseries-shared-semantics.v1.json`` and the canonical format in
``lazyseries-v130-scenarios.v1.json``. It is the ZCode Python mirror of the
Buddy decision-ledger lane.

Design invariants (plan behavior 7, T5):

* Events are versioned and immutable. Append order determines replay;
  timestamps are metadata only and are never auto-injected, so identical
  re-appends compare byte-for-byte and remain idempotent.
* Event and decision IDs are globally unique ``uuid4`` values. There is no
  race-prone ``D-####`` counter.
* Old statuses are never mutated in place. The active view is always derived
  by replaying the ledger from the beginning.
* The same ``event_id`` re-appended with identical content is a no-op. The
  same ``event_id`` with differing content is rejected.
* References are validated against existing events; cycles and dangling
  references are rejected.
* Malformed or truncated tail records fail visibly with the offending byte
  offset. Bytes are preserved; recovery is explicit and never silent.
* Retrieval is bounded by a context budget (default 8,000 chars) and reports
  truncation. Absent ledger means empty, valid memory.
* Memory never overrides current user instructions and never executes
  instructions embedded in evidence. (Callers own that boundary; this module
  only stores and replays evidence as inert text.)

The ledger lives under ``.lazyzcode/decisions/ledger.jsonl`` (the project
state root). Writes are serialized through a single exclusive lock so that
concurrent workers cannot interleave or duplicate events.
"""

from __future__ import annotations

import fcntl
import json
import os
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Final

# --------------------------------------------------------------------------- #
# Constants
# --------------------------------------------------------------------------- #

STATE_ROOT_DEFAULT: Final = ".lazyzcode"
LEDGER_SUBDIR: Final = "decisions"
LEDGER_FILENAME: Final = "ledger.jsonl"
DEFAULT_RETRIEVAL_CHARS: Final = 8000
GLOBAL_SCOPES: Final = frozenset({"*", "global", "all"})

EVENT_TYPES: Final = (
    "decision-recorded",
    "decision-superseded",
    "decision-voided",
    "correction-opened",
    "correction-resolved",
)

# Required fields per event union (extra fields are allowed and preserved).
EVENT_REQUIRED: Final = {
    "decision-recorded": {
        "event_id",
        "type",
        "decision_id",
        "summary",
        "rationale",
        "project",
        "scope",
        "source_plan",
        "source_revision",
        "evidence",
    },
    "decision-superseded": {
        "event_id",
        "type",
        "old_decision_id",
        "new_decision_id",
        "reason",
    },
    "decision-voided": {"event_id", "type", "target_decision_id", "reason"},
    "correction-opened": {
        "event_id",
        "type",
        "decision_or_task_ref",
        "scope",
        "defect_evidence",
    },
    "correction-resolved": {
        "event_id",
        "type",
        "target_correction_id",
        "verified_fix_evidence",
    },
}


# --------------------------------------------------------------------------- #
# Errors
# --------------------------------------------------------------------------- #


class DecisionLedgerError(Exception):
    """Base class for all decision-ledger failures."""


class MalformedLedgerError(DecisionLedgerError):
    """Raised when a ledger line is not valid JSON or is structurally invalid.

    Carries the byte offset of the offending line so recovery tools can point
    at the exact corrupt record. Bytes are never modified by the reader.
    """

    def __init__(self, message: str, *, byte_offset: int, line_no: int) -> None:
        super().__init__(message)
        self.byte_offset = byte_offset
        self.line_no = line_no


class DuplicateIdConflictError(DecisionLedgerError):
    """Raised when the same ``event_id`` is reused with differing content."""


class InvalidReferenceError(DecisionLedgerError):
    """Raised when an event references a target that does not exist."""


class ReferenceCycleError(DecisionLedgerError):
    """Raised when an event would create a replay cycle or re-apply a terminal
    state (e.g. superseding a decision that is already inactive, or resolving
    an already-resolved correction)."""


# --------------------------------------------------------------------------- #
# Active view
# --------------------------------------------------------------------------- #


@dataclass
class ActiveMemory:
    """Replay-derived view of the decision ledger.

    ``text`` / ``truncated`` / ``retrieved_chars`` / ``omitted_chars`` are
    populated only by ``retrieve_active``; ``load_events`` + ``replay_active``
    leave them at their empty defaults.
    """

    active_decisions: list[dict] = field(default_factory=list)
    open_corrections: list[dict] = field(default_factory=list)
    resolved_corrections: list[dict] = field(default_factory=list)
    superseded_decision_ids: set[str] = field(default_factory=set)
    voided_decision_ids: set[str] = field(default_factory=set)
    text: str = ""
    truncated: bool = False
    retrieved_chars: int = 0
    omitted_chars: int = 0


# --------------------------------------------------------------------------- #
# Path helpers
# --------------------------------------------------------------------------- #


def ledger_path(
    project_root: str | os.PathLike[str],
    state_root: str = STATE_ROOT_DEFAULT,
) -> Path:
    """Return the absolute path to ``decisions/ledger.jsonl`` under the state root."""
    return Path(project_root) / state_root / LEDGER_SUBDIR / LEDGER_FILENAME


# --------------------------------------------------------------------------- #
# Internal helpers
# --------------------------------------------------------------------------- #


def _canonical(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _validate_shape(event: dict) -> None:
    if not isinstance(event, dict):
        raise DecisionLedgerError("ledger event must be a JSON object")
    event_type = event.get("type")
    if event_type not in EVENT_TYPES:
        raise DecisionLedgerError(f"unknown ledger event type: {event_type!r}")
    required = EVENT_REQUIRED[event_type]  # type: ignore[index]
    missing = required - set(event.keys())
    if missing:
        raise DecisionLedgerError(
            f"event {event_type!r} missing required fields: {sorted(missing)}"
        )
    event_id = event.get("event_id")
    if not isinstance(event_id, str) or not event_id:
        raise DecisionLedgerError("event_id must be a non-empty string")


def _classify(events: list[dict]) -> dict:
    """Build a replay-state snapshot used for reference validation and replay."""
    decisions: dict[str, dict] = {}
    status: dict[str, str] = {}
    corrections: dict[str, dict] = {}
    resolved: set[str] = set()
    for ev in events:
        etype = ev.get("type")
        if etype == "decision-recorded":
            did = ev["decision_id"]
            decisions[did] = ev
            status.setdefault(did, "active")
        elif etype == "decision-superseded":
            old = ev["old_decision_id"]
            new = ev["new_decision_id"]
            if old in status:
                status[old] = "superseded"
            decisions.setdefault(new, ev)
            status.setdefault(new, "active")
        elif etype == "decision-voided":
            target = ev["target_decision_id"]
            if target in status:
                status[target] = "voided"
        elif etype == "correction-opened":
            cid = ev["event_id"]
            corrections[cid] = ev
        elif etype == "correction-resolved":
            resolved.add(ev["target_correction_id"])
    return {
        "decisions": decisions,
        "status": status,
        "corrections": corrections,
        "resolved": resolved,
    }


def _validate_references(event: dict, state: dict) -> None:
    etype = event["type"]
    decisions = state["decisions"]
    status = state["status"]
    corrections = state["corrections"]
    resolved = state["resolved"]

    if etype == "decision-superseded":
        old = event["old_decision_id"]
        new = event["new_decision_id"]
        if old not in decisions:
            raise InvalidReferenceError(
                f"decision-superseded references unknown old_decision_id: {old!r}"
            )
        if new not in decisions:
            raise InvalidReferenceError(
                f"decision-superseded references unknown new_decision_id: {new!r}"
            )
        if old == new:
            raise ReferenceCycleError("decision-superseded cannot target itself")
        if status.get(old) != "active":
            raise ReferenceCycleError(
                f"cannot supersede a decision that is not active: {old!r}"
            )
    elif etype == "decision-voided":
        target = event["target_decision_id"]
        if target not in decisions:
            raise InvalidReferenceError(
                f"decision-voided references unknown target_decision_id: {target!r}"
            )
        if status.get(target) != "active":
            raise ReferenceCycleError(
                f"cannot void a decision that is not active: {target!r}"
            )
    elif etype == "correction-opened":
        ref = event["decision_or_task_ref"]
        scope = event.get("scope")
        if not isinstance(scope, str) or not scope:
            raise InvalidReferenceError("correction-opened requires a non-empty scope")
        # A decision reference must resolve to a known decision; an unknown
        # id is treated as an external task id and accepted.
        # A correction may reference any known decision (even one already
        # superseded or voided) or an external task id. Only an unknown
        # uuid-shaped decision id is rejected as a dangling reference.
        if ref != "" and ref not in decisions and _looks_like_decision_id(ref):
            raise InvalidReferenceError(
                f"correction-opened references unknown decision: {ref!r}"
            )
    elif etype == "correction-resolved":
        target = event["target_correction_id"]
        if target not in corrections:
            raise InvalidReferenceError(
                f"correction-resolved references unknown correction: {target!r}"
            )
        if target in resolved:
            raise ReferenceCycleError(
                f"correction already resolved: {target!r}"
            )


def _looks_like_decision_id(value: str) -> bool:
    # Decision ids are uuid4 strings; task refs are arbitrary but rarely match
    # the 8-4-4-4-12 hex layout. This keeps the rejection narrow and avoids
    # false negatives on task ids like "T-12" or "task/nav".
    parts = value.split("-")
    if len(parts) != 5:
        return False
    sizes = (8, 4, 4, 4, 12)
    for part, size in zip(parts, sizes):
        if len(part) != size or not all(c in "0123456789abcdef" for c in part):
            return False
    return True


def _scope_affects(correction_scope: str, target_scope: str) -> bool:
    if correction_scope in GLOBAL_SCOPES:
        return True
    if correction_scope == target_scope:
        return True
    # Parent/child scoping along "/" boundaries.
    if target_scope.startswith(correction_scope + "/"):
        return True
    if correction_scope.startswith(target_scope + "/"):
        return True
    return False


# --------------------------------------------------------------------------- #
# Read / replay
# --------------------------------------------------------------------------- #


def load_events(
    project_root: str | os.PathLike[str],
    state_root: str = STATE_ROOT_DEFAULT,
) -> list[dict]:
    """Load and parse every event in order.

    An absent ledger is valid and returns ``[]``. A malformed or truncated line
    raises :class:`MalformedLedgerError` carrying the byte offset of the line;
    the file is never modified. Blank lines are skipped (standard JSONL).
    """
    path = ledger_path(project_root, state_root)
    if not path.exists():
        return []
    data = path.read_bytes()
    events: list[dict] = []
    offset = 0
    lines = data.split(b"\n")
    last_index = len(lines) - 1
    for index, chunk in enumerate(lines):
        line_start = offset
        offset += len(chunk) + 1
        if index == last_index and chunk == b"":
            continue  # trailing newline terminator
        if chunk.strip() == b"":
            continue  # blank line
        try:
            obj = json.loads(chunk.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise MalformedLedgerError(
                f"malformed ledger line at byte offset {line_start}: {exc}",
                byte_offset=line_start,
                line_no=index + 1,
            ) from exc
        if not isinstance(obj, dict) or "type" not in obj:
            raise MalformedLedgerError(
                f"ledger line at byte offset {line_start} is not a typed event",
                byte_offset=line_start,
                line_no=index + 1,
            )
        events.append(obj)
    return events


def replay_active(events: list[dict]) -> ActiveMemory:
    """Derive the active view by replaying events in append order."""
    state = _classify(events)
    status = state["status"]
    decisions = state["decisions"]
    corrections = state["corrections"]
    resolved = state["resolved"]

    active_decisions = [decisions[d] for d in decisions if status.get(d) == "active"]
    open_corrections = [
        corrections[c] for c in corrections if c not in resolved
    ]
    resolved_corrections = [
        corrections[c] for c in corrections if c in resolved
    ]
    return ActiveMemory(
        active_decisions=active_decisions,
        open_corrections=open_corrections,
        resolved_corrections=resolved_corrections,
        superseded_decision_ids={d for d in decisions if status.get(d) == "superseded"},
        voided_decision_ids={d for d in decisions if status.get(d) == "voided"},
    )


def is_completion_blocked(active: ActiveMemory, scope: str) -> bool:
    """True when an open correction affects ``scope``.

    Open corrections block accepted completion only in their affected scope;
    unrelated scopes proceed. A global-scope correction blocks every scope.
    """
    for correction in active.open_corrections:
        if _scope_affects(correction.get("scope", ""), scope):
            return True
    return False


# --------------------------------------------------------------------------- #
# Append
# --------------------------------------------------------------------------- #


def _append_raw(path: Path, event: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lock_path = path.with_name(path.name + ".lock")
    with open(lock_path, "w", encoding="utf-8") as lock_file:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        try:
            with open(path, "a", encoding="utf-8") as handle:
                handle.write(json.dumps(event, ensure_ascii=False) + "\n")
                handle.flush()
                os.fsync(handle.fileno())
        finally:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def append_event(
    project_root: str | os.PathLike[str],
    event: dict,
    state_root: str = STATE_ROOT_DEFAULT,
) -> dict:
    """Append a single immutable event, serializing writes through one lock.

    Returns the stored event. If an identical ``event_id`` is already present
    the call is a no-op and the existing event is returned (idempotent). If the
    same ``event_id`` carries differing content, :class:`DuplicateIdConflictError`
    is raised and the ledger is unchanged. Reference and cycle violations raise
    :class:`InvalidReferenceError` / :class:`ReferenceCycleError`.
    """
    _validate_shape(event)
    event_id = event.get("event_id") or uuid.uuid4().hex
    stored = dict(event)
    stored["event_id"] = event_id

    path = ledger_path(project_root, state_root)
    existing = load_events(project_root, state_root=state_root)  # raises if malformed

    for prior in existing:
        if prior.get("event_id") == event_id:
            if _canonical(prior) == _canonical(stored):
                return prior  # idempotent re-append
            raise DuplicateIdConflictError(
                f"event_id {event_id!r} already used with different content"
            )

    state = _classify(existing)
    _validate_references(stored, state)
    _append_raw(path, stored)
    return stored


# --------------------------------------------------------------------------- #
# Bounded retrieval
# --------------------------------------------------------------------------- #


def retrieve_active(
    project_root: str | os.PathLike[str],
    *,
    scope: str | None = None,
    retrieval_chars: int = DEFAULT_RETRIEVAL_CHARS,
    state_root: str = STATE_ROOT_DEFAULT,
) -> ActiveMemory:
    """Replay the ledger and return a bounded, scope-filtered active view.

    When ``scope`` is given, only decisions and open corrections whose scope
    affects it are included. The serialized ``text`` is bounded to
    ``retrieval_chars``; ``truncated`` reports when content was omitted and
    ``omitted_chars`` counts the dropped characters.
    """
    events = load_events(project_root, state_root=state_root)
    active = replay_active(events)

    if scope is not None:
        active.active_decisions = [
            d for d in active.active_decisions if _scope_affects(d.get("scope", ""), scope)
        ]
        active.open_corrections = [
            c
            for c in active.open_corrections
            if _scope_affects(c.get("scope", ""), scope)
        ]

    records = list(active.active_decisions) + list(active.open_corrections)
    text = "\n".join(
        json.dumps(r, ensure_ascii=False, sort_keys=True) for r in records
    )

    if retrieval_chars is not None and len(text) > retrieval_chars:
        active.truncated = True
        active.retrieved_chars = retrieval_chars
        active.omitted_chars = len(text) - retrieval_chars
        active.text = text[:retrieval_chars]
    else:
        active.truncated = False
        active.retrieved_chars = len(text)
        active.omitted_chars = 0
        active.text = text
    return active


# --------------------------------------------------------------------------- #
# Event builders (convenience; ids default to uuid4)
# --------------------------------------------------------------------------- #


def build_decision_recorded(
    *,
    decision_id: str | None = None,
    summary: str,
    rationale: str,
    project: str,
    scope: str,
    source_plan: str,
    source_revision: str,
    evidence: list[str] | None = None,
    event_id: str | None = None,
) -> dict:
    return {
        "event_id": event_id or uuid.uuid4().hex,
        "type": "decision-recorded",
        "decision_id": decision_id or uuid.uuid4().hex,
        "summary": summary,
        "rationale": rationale,
        "project": project,
        "scope": scope,
        "source_plan": source_plan,
        "source_revision": source_revision,
        "evidence": list(evidence or []),
    }


def build_decision_superseded(
    *,
    old_decision_id: str,
    new_decision_id: str,
    reason: str,
    event_id: str | None = None,
) -> dict:
    return {
        "event_id": event_id or uuid.uuid4().hex,
        "type": "decision-superseded",
        "old_decision_id": old_decision_id,
        "new_decision_id": new_decision_id,
        "reason": reason,
    }


def build_decision_voided(
    *,
    target_decision_id: str,
    reason: str,
    event_id: str | None = None,
) -> dict:
    return {
        "event_id": event_id or uuid.uuid4().hex,
        "type": "decision-voided",
        "target_decision_id": target_decision_id,
        "reason": reason,
    }


def build_correction_opened(
    *,
    decision_or_task_ref: str,
    scope: str,
    defect_evidence: list[str] | None = None,
    event_id: str | None = None,
) -> dict:
    return {
        "event_id": event_id or uuid.uuid4().hex,
        "type": "correction-opened",
        "decision_or_task_ref": decision_or_task_ref,
        "scope": scope,
        "defect_evidence": list(defect_evidence or []),
    }


def build_correction_resolved(
    *,
    target_correction_id: str,
    verified_fix_evidence: list[str] | None = None,
    event_id: str | None = None,
) -> dict:
    return {
        "event_id": event_id or uuid.uuid4().hex,
        "type": "correction-resolved",
        "target_correction_id": target_correction_id,
        "verified_fix_evidence": list(verified_fix_evidence or []),
    }


__all__ = [
    "STATE_ROOT_DEFAULT",
    "LEDGER_SUBDIR",
    "LEDGER_FILENAME",
    "DEFAULT_RETRIEVAL_CHARS",
    "EVENT_TYPES",
    "DecisionLedgerError",
    "MalformedLedgerError",
    "DuplicateIdConflictError",
    "InvalidReferenceError",
    "ReferenceCycleError",
    "ActiveMemory",
    "ledger_path",
    "load_events",
    "replay_active",
    "is_completion_blocked",
    "append_event",
    "retrieve_active",
    "build_decision_recorded",
    "build_decision_superseded",
    "build_decision_voided",
    "build_correction_opened",
    "build_correction_resolved",
]
