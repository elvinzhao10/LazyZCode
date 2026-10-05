#!/usr/bin/env bash
# v133: status-dashboard MCP dashboard_service and copy_task_context tools.
# Drives the real server over the JSON-RPC stdin/stdout protocol from a temp
# fixture project: a start/status/stop round trip through the owned dashboard
# lifecycle, a context copy that validates the binding without consuming the
# command, and the validation/safety rejections for both tools.
set -euo pipefail

PLUGIN="$(cd "$(dirname "$0")/.." && pwd)"
export LAZYZCODE_MCP_MODE="${LAZYZCODE_MCP_MODE:-orchestrated}"
export PYTHONDONTWRITEBYTECODE=1
TMP="$(mktemp -d "${TMPDIR:-/tmp}/lazyzcode-dashboard-mcp.XXXXXX")"
PROJECT="$TMP/project"
SERVER="$PLUGIN/mcp/status-dashboard/server.sh"
NODE_BIN="$(command -v node)"
PASS=0
FAIL=0

cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

pass_case() { PASS=$((PASS + 1)); printf 'PASS: %s\n' "$1"; }
fail_case() { FAIL=$((FAIL + 1)); printf 'FAIL: %s\n' "$1" >&2; }

mkdir -p "$PROJECT"
GIT_ENV=(GIT_CONFIG_NOSYSTEM=1 "HOME=$TMP")
env "${GIT_ENV[@]}" git -C "$PROJECT" init -q
env "${GIT_ENV[@]}" git -C "$PROJECT" config user.name "ZCode Dashboard MCP QA"
env "${GIT_ENV[@]}" git -C "$PROJECT" config user.email "zcode@example.invalid"
printf '.lazyzcode/\n' > "$PROJECT/.gitignore"
env "${GIT_ENV[@]}" git -C "$PROJECT" add .gitignore >/dev/null
env "${GIT_ENV[@]}" git -C "$PROJECT" commit -qm fixture >/dev/null
CWD="$PROJECT" bash "$PLUGIN/scripts/state/create-run.sh" probe "ZCode dashboard MCP probe" >/dev/null
HEAD="$(env "${GIT_ENV[@]}" git -C "$PROJECT" rev-parse HEAD)"

python3 - "$PROJECT" "$HEAD" "$NODE_BIN" "$PLUGIN/shared/dashboard-host/test/workload.mjs" <<'PYFIX'
import hashlib, json, sys
from pathlib import Path

root, head, node, workload = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
run = Path(root) / ".lazyzcode/runs/probe"
digest = lambda text: hashlib.sha256(text.encode()).hexdigest()
plan = "# ZCode plan\n- [x] [C1] Original ZCode criterion\n"
adopted = "ZCode adopted edit"
artifact = str(run / "actual.txt")
commands = [[node, workload, "write", artifact, adopted], [node, workload, "verify", artifact, adopted]]
commands_bytes = f"{json.dumps(commands)}\n"
state_path = run / "state.json"
state = json.loads(state_path.read_text())
state["status"] = "active"
state["plan_reference"] = ".lazyzcode/runs/probe/plan.md"
state["plan_revision"] = 1
state["_approved_plan_sha256"] = digest(plan)
state["dashboard_project_id"] = "project:zcode"
state["tasks"] = [
    {"id": "P", "title": "ZCode dashboard parent", "status": "running", "depends_on": [], "execution_authority": {
        "repo_head": head, "criterion_ids": ["C1"], "plan_reference": state["plan_reference"], "plan_sha256": digest(plan),
        "plan_commands_path": ".lazyzcode/runs/probe/commands.json", "plan_commands_sha256": digest(commands_bytes)}},
    {"id": "A", "title": "ZCode dashboard child", "status": "queued", "depends_on": [], "criteria": [{"id": "C1", "task_id": "A",
        "version": 1, "requirement": "Original ZCode criterion", "applicability": "required", "verification": "unverified",
        "scenarios": [], "result_ids": [], "history": []}]},
]
(run / "checkpoints").mkdir(parents=True, exist_ok=True)
(run / "plan.md").write_text(plan)
(run / "checkpoints/plan-revision.md").write_text(plan)
(run / "commands.json").write_text(commands_bytes)
state_path.write_text(json.dumps(state))
PYFIX

request() {
    python3 - "$@" <<'PYREQ'
import json
import sys

identifier, name, arguments = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
print(json.dumps({"jsonrpc": "2.0", "id": json.loads(identifier), "method": "tools/call",
                  "params": {"name": name, "arguments": arguments}}))
PYREQ
}

: > "$TMP/session1.in"
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' >> "$TMP/session1.in"
printf '%s\n' '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' >> "$TMP/session1.in"
printf '%s\n' "$(request 3 dashboard_service '{"action":"start","project_id":"project:zcode","run_id":"probe"}')" >> "$TMP/session1.in"
printf '%s\n' "$(request 4 dashboard_service '{"action":"status","project_id":"project:zcode","run_id":"probe"}')" >> "$TMP/session1.in"
printf '%s\n' "$(request 5 dashboard_service '{"action":"stop","project_id":"project:zcode","run_id":"probe"}')" >> "$TMP/session1.in"
printf '%s\n' "$(request 6 dashboard_service '{"action":"status","project_id":"project:zcode","run_id":"probe"}')" >> "$TMP/session1.in"
printf '%s\n' "$(request 7 dashboard_service '{"action":"restart","project_id":"project:zcode","run_id":"probe"}')" >> "$TMP/session1.in"
printf '%s\n' "$(request 8 dashboard_service '{"action":"start","project_id":"project:zcode","run_id":"probe","port":0}')" >> "$TMP/session1.in"
printf '%s\n' "$(request 9 dashboard_service '{"action":"start","project_id":"project:zcode","run_id":"probe","port":70000}')" >> "$TMP/session1.in"
printf '%s\n' "$(request 10 dashboard_service '{"action":"start","project_id":"project:zcode","run_id":"probe","port":"10.5"}')" >> "$TMP/session1.in"
printf '%s\n' "$(request 11 dashboard_service '{"action":"start","run_id":"probe"}')" >> "$TMP/session1.in"
printf '%s\n' "$(request 12 dashboard_service '{"action":"start","project_id":"project:zcode","run_id":"../outside"}')" >> "$TMP/session1.in"

if CWD="$PROJECT" CLAUDE_PLUGIN_ROOT="$PLUGIN" bash "$SERVER" < "$TMP/session1.in" > "$TMP/session1.out" 2>"$TMP/session1.err"; then
    if python3 - "$TMP/session1.out" "$PROJECT" <<'PYJUDGE'
import hashlib, json, sys
from pathlib import Path

replies = [json.loads(line) for line in Path(sys.argv[1]).read_text().splitlines() if line]
project = Path(sys.argv[2])
assert len(replies) == 12, f"expected 12 replies, got {len(replies)}"
by_id = {reply["id"]: reply for reply in replies}
assert len(by_id) == 12, "duplicate reply ids"
assert by_id[1]["result"]["serverInfo"]["name"] == "status-dashboard", by_id[1]
print("PASS: initialize reports the status-dashboard server")
tools = {tool["name"]: tool for tool in by_id[2]["result"]["tools"]}
assert "dashboard_service" in tools and "copy_task_context" in tools, sorted(tools)
assert tools["dashboard_service"]["inputSchema"]["required"] == ["action", "project_id", "run_id"], tools["dashboard_service"]
assert tools["copy_task_context"]["inputSchema"]["required"] == [
    "project_id", "run_id", "parent_task_id", "task_id", "criterion_id",
    "attempt_id", "worker_id", "plan_commands_file", "command_index"], tools["copy_task_context"]
print("PASS: tools/list declares dashboard_service and copy_task_context with required bindings")

def payload(identifier):
    reply = by_id[identifier]
    assert "error" not in reply and "result" in reply, reply
    result = reply["result"]
    assert result.get("isError", False) is False, reply
    block = result["content"][0]
    assert block["type"] == "text", reply
    return json.loads(block["text"])

def failure(identifier):
    reply = by_id[identifier]
    assert "result" not in reply and "error" in reply, reply
    return reply["error"]

started = payload(3)
assert started["status"] == "running" and started["entry"] == "browser", started
port = started["identity"]["port"]
assert isinstance(port, int) and 1 <= port <= 65535, started
assert started["url"] == f"http://127.0.0.1:{port}", started
assert started["identity"]["projectId"] == "project:zcode" and started["identity"]["runId"] == "probe", started
assert Path(started["credential_file"]).is_file(), started
print(f"PASS: dashboard_service start returns the owned browser entry on port {port}")
status = payload(4)
assert status["status"] == "running" and status["identity"]["port"] == port, status
print("PASS: dashboard_service status reports the same running identity")
stopped = payload(5)
assert stopped["status"] == "stopped" and stopped["cleanup"] == "verified-absent", stopped
assert stopped["port"] == port and stopped["pid"] == started["identity"]["pid"], stopped
assert payload(6)["status"] == "stopped", by_id[6]
directory = project / ".lazyzcode/dashboard" / hashlib.sha256(b"project:zcode\nprobe").hexdigest()
assert not (directory / "receipt.json").exists(), "receipt survived stop"
print("PASS: dashboard_service stop verifies the owned process is absent and removes the receipt")
assert failure(7) == {"code": -32602, "message": "invalid dashboard service action"}, by_id[7]
for identifier in (8, 9, 10):
    assert failure(identifier) == {"code": -32602, "message": "dashboard service port must be an integer from 1 to 65535"}, by_id[identifier]
assert failure(11) == {"code": -32602, "message": "dashboard_service requires action, project_id and run_id"}, by_id[11]
assert failure(12) == {"code": -32603, "message": "invalid or unsafe run_id"}, by_id[12]
print("PASS: dashboard_service rejects invalid action, out-of-range and non-integer ports, missing binding and unsafe run_id")
PYJUDGE
    then
        pass_case 'dashboard_service round trip and validation over the MCP protocol'
    else
        fail_case 'dashboard_service round trip and validation over the MCP protocol'
        cat "$TMP/session1.err" >&2 || true
    fi
else
    fail_case 'dashboard_service session exited nonzero'
    cat "$TMP/session1.err" >&2 || true
fi

cp "$PROJECT/.lazyzcode/runs/probe/state.json" "$TMP/state.before"
cp "$PROJECT/.lazyzcode/runs/probe/commands.json" "$TMP/commands.before"

CONTEXT_ARGS='{"project_id":"project:zcode","run_id":"probe","parent_task_id":"P","task_id":"A","criterion_id":"C1","attempt_id":"mcp:probe-context","worker_id":"mcp:status-dashboard","plan_commands_file":".lazyzcode/runs/probe/commands.json","command_index":0}'
: > "$TMP/session2.in"
printf '%s\n' "$(request 20 copy_task_context "$CONTEXT_ARGS")" >> "$TMP/session2.in"
printf '%s\n' "$(request 21 copy_task_context "$CONTEXT_ARGS")" >> "$TMP/session2.in"
printf '%s\n' "$(request 22 copy_task_context '{"project_id":"project:zcode","run_id":"probe","parent_task_id":"P","task_id":"A","criterion_id":"C1","worker_id":"mcp:status-dashboard","plan_commands_file":".lazyzcode/runs/probe/commands.json","command_index":0}')" >> "$TMP/session2.in"
printf '%s\n' "$(request 23 copy_task_context '{"project_id":"project:zcode","run_id":"../outside","parent_task_id":"P","task_id":"A","criterion_id":"C1","attempt_id":"mcp:probe-context","worker_id":"mcp:status-dashboard","plan_commands_file":".lazyzcode/runs/probe/commands.json","command_index":0}')" >> "$TMP/session2.in"
printf '%s\n' "$(request 24 copy_task_context '{"project_id":"project:zcode","run_id":"probe","parent_task_id":"P","task_id":"A","criterion_id":"C9","attempt_id":"mcp:probe-context","worker_id":"mcp:status-dashboard","plan_commands_file":".lazyzcode/runs/probe/commands.json","command_index":0}')" >> "$TMP/session2.in"

if CWD="$PROJECT" CLAUDE_PLUGIN_ROOT="$PLUGIN" bash "$SERVER" < "$TMP/session2.in" > "$TMP/session2.out" 2>"$TMP/session2.err"; then
    if python3 - "$TMP/session2.out" "$PROJECT" "$TMP/state.before" "$TMP/commands.before" <<'PYJUDGE'
import hashlib, json, sys
from pathlib import Path

replies = [json.loads(line) for line in Path(sys.argv[1]).read_text().splitlines() if line]
project, state_before, commands_before = Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4])
assert len(replies) == 5, f"expected 5 replies, got {len(replies)}"
by_id = {reply["id"]: reply for reply in replies}

def payload(identifier):
    reply = by_id[identifier]
    assert "error" not in reply and "result" in reply, reply
    block = reply["result"]["content"][0]
    assert block["type"] == "text", reply
    return block["text"]

first, repeat = payload(20), payload(21)
context = json.loads(first)
commands = json.loads((project / ".lazyzcode/runs/probe/commands.json").read_text())
assert context["schema_version"] == "lazyzcode.producer-context.v1", context
assert context["project_id"] == "project:zcode" and context["run_id"] == "probe", context
assert context["parent_task_id"] == "P" and context["task_id"] == "A" and context["criterion_id"] == "C1", context
assert context["criterion_version"] == 1 and context["plan_revision"] == 1, context
assert context["attempt_id"] == "mcp:probe-context" and context["worker_id"] == "mcp:status-dashboard", context
assert context["plan_commands_file"] == ".lazyzcode/runs/probe/commands.json", context
assert context["plan_commands_sha256"] == hashlib.sha256(
    (project / ".lazyzcode/runs/probe/commands.json").read_bytes()).hexdigest(), context
assert context["command_index"] == 0 and context["argv"] == commands[0], context
assert len(context["argv_sha256"]) == 64, context
print("PASS: copy_task_context returns the validated lazyzcode producer context JSON")
assert repeat == first, "repeated context copy is not deterministic"
state_path = project / ".lazyzcode/runs/probe/state.json"
assert state_path.read_bytes() == state_before.read_bytes(), "context copy mutated state.json"
assert (project / ".lazyzcode/runs/probe/commands.json").read_bytes() == commands_before.read_bytes(), "context copy mutated the plan commands"
state = json.loads(state_path.read_text())
assert state["plan_revision"] == 1, state
tasks = {task["id"]: task for task in state["tasks"]}
assert tasks["P"]["status"] == "running" and tasks["A"]["status"] == "queued", state
run_entries = {entry.name for entry in (project / ".lazyzcode/runs/probe").iterdir()}
assert "producer-work" not in run_entries and "completion-authority.json" not in run_entries, sorted(run_entries)
print("PASS: context copy consumes no revision and executes nothing")
assert by_id[22]["error"] == {"code": -32602, "message": "copy_task_context requires complete binding"}, by_id[22]
assert by_id[23]["error"] == {"code": -32603, "message": "invalid or unsafe run_id"}, by_id[23]
unknown = by_id[24]["error"]
assert unknown["code"] == -32603 and "producer context" in unknown["message"], unknown
print("PASS: copy_task_context rejects incomplete binding, unsafe run id and unknown criterion")
PYJUDGE
    then
        pass_case 'copy_task_context validated copy without consumption over the MCP protocol'
    else
        fail_case 'copy_task_context validated copy without consumption over the MCP protocol'
        cat "$TMP/session2.err" >&2 || true
    fi
else
    fail_case 'copy_task_context session exited nonzero'
    cat "$TMP/session2.err" >&2 || true
fi

printf 'Passed: %d\n' "$PASS"
printf 'Failed: %d\n' "$FAIL"
[ "$FAIL" -eq 0 ]
