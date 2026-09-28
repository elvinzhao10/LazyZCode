#!/usr/bin/env bash
# pre-tool-use.sh — ZCode PreToolUse hook: block dangerous operations.
# Applies LazyZCode's host-neutral deny policy to Write/Edit/Bash.
#
# ZCode output contract: to DENY, exit with code 2 and print the reason to
# stderr; otherwise exit 0 and print NOTHING on stdout (any stdout is parsed
# as strict JSON, so diagnostics must go to stderr).
set -uo pipefail

# --- Read event JSON from stdin defensively (cap input at 1 MiB) ---
INPUT=$(head -c 1048576 || true)
TOOL_NAME=$(printf '%s' "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || echo "")
TOOL_INPUT=$(printf '%s' "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('tool_input',{})))" 2>/dev/null || echo "{}")

deny() {
    echo "LazyZCode policy denial: $1" >&2
    exit 2
}

# Enforce role-scoped writes when the host supplies agent identity.
ROLE_WRITE_DENIED=$(printf '%s' "$INPUT" | python3 -c '
import json, os, sys
try:
    event = json.load(sys.stdin)
except (ValueError, TypeError):
    raise SystemExit(0)
roles = {event.get(key) for key in ("agent_type", "agent_type_name", "agent_name", "subagent_type") if isinstance(event.get(key), str)}
role = "lazyzcode-verifier" if "lazyzcode-verifier" in roles else "lazyzcode-orchestrator" if "lazyzcode-orchestrator" in roles else ""
tool = event.get("tool_name")
if tool not in ("Write", "Edit") or role not in ("lazyzcode-orchestrator", "lazyzcode-verifier"):
    raise SystemExit(0)
tool_input = event.get("tool_input")
if not isinstance(tool_input, dict):
    print("deny")
    raise SystemExit(0)
path = next((tool_input.get(key) for key in ("file_path", "path", "filePath") if isinstance(tool_input.get(key), str)), "")
cwd = event.get("cwd") if isinstance(event.get("cwd"), str) else os.getcwd()
root = os.path.realpath(os.path.join(cwd, ".lazyzcode"))
target = os.path.realpath(os.path.join(cwd, path)) if path else ""
inside = target.startswith(root + os.sep)
if os.path.islink(os.path.join(cwd, ".lazyzcode")):
    print("deny")
    raise SystemExit(0)
if role == "lazyzcode-orchestrator":
    relative = os.path.relpath(target, root).split(os.sep) if inside else []
    verifier_report = len(relative) == 4 and relative[0] == "runs" and relative[2] == "evidence" and relative[3].endswith(".verification.md")
    allowed = inside and not verifier_report
else:
    relative = os.path.relpath(target, root).split(os.sep) if inside else []
    allowed = tool == "Write" and len(relative) == 4 and relative[0] == "runs" and relative[2] == "evidence" and relative[3].endswith(".verification.md")
    if allowed:
        active_runs = []
        try:
            for entry in os.scandir(os.path.join(root, "runs")):
                state_path = os.path.join(entry.path, "state.json")
                if not entry.is_dir(follow_symlinks=False) or os.path.islink(state_path):
                    continue
                try:
                    with open(state_path, encoding="utf-8") as state_file:
                        status = json.load(state_file).get("status")
                except (OSError, ValueError, TypeError, AttributeError):
                    continue
                if status in ("active", "paused", "created", "planning", "executing", "blocked", "verifying", "reviewing"):
                    active_runs.append(entry.name)
        except OSError:
            pass
        allowed = active_runs == [relative[1]] and (not isinstance(event.get("run_id"), str) or event["run_id"] == relative[1])
if not allowed:
    print("deny")
' 2>/dev/null || true)
if [ -n "$ROLE_WRITE_DENIED" ]; then
    deny "Agent write is outside its permitted run-state or verification-report path."
fi

# --- DENY: Secret-like paths ---
SECRET_PATTERNS=(
    '.env' '.env.local' '.env.production' '.env.staging'
    'credentials.json' 'service-account.json' 'private.key' 'id_rsa'
    '.aws/credentials' '.ssh/id_' '.netrc' '.npmrc'
    'secrets.yml' 'secrets.yaml' 'config/secrets'
)

if [ "$TOOL_NAME" = "Write" ] || [ "$TOOL_NAME" = "Edit" ]; then
    STRUCTURED_SECRET_PATTERN=$(printf '%s' "$INPUT" | python3 -c '
import json
import sys

try:
    event = json.load(sys.stdin)
    tool_input = event.get("tool_input")
except (json.JSONDecodeError, AttributeError):
    tool_input = None

if not isinstance(tool_input, dict):
    raise SystemExit(0)

patterns = (
    ".env", ".env.local", ".env.production", ".env.staging",
    "credentials.json", "service-account.json", "private.key", "id_rsa",
    ".aws/credentials", ".ssh/id_", ".netrc", ".npmrc",
    "secrets.yml", "secrets.yaml", "config/secrets",
)

def components(path):
    normalized = []
    for component in path.replace("\\", "/").split("/"):
        if not component or component == ".":
            continue
        if component == "..":
            if normalized:
                normalized.pop()
            continue
        normalized.append(component)
    return normalized

def matches(path_components, pattern):
    pattern_components = pattern.split("/")
    limit = len(path_components) - len(pattern_components) + 1
    for start in range(max(limit, 0)):
        candidate = path_components[start:start + len(pattern_components)]
        if all(
            actual.startswith(expected) if expected == "id_" else actual == expected
            for actual, expected in zip(candidate, pattern_components)
        ):
            return True
    return False

for field in ("path", "file_path", "filePath", "filename", "fileName"):
    value = tool_input.get(field)
    if not isinstance(value, str):
        continue
    path_components = components(value)
    for pattern in patterns:
        if matches(path_components, pattern):
            print(pattern)
            raise SystemExit(0)
' 2>/dev/null || true)
    if [ -n "$STRUCTURED_SECRET_PATTERN" ]; then
        deny "Access to secret-like path blocked: $STRUCTURED_SECRET_PATTERN. LazyZCode secret policy denies this operation."
    fi
else
    for pattern in "${SECRET_PATTERNS[@]}"; do
        if printf '%s' "$TOOL_INPUT" | grep -qF "$pattern"; then
            deny "Access to secret-like path blocked: $pattern. LazyZCode secret policy denies this operation."
        fi
    done
fi

# --- DENY: Destructive deletes ---
if [ "$TOOL_NAME" = "Bash" ]; then
    DESTRUCTIVE_DELETE=$(printf '%s' "$INPUT" | python3 -c '
import json
import shlex
import sys

try:
    event = json.load(sys.stdin)
    tool_input = event.get("tool_input")
    command = tool_input.get("command") if isinstance(tool_input, dict) else None
except (json.JSONDecodeError, AttributeError):
    command = None

if not isinstance(command, str):
    raise SystemExit(0)

try:
    lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|")
    lexer.whitespace_split = True
    lexer.commenters = ""
    tokens = list(lexer)
except ValueError:
    # An unparseable shell literal cannot be proven safe at this policy boundary.
    print("deny")
    raise SystemExit(0)

def dangerous_operand(token):
    # shlex has already removed shell quotes, but deliberately leaves variable
    # and tilde expansion text intact for this literal-only policy.
    return (
        token.startswith("/")
        or token == "~"
        or token.startswith("~/")
        or token == "$HOME"
        or token.startswith("$HOME/")
        or token == "${HOME}"
        or token.startswith("${HOME}/")
        or ".." in token.replace("\\", "/").split("/")
    )

for start, token in enumerate(tokens):
    if token != "rm":
        continue

    recursive = False
    options = True
    for operand in tokens[start + 1:]:
        if operand and all(char in ";&|" for char in operand):
            break
        if options and operand == "--":
            options = False
            continue
        if options and operand.startswith("-") and operand != "-":
            if operand == "--recursive" or (not operand.startswith("--") and ("r" in operand[1:] or "R" in operand[1:])):
                recursive = True
            continue
        options = False
        if recursive and dangerous_operand(operand):
            print("deny")
            raise SystemExit(0)
' 2>/dev/null || true)
    if [ -n "$DESTRUCTIVE_DELETE" ]; then
        deny "Destructive recursive delete denied. LazyZCode policy requires explicit confirmation."
    fi
fi

# --- DENY: Force push / hard reset ---
if printf '%s' "$TOOL_INPUT" | grep -qE 'git\s+push\s+--force|git\s+reset\s+--hard'; then
    deny "Destructive git operation denied. LazyZCode policy requires explicit user confirmation."
fi

# --- DENY: Publishing / deployment (unapproved network writes) ---
if printf '%s' "$TOOL_INPUT" | grep -qE 'npm\s+publish|pip\s+upload|docker\s+push'; then
    deny "External publish operation denied. LazyZCode policy requires approval."
fi

# --- Allow: safe operations pass through silently ---
exit 0
