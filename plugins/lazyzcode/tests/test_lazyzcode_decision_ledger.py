from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import pytest

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
TOOLING_DIR = PLUGIN_ROOT / "tooling"
sys.path.insert(0, str(TOOLING_DIR))

from lazyzcode_decision_ledger import (  # noqa: E402
    ActiveMemory,
    DecisionLedgerError,
    DuplicateIdConflictError,
    InvalidReferenceError,
    MalformedLedgerError,
    ReferenceCycleError,
    append_event,
    build_correction_opened,
    build_correction_resolved,
    build_decision_recorded,
    build_decision_superseded,
    build_decision_voided,
    is_completion_blocked,
    ledger_path,
    load_events,
    replay_active,
    retrieve_active,
)


# --------------------------------------------------------------------------- #
# Fixtures
# --------------------------------------------------------------------------- #

# NOTE: pytest's built-in tmp_path reuses a persistent base directory. In a
# brokered sandbox that base may already exist across runs, and the sandbox
# denies mkdir on an existing path. A fresh tempfile.TemporaryDirectory yields
# a unique non-existing path every run, so writes are always permitted.


@pytest.fixture
def workdir():
    with tempfile.TemporaryDirectory(prefix="qd-") as directory:
        yield Path(directory)


def _project(workdir: Path) -> Path:
    project = workdir / "project"
    project.mkdir(parents=True, exist_ok=True)
    return project


def _record(project, **overrides):
    base = dict(
        decision_id="d-active",
        summary="use provider X",
        rationale="cheaper",
        project="lazyzcode",
        scope="billing",
        source_plan="plan-1",
        source_revision="rv1",
        evidence=["e1"],
    )
    base.update(overrides)
    return build_decision_recorded(**base)


# --------------------------------------------------------------------------- #
# Five event types
# --------------------------------------------------------------------------- #


def test_all_five_event_types_append_and_replay(workdir: Path) -> None:
    project = _project(workdir)
    d1 = append_event(project, build_decision_recorded(
        decision_id="d1", summary="s", rationale="r", project="p",
        scope="sc", source_plan="sp", source_revision="rv", evidence=["e"],
        event_id="ev-recorded",
    ))
    append_event(project, build_decision_recorded(
        decision_id="d2", summary="s", rationale="r", project="p",
        scope="sc", source_plan="sp", source_revision="rv", evidence=["e"],
        event_id="ev-recorded-2",
    ))
    sup = append_event(project, build_decision_superseded(
        old_decision_id="d1", new_decision_id="d2", reason="better",
        event_id="ev-superseded",
    ))
    void = append_event(project, build_decision_voided(
        target_decision_id="d2", reason="dropped", event_id="ev-voided",
    ))
    corr = append_event(project, build_correction_opened(
        decision_or_task_ref="d1", scope="sc", defect_evidence=["bug"],
        event_id="ev-correction-opened",
    ))
    res = append_event(project, build_correction_resolved(
        target_correction_id="ev-correction-opened",
        verified_fix_evidence=["fixed"], event_id="ev-correction-resolved",
    ))

    events = load_events(project)
    types = [e["type"] for e in events]
    # All five event types are present; the union of recorded + the three
    # terminal/correction events appears in append order.
    assert set(types) == {
        "decision-recorded",
        "decision-superseded",
        "decision-voided",
        "correction-opened",
        "correction-resolved",
    }
    assert types[0] == "decision-recorded"
    assert types[2] == "decision-superseded"
    assert types[3] == "decision-voided"
    assert types[4] == "correction-opened"
    assert types[5] == "correction-resolved"
    assert {e["event_id"] for e in events} == {
        "ev-recorded", "ev-recorded-2", "ev-superseded", "ev-voided",
        "ev-correction-opened", "ev-correction-resolved",
    }
    active = replay_active(events)
    # d1 superseded, d2 voided: no active decisions; correction resolved.
    assert active.active_decisions == []
    assert active.open_corrections == []
    assert active.superseded_decision_ids == {"d1"}
    assert active.voided_decision_ids == {"d2"}
    # builder ids are stable
    assert d1["decision_id"] == "d1"
    assert sup["new_decision_id"] == "d2"
    assert corr["event_id"] == "ev-correction-opened"
    assert res["target_correction_id"] == "ev-correction-opened"


# --------------------------------------------------------------------------- #
# Absent ledger = empty valid memory
# --------------------------------------------------------------------------- #


def test_absent_ledger_is_empty_valid_memory(workdir: Path) -> None:
    project = _project(workdir)
    assert load_events(project) == []
    active = retrieve_active(project)
    assert isinstance(active, ActiveMemory)
    assert active.active_decisions == []
    assert active.open_corrections == []
    assert active.truncated is False
    assert active.retrieved_chars == 0
    assert is_completion_blocked(active, "anything") is False
    # ledger file must not be created by a read
    assert not ledger_path(project).exists()


# --------------------------------------------------------------------------- #
# Malformed / truncated fail visibly + bytes preserved
# --------------------------------------------------------------------------- #


def test_leading_non_json_header_is_malformed_with_byte_offset(workdir: Path) -> None:
    project = _project(workdir)
    path = ledger_path(project)
    path.parent.mkdir(parents=True, exist_ok=True)
    original = b"# this is a header line\n"
    path.write_bytes(original)

    with pytest.raises(MalformedLedgerError) as exc:
        load_events(project)
    assert exc.value.byte_offset == 0
    assert exc.value.line_no == 1
    assert "byte offset" in str(exc.value)
    # bytes preserved: reader never rewrites
    assert path.read_bytes() == original


def test_truncated_tail_record_is_malformed_and_bytes_preserved(workdir: Path) -> None:
    project = _project(workdir)
    path = ledger_path(project)
    path.parent.mkdir(parents=True, exist_ok=True)
    good = (
        '{"event_id":"a","type":"decision-recorded","decision_id":"a",'
        '"summary":"s","rationale":"r","project":"p","scope":"sc",'
        '"source_plan":"sp","source_revision":"rv","evidence":[]}'
    )
    original = (good + "\n" + '{"event_id":"b","type":"decision-recorded"').encode("utf-8")
    path.write_bytes(original)

    with pytest.raises(MalformedLedgerError) as exc:
        load_events(project)
    assert exc.value.byte_offset == len(good) + 1
    assert exc.value.line_no == 2
    # the corrupt ledger is left intact; appending must also refuse, not heal it
    with pytest.raises(MalformedLedgerError):
        append_event(project, build_decision_recorded(
            decision_id="c", summary="s", rationale="r", project="p",
            scope="sc", source_plan="sp", source_revision="rv", evidence=[],
            event_id="ev-c",
        ))
    assert path.read_bytes() == original


# --------------------------------------------------------------------------- #
# Idempotent replay (same id + identical content)
# --------------------------------------------------------------------------- #


def test_identical_reappend_is_idempotent(workdir: Path) -> None:
    project = _project(workdir)
    event = build_decision_recorded(
        decision_id="d1", summary="s", rationale="r", project="p",
        scope="sc", source_plan="sp", source_revision="rv", evidence=["e"],
        event_id="dup-id",
    )
    first = append_event(project, event)
    second = append_event(project, dict(event))  # identical content, same id
    assert first["event_id"] == second["event_id"]
    # no duplicate event written
    assert len(load_events(project)) == 1


# --------------------------------------------------------------------------- #
# Same id + differing content rejected
# --------------------------------------------------------------------------- #


def test_same_id_differing_content_rejected(workdir: Path) -> None:
    project = _project(workdir)
    append_event(project, build_decision_recorded(
        decision_id="d1", summary="first", rationale="r", project="p",
        scope="sc", source_plan="sp", source_revision="rv", evidence=[],
        event_id="dup-id",
    ))
    with pytest.raises(DuplicateIdConflictError):
        append_event(project, build_decision_recorded(
            decision_id="d1", summary="second", rationale="r", project="p",
            scope="sc", source_plan="sp", source_revision="rv", evidence=[],
            event_id="dup-id",
        ))
    # ledger keeps only the original event, unchanged
    assert len(load_events(project)) == 1
    assert load_events(project)[0]["summary"] == "first"


# --------------------------------------------------------------------------- #
# Reference / cycle rejection (table-driven)
# --------------------------------------------------------------------------- #


def _seed_two_decisions(project: Path) -> None:
    append_event(project, build_decision_recorded(
        decision_id="d1", summary="s", rationale="r", project="p",
        scope="sc", source_plan="sp", source_revision="rv", evidence=[],
        event_id="ev-1",
    ))
    append_event(project, build_decision_recorded(
        decision_id="d2", summary="s", rationale="r", project="p",
        scope="sc", source_plan="sp", source_revision="rv", evidence=[],
        event_id="ev-2",
    ))


REFERENCE_CASES = [
    # (label, event_factory, expected_error)
    ("supersede unknown old", lambda: build_decision_superseded(
        old_decision_id="ghost", new_decision_id="d2", reason="r"), InvalidReferenceError),
    ("supersede self", lambda: build_decision_superseded(
        old_decision_id="d1", new_decision_id="d1", reason="r"), ReferenceCycleError),
    ("supersede already-superseded", lambda: build_decision_superseded(
        old_decision_id="d1", new_decision_id="d3", reason="r"), ReferenceCycleError),
    ("void unknown", lambda: build_decision_voided(
        target_decision_id="ghost", reason="r"), InvalidReferenceError),
    ("void already-voided", lambda: build_decision_voided(
        target_decision_id="d2", reason="r"), ReferenceCycleError),
    ("resolve unknown correction", lambda: build_correction_resolved(
        target_correction_id="ghost", verified_fix_evidence=["x"]), InvalidReferenceError),
    ("resolve already-resolved", lambda: build_correction_resolved(
        target_correction_id="cid", verified_fix_evidence=["x"]), ReferenceCycleError),
    ("correction references unknown decision", lambda: build_correction_opened(
        decision_or_task_ref="aaaaaaaa-bbbb-cccc-dddd-eeeeffff0000",
        scope="sc", defect_evidence=["x"]), InvalidReferenceError),
]


@pytest.mark.parametrize(
    ("label", "factory", "expected_error"),
    REFERENCE_CASES,
    ids=[c[0] for c in REFERENCE_CASES],
)
def test_reference_and_cycle_rejection(
    workdir: Path,
    label: str,
    factory,
    expected_error: type[DecisionLedgerError],
) -> None:
    project = _project(workdir)
    # Seed d1, d2, then supersede d1->d3 and void d2 so "already" cases apply,
    # and open+resolve a correction cid so "already-resolved" applies.
    _seed_two_decisions(project)
    append_event(project, build_decision_recorded(
        decision_id="d3", summary="s", rationale="r", project="p",
        scope="sc", source_plan="sp", source_revision="rv", evidence=[],
        event_id="ev-3"))
    append_event(project, build_decision_superseded(
        old_decision_id="d1", new_decision_id="d3", reason="r", event_id="seeded-sup"))
    append_event(project, build_decision_voided(
        target_decision_id="d2", reason="r", event_id="seeded-void"))
    append_event(project, build_correction_opened(
        decision_or_task_ref="d3", scope="sc", defect_evidence=["x"], event_id="cid"))
    append_event(project, build_correction_resolved(
        target_correction_id="cid", verified_fix_evidence=["x"], event_id="seeded-res"))

    before = ledger_path(project).read_bytes()
    with pytest.raises(expected_error):
        append_event(project, factory())
    # rejection must not mutate the ledger
    assert ledger_path(project).read_bytes() == before


def test_correction_opened_accepts_external_task_ref(workdir: Path) -> None:
    project = _project(workdir)
    # A task ref that is not a uuid-shaped decision id is accepted.
    event = append_event(project, build_correction_opened(
        decision_or_task_ref="T-12", scope="sc", defect_evidence=["x"],
        event_id="task-corr"))
    assert event["decision_or_task_ref"] == "T-12"
    assert len(load_events(project)) == 1


# --------------------------------------------------------------------------- #
# Active view
# --------------------------------------------------------------------------- #


def test_active_view_reflects_supersession_and_void(workdir: Path) -> None:
    project = _project(workdir)
    append_event(project, build_decision_recorded(
        decision_id="d1", summary="old", rationale="r", project="p",
        scope="sc", source_plan="sp", source_revision="rv", evidence=[],
        event_id="e1"))
    append_event(project, build_decision_recorded(
        decision_id="d2", summary="new", rationale="r", project="p",
        scope="sc", source_plan="sp", source_revision="rv", evidence=[],
        event_id="e2"))
    append_event(project, build_decision_superseded(
        old_decision_id="d1", new_decision_id="d2", reason="better", event_id="se"))
    append_event(project, build_decision_voided(
        target_decision_id="d2", reason="dropped", event_id="ve"))

    active = replay_active(load_events(project))
    assert active.active_decisions == []
    assert active.superseded_decision_ids == {"d1"}
    assert active.voided_decision_ids == {"d2"}


# --------------------------------------------------------------------------- #
# Correction scope isolation
# --------------------------------------------------------------------------- #


def _open_billing_correction(project: Path) -> None:
    append_event(project, build_decision_recorded(
        decision_id="d-bill", summary="s", rationale="r", project="p",
        scope="billing", source_plan="sp", source_revision="rv", evidence=[],
        event_id="e-bill"))
    append_event(project, build_decision_recorded(
        decision_id="d-nav", summary="s", rationale="r", project="p",
        scope="navigation", source_plan="sp", source_revision="rv", evidence=[],
        event_id="e-nav"))
    append_event(project, build_correction_opened(
        decision_or_task_ref="d-bill", scope="billing",
        defect_evidence=["leak"], event_id="c-bill"))


SCOPE_ISOLATION = [
    ("same scope blocked", "billing", True),
    ("child scope blocked", "billing/payments", True),
    ("parent scope blocked", "billing", True),
    ("unrelated scope free", "navigation", False),
    ("other scope free", "search", False),
]


@pytest.mark.parametrize(
    ("label", "scope", "blocked"),
    SCOPE_ISOLATION,
    ids=[c[0] for c in SCOPE_ISOLATION],
)
def test_correction_blocks_only_affected_scope(
    workdir: Path, label: str, scope: str, blocked: bool
) -> None:
    project = _project(workdir)
    _open_billing_correction(project)
    active = replay_active(load_events(project))
    assert is_completion_blocked(active, scope) is blocked


def test_global_scope_correction_blocks_everything(workdir: Path) -> None:
    project = _project(workdir)
    append_event(project, build_correction_opened(
        decision_or_task_ref="T-1", scope="global",
        defect_evidence=["x"], event_id="c-global"))
    active = replay_active(load_events(project))
    assert is_completion_blocked(active, "billing") is True
    assert is_completion_blocked(active, "navigation") is True


# --------------------------------------------------------------------------- #
# Bounded retrieval truncation
# --------------------------------------------------------------------------- #


def test_bounded_retrieval_reports_truncation(workdir: Path) -> None:
    project = _project(workdir)
    for i in range(40):
        append_event(project, build_decision_recorded(
            decision_id=f"d{i}", summary="x" * 60, rationale="r" * 60,
            project="p", scope="sc", source_plan="sp", source_revision="rv",
            evidence=["e" * 40], event_id=f"ev{i}"))

    active = retrieve_active(project, retrieval_chars=500)
    assert active.truncated is True
    assert active.retrieved_chars <= 500
    assert active.omitted_chars > 0
    # the bounded text never exceeds the budget
    assert len(active.text) <= 500


def test_unbounded_retrieval_is_not_truncated(workdir: Path) -> None:
    project = _project(workdir)
    for i in range(10):
        append_event(project, build_decision_recorded(
            decision_id=f"d{i}", summary="s", rationale="r", project="p",
            scope="sc", source_plan="sp", source_revision="rv", evidence=[],
            event_id=f"ev{i}"))
    active = retrieve_active(project, retrieval_chars=8000)
    assert active.truncated is False
    assert active.omitted_chars == 0
    assert len(active.active_decisions) == 10


def test_retrieval_scope_filter_excludes_other_scopes(workdir: Path) -> None:
    project = _project(workdir)
    append_event(project, build_decision_recorded(
        decision_id="db", summary="s", rationale="r", project="p",
        scope="billing", source_plan="sp", source_revision="rv", evidence=[],
        event_id="eb"))
    append_event(project, build_decision_recorded(
        decision_id="dn", summary="s", rationale="r", project="p",
        scope="navigation", source_plan="sp", source_revision="rv", evidence=[],
        event_id="en"))
    active = retrieve_active(project, scope="billing")
    assert [d["decision_id"] for d in active.active_decisions] == ["db"]


# --------------------------------------------------------------------------- #
# Real librarian integration: recall, correction, restart, supersession, migration
# --------------------------------------------------------------------------- #


def test_librarian_integration_recall_correction_restart_supersession(workdir: Path) -> None:
    project = _project(workdir)

    # Session 1: two decisions recorded.
    append_event(project, build_decision_recorded(
        decision_id="bill-x", summary="use provider X", rationale="cheaper",
        project="lazyzcode", scope="billing", source_plan="plan-1",
        source_revision="rv1", evidence=["quote-x"], event_id="r1"))
    append_event(project, build_decision_recorded(
        decision_id="nav-simple", summary="simple nav", rationale="kiss",
        project="lazyzcode", scope="navigation", source_plan="plan-1",
        source_revision="rv1", evidence=[], event_id="r2"))

    # "Restart": a fresh planner session replays the ledger and recalls the
    # supported decision without re-deriving it.
    recall = retrieve_active(project, scope="billing")
    assert [d["decision_id"] for d in recall.active_decisions] == ["bill-x"]

    # A defect is found in billing: open a correction. Unrelated navigation
    # work must keep proceeding.
    append_event(project, build_correction_opened(
        decision_or_task_ref="bill-x", scope="billing",
        defect_evidence=["overbilling bug"], event_id="c1"))
    active = replay_active(load_events(project))
    assert is_completion_blocked(active, "billing") is True
    assert is_completion_blocked(active, "navigation") is False

    # Verified fix: resolve the correction. Block lifts only in billing.
    append_event(project, build_correction_resolved(
        target_correction_id="c1", verified_fix_evidence=["tests green"],
        event_id="c1r"))
    active = replay_active(load_events(project))
    assert is_completion_blocked(active, "billing") is False

    # A better provider supersedes the original decision. The superseded
    # memory must NOT win retrieval; only the replacement is active. The new
    # decision is recorded first, then the old is superseded by it.
    append_event(project, build_decision_recorded(
        decision_id="bill-y", summary="use provider Y", rationale="audited",
        project="lazyzcode", scope="billing", source_plan="plan-1",
        source_revision="rv2", evidence=["quote-y"], event_id="r3"))
    append_event(project, build_decision_superseded(
        old_decision_id="bill-x", new_decision_id="bill-y",
        reason="provider Y cheaper + audited", event_id="s1"))

    billing = retrieve_active(project, scope="billing")
    assert [d["decision_id"] for d in billing.active_decisions] == ["bill-y"]
    assert all(d["decision_id"] != "bill-x" for d in billing.active_decisions)

    # navigation is untouched by the billing supersession
    nav = retrieve_active(project, scope="navigation")
    assert [d["decision_id"] for d in nav.active_decisions] == ["nav-simple"]

    # Migration property: a brand-new project with no ledger is valid and empty
    # (historical plan extraction produces candidates, never accepted decisions).
    fresh = workdir / "other"
    fresh.mkdir()
    assert retrieve_active(fresh).active_decisions == []
