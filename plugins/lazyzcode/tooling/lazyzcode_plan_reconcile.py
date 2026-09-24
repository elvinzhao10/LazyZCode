#!/usr/bin/env python3
"""T4 — Reconcile human plan edits with execution authority (LazyZCode v1.3.0).

Mirrors the shared contract ``lazyseries-shared-semantics.v1.json``
reconciliation_semantics and the sibling implementations
(lazybuddy_plan_reconcile.py / plan-reconcile.js):

- cosmetic changes preserve all valid evidence;
- semantic changes invalidate ONLY the affected task and its transitive
  dependents;
- a human check is a completion assertion, never a verified result; an uncheck
  reopens the task;
- stale results (dispatched under an older plan revision) can never update a
  newer plan's state.
"""
from __future__ import annotations

import re
from typing import Final

TASK_TITLE_RE: Final = re.compile(r"^([A-Za-z]*\d+)\s*[:.]\s*(.+)$")
CHECKBOX_RE: Final = re.compile(r"^-\s+\[([ xX])\]\s+(.+)$")
SCOPE_KEYS: Final = ("acceptance", "qa", "verify", "commit", "depends_on", "decision")

COSMETIC = "cosmetic"
SEMANTIC = "semantic"
UNCHANGED = "unchanged"


def parse_tasks(text: str) -> dict[str, dict]:
    """Parse a plan into {task_id: {checked, title, scope_lines}} records.

    Mirrors the checkbox grammar of scripts/state/sync-plan-state.sh.
    """
    tasks: dict[str, dict] = {}
    fence = None
    section = None
    in_task_section = False
    current_id = None
    for line in text.splitlines():
        s = line.strip()
        marker = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
        if marker:
            token = marker.group(1)
            if fence is None:
                fence = token
            elif token[0] == fence[0] and len(token) >= len(fence) and s == token:
                fence = None
            continue
        if fence is not None:
            continue
        if s.startswith("## "):
            section = s[3:].strip()
            in_task_section = section in {"TODOs", "Todos", "Final Verification Wave"}
            current_id = None
            continue
        if not in_task_section:
            continue
        m = CHECKBOX_RE.match(line.rstrip())
        if m:
            checked = m.group(1).lower() == "x"
            title = m.group(2).strip()
            tid = TASK_TITLE_RE.match(title)
            current_id = tid.group(1) if tid else None
            if current_id:
                tasks[current_id] = {
                    "checked": checked,
                    "title": title,
                    "scope_lines": [],
                    "section": section,
                }
            continue
        if current_id and s.startswith("- "):
            key = s[2:].split(":", 1)[0].strip().lower()
            if key in SCOPE_KEYS:
                tasks[current_id]["scope_lines"].append(s)
        elif current_id and s and not s.startswith("#"):
            tasks[current_id]["scope_lines"].append(s)
    return tasks


def _dependents_closure(task_id: str, deps: dict[str, list[str]]) -> set[str]:
    result: set[str] = set()
    frontier = [task_id]
    while frontier:
        current = frontier.pop()
        for candidate, links in deps.items():
            if candidate in result:
                continue
            if current in links:
                result.add(candidate)
                frontier.append(candidate)
    return result


def _strip_flags(title: str) -> str:
    return re.sub(r"\((?:provisional|depends_on|parent_plan_id)\s*:.*?\)", "", title).strip()


def _extract_deps(tasks: dict[str, dict]) -> dict[str, list[str]]:
    deps: dict[str, list[str]] = {}
    for tid, record in tasks.items():
        links: list[str] = []
        m = re.search(r"depends_on\s*:\s*([^\),]+)", record["title"])
        if m:
            links += [t.strip().strip("[]") for t in m.group(1).split(",") if t.strip().strip("[]")]
        for line in record["scope_lines"]:
            lm = re.match(r"-?\s*depends_on\s*:\s*(.+)", line, re.I)
            if lm:
                links += [t.strip().strip("[]") for t in lm.group(1).split(",") if t.strip().strip("[]")]
        deps[tid] = links
    return deps


def classify_plan_edits(old_text: str, new_text: str) -> dict:
    """Classify the delta between two plan revisions (same contract as Buddy)."""
    old_tasks = parse_tasks(old_text)
    new_tasks = parse_tasks(new_text)

    added = [tid for tid in new_tasks if tid not in old_tasks]
    removed = [tid for tid in old_tasks if tid not in new_tasks]

    deps_new = _extract_deps(new_tasks)

    invalidations: list[dict] = []
    reopen: list[str] = []
    summary: list[str] = []
    semantic = False

    for tid in removed:
        semantic = True
        invalidations.append({"task": tid, "reason": "task removed; running work stops receiving dispatch and results cannot be accepted as current"})
        summary.append(f"removed task {tid}")
    for tid in added:
        semantic = True
        summary.append(f"added task {tid} (requires eligibility checks before dispatch)")

    for tid in sorted(set(old_tasks) & set(new_tasks)):
        old, new = old_tasks[tid], new_tasks[tid]
        if old["checked"] and not new["checked"]:
            reopen.append(tid)
            summary.append(f"human unchecked {tid}: reopened for reconciliation (a check is an assertion, never a verified result)")
        if not old["checked"] and new["checked"]:
            summary.append(f"human checked {tid}: assertion only — never counts as a verified result")
        if _strip_flags(old["title"]) != _strip_flags(new["title"]):
            semantic = True
            invalidations.append({"task": tid, "reason": "task title/deliverable changed"})
            summary.append(f"{tid}: task title/deliverable changed")
            continue
        if sorted(old["scope_lines"]) != sorted(new["scope_lines"]):
            semantic = True
            invalidations.append({"task": tid, "reason": "scope changed (acceptance/qa/verify/commit/depends_on/decision)"})
            summary.append(f"{tid}: scope changed")

    if invalidations:
        direct = {i["task"] for i in invalidations}
        closure: set[str] = set()
        for tid in direct:
            closure |= _dependents_closure(tid, deps_new)
        for tid in sorted(closure - direct):
            invalidations.append({"task": tid, "reason": "transitive dependent of a scope-changed task"})
            summary.append(f"{tid}: invalidated as transitive dependent")

    classification = UNCHANGED
    if semantic or invalidations:
        classification = SEMANTIC
    elif old_text.strip() != new_text.strip():
        classification = COSMETIC
        summary.append("cosmetic edit (whitespace/wording/reorder/check assertion) — evidence preserved")

    return {
        "classification": classification,
        "invalidations": invalidations,
        "reopen": sorted(reopen),
        "added": sorted(added),
        "removed": sorted(removed),
        "summary": summary,
    }


def accept_result(result: dict, current_plan_sha: str) -> tuple[bool, str]:
    """Stale-result guard: results from an older plan revision are refused."""
    result_sha = result.get("plan_sha256")
    if result_sha is None:
        return False, "result carries no plan_sha256; refusing to apply"
    if result_sha != current_plan_sha:
        return False, "stale result: dispatched under plan %s but current approved revision is %s" % (
            str(result_sha)[:12], str(current_plan_sha)[:12])
    return True, "ok"
