"""Pytest tests for lazyzcode_adaptive_hosts.map_adaptive_decision_to_hosts.

Covers the single ZCode full-plugin host (skills + commands + agents),
orchestrator agent invocation for orchestrated/long-horizon modes, MCP server
resolution from capability classes, fallback degraded path, and invalid
decision error handling.
"""
import sys
from pathlib import Path

import pytest

TOOLING_DIR = Path(__file__).resolve().parent.parent / "tooling"
sys.path.insert(0, str(TOOLING_DIR))

from lazyzcode_adaptive_hosts import (  # noqa: E402
    ALL_MCP_SERVERS, CAPABILITY_TO_MCP, ZCODE_LOADS_SKILLS,
    HOOKS_FILE, ORCHESTRATION_MODES, ORCHESTRATOR_AGENT,
    map_adaptive_decision_to_hosts)
from lazyzcode_adaptive_detector import classify_adaptive_decision  # noqa: E402


def _decision_for_mode(mode):
    if mode == "direct":
        return classify_adaptive_decision("Fix typo", {})
    if mode == "assisted":
        return classify_adaptive_decision("Diagnose stale data",
                                          {"scope": "bounded", "file_count": 4})
    if mode == "planned":
        return classify_adaptive_decision("Add export feature",
                                          {"scope": "broad",
                                           "acceptance_criteria": "incomplete"})
    if mode == "orchestrated":
        return classify_adaptive_decision("Change auth logic",
                                          {"risk_signals": ["security"]})
    if mode == "long-horizon":
        return classify_adaptive_decision("Multi-session migration",
                                          {"session_scope": "multi-session"})
    raise ValueError(f"unknown mode: {mode}")


ALL_MODES = ["direct", "assisted", "planned", "orchestrated", "long-horizon"]


def test_constants_exposed():
    assert ZCODE_LOADS_SKILLS is True  # ZCode plugin.json declares "skills"
    assert ORCHESTRATOR_AGENT == "lazyzcode-orchestrator"
    assert set(ORCHESTRATION_MODES) == {"orchestrated", "long-horizon"}
    assert HOOKS_FILE == "hooks/hooks.json"
    assert "status-dashboard" in ALL_MCP_SERVERS


def test_returned_dict_has_two_routes():
    decision = _decision_for_mode("direct")
    hosts = map_adaptive_decision_to_hosts(decision)
    assert set(hosts.keys()) == {"zcode_full_plugin", "skills_mcp_only_fallback"}


@pytest.mark.parametrize("mode", ALL_MODES)
def test_zcode_full_plugin_is_not_degraded(mode):
    decision = _decision_for_mode(mode)
    hosts = map_adaptive_decision_to_hosts(decision)
    fp = hosts["zcode_full_plugin"]
    assert fp["host"] == "zcode"
    assert fp["degraded"] is False
    assert fp["route"] == "full-plugin"
    assert fp["host_readiness"] == "pending"


@pytest.mark.parametrize("mode", ALL_MODES)
def test_zcode_skills_match_workflows(mode):
    decision = _decision_for_mode(mode)
    hosts = map_adaptive_decision_to_hosts(decision)
    fp = hosts["zcode_full_plugin"]
    # ZCode loads skills through the plugin manifest (skills field present).
    expected = {
        "direct": [], "assisted": ["lazy-start-work"],
        "planned": ["lazy-ulw-plan", "lazy-start-work"],
        "orchestrated": ["lazy-ulw-plan", "lazy-start-work", "lazy-reviewer"],
        "long-horizon": ["lazy-ulw-plan", "lazy-start-work", "lazy-ulw-loop"],
    }
    assert fp["skills"] == expected[mode]


@pytest.mark.parametrize("mode", ALL_MODES)
def test_zcode_commands_match_workflows(mode):
    decision = _decision_for_mode(mode)
    hosts = map_adaptive_decision_to_hosts(decision)
    expected = {
        "direct": [], "assisted": ["lazy-start-work"],
        "planned": ["lazy-ulw-plan", "lazy-start-work"],
        "orchestrated": ["lazy-ulw-plan", "lazy-start-work", "lazy-reviewer"],
        "long-horizon": ["lazy-ulw-plan", "lazy-start-work", "lazy-ulw-loop"],
    }
    assert hosts["zcode_full_plugin"]["commands"] == expected[mode]


@pytest.mark.parametrize("mode", ALL_MODES)
def test_orchestrator_agent_only_for_orchestration_modes(mode):
    decision = _decision_for_mode(mode)
    hosts = map_adaptive_decision_to_hosts(decision)
    fp_agents = hosts["zcode_full_plugin"]["agents"]
    if mode in ORCHESTRATION_MODES:
        assert fp_agents == [ORCHESTRATOR_AGENT]
    else:
        assert fp_agents == []


@pytest.mark.parametrize("mode", ALL_MODES)
def test_full_plugin_route_loads_hooks(mode):
    decision = _decision_for_mode(mode)
    hosts = map_adaptive_decision_to_hosts(decision)
    assert hosts["zcode_full_plugin"]["hooks"] == [HOOKS_FILE]


@pytest.mark.parametrize("mode", ALL_MODES)
def test_fallback_is_explicitly_degraded(mode):
    decision = _decision_for_mode(mode)
    hosts = map_adaptive_decision_to_hosts(decision)
    fb = hosts["skills_mcp_only_fallback"]
    assert fb["degraded"] is True
    assert fb["route"] == "fallback-degraded"
    assert fb["host"] == "skills-mcp-only"
    assert fb["host_readiness"] == "pending"
    assert "degraded_reason" in fb
    assert isinstance(fb["degraded_reason"], str)
    assert len(fb["degraded_reason"]) > 0


@pytest.mark.parametrize("mode", ALL_MODES)
def test_fallback_has_no_commands_agents_hooks(mode):
    decision = _decision_for_mode(mode)
    hosts = map_adaptive_decision_to_hosts(decision)
    fb = hosts["skills_mcp_only_fallback"]
    assert fb["commands"] == []
    assert fb["agents"] == []
    assert fb["hooks"] == []
    assert fb["orchestration_surface"] == "none"


@pytest.mark.parametrize("mode", ALL_MODES)
def test_fallback_skills_match_workflows(mode):
    decision = _decision_for_mode(mode)
    hosts = map_adaptive_decision_to_hosts(decision)
    fb = hosts["skills_mcp_only_fallback"]
    expected = {
        "direct": [], "assisted": ["lazy-start-work"],
        "planned": ["lazy-ulw-plan", "lazy-start-work"],
        "orchestrated": ["lazy-ulw-plan", "lazy-start-work", "lazy-reviewer"],
        "long-horizon": ["lazy-ulw-plan", "lazy-start-work", "lazy-ulw-loop"],
    }
    assert fb["skills"] == expected[mode]


@pytest.mark.parametrize("mode", ALL_MODES)
def test_status_dashboard_always_in_mcp_servers(mode):
    decision = _decision_for_mode(mode)
    hosts = map_adaptive_decision_to_hosts(decision)
    assert "status-dashboard" in hosts["zcode_full_plugin"]["mcp_servers"]
    assert "status-dashboard" in hosts["skills_mcp_only_fallback"]["mcp_servers"]


@pytest.mark.parametrize("mode", ALL_MODES)
def test_core_mcp_servers_are_direct_in_every_mode(mode):
    decision = _decision_for_mode(mode)

    hosts = map_adaptive_decision_to_hosts(decision)

    expected_core = ["run-ledger", "verification", "status-dashboard"]
    assert hosts["zcode_full_plugin"]["mcp_servers"][:3] == expected_core
    assert hosts["skills_mcp_only_fallback"]["mcp_servers"][:3] == expected_core


@pytest.mark.parametrize(
    ("mode", "expected"),
    [
        ("direct", ["run-ledger", "verification", "status-dashboard"]),
        ("assisted", ["run-ledger", "verification", "status-dashboard", "context-graph", "code-intel"]),
        ("planned", ["run-ledger", "verification", "status-dashboard", "context-graph", "docs"]),
        ("orchestrated", list(ALL_MCP_SERVERS)),
        ("long-horizon", list(ALL_MCP_SERVERS)),
    ],
)
def test_mode_selects_exact_mcp_profile(mode, expected):
    decision = _decision_for_mode(mode)

    hosts = map_adaptive_decision_to_hosts(decision)

    assert hosts["zcode_full_plugin"]["mcp_servers"] == expected


def test_capability_to_mcp_map_covers_all_caps():
    expected_caps = {"text-search", "structural-search", "semantic-navigation",
                     "architecture-context", "documentation", "execution",
                     "task-state", "outcome-verification"}
    assert set(CAPABILITY_TO_MCP.keys()) == expected_caps


def test_invalid_decision_unknown_mode_raises():
    with pytest.raises(ValueError) as excinfo:
        map_adaptive_decision_to_hosts({"mode": "unknown"})
    assert "ADAPTIVE_HOSTS_INVALID_DECISION: unknown" in str(excinfo.value)


def test_invalid_decision_null_raises():
    with pytest.raises(ValueError) as excinfo:
        map_adaptive_decision_to_hosts(None)
    assert "ADAPTIVE_HOSTS_INVALID_DECISION: missing" in str(excinfo.value)


def test_invalid_decision_missing_mode_raises():
    with pytest.raises(ValueError) as excinfo:
        map_adaptive_decision_to_hosts({})
    assert "ADAPTIVE_HOSTS_INVALID_DECISION: missing" in str(excinfo.value)


def test_zcode_maps_workflow_surface_to_skills_and_commands():
    """ZCode maps the canonical workflow surface to its own resource types.

    The single ZCode full-plugin host loads the same workflow names as both
    commands and skills (the plugin manifest declares both surfaces), while
    the degraded fallback loads the skills only.
    """
    decision = _decision_for_mode("planned")
    hosts = map_adaptive_decision_to_hosts(decision)
    fp = hosts["zcode_full_plugin"]
    assert fp["commands"] == ["lazy-ulw-plan", "lazy-start-work"]
    assert fp["skills"] == ["lazy-ulw-plan", "lazy-start-work"]
    assert hosts["skills_mcp_only_fallback"]["skills"] == ["lazy-ulw-plan", "lazy-start-work"]
