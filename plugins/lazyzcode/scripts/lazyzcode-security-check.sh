#!/bin/bash
# lazyzcode-security-check.sh — Secret/credential leak scanner (v0.9)
#
# Scans plugin files for known secret patterns: API keys, private keys, bearer tokens.
# Outputs a JSON summary. Exit code 0 if no secrets found; exit code 1 if secrets detected.
#
# Usage: ./scripts/lazyzcode-security-check.sh
# Env:   CLAUDE_PLUGIN_ROOT (if installed), otherwise defaults to script-relative plugin root.

set -euo pipefail

if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
    PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
else
    PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fi

SECRETS_FOUND=false
MATCHES=""
FIRST=true

# Pattern definitions with labels
# sk-*: OpenAI/Anthropic-style API keys
# AIza*: Google API keys
# ghp_*: GitHub personal access tokens (classic)
# github_pat_*: GitHub fine-grained PATs
# xox[baprs]-*: Slack bot/user tokens
# BEGIN PRIVATE KEY / BEGIN RSA PRIVATE KEY: PEM private keys
# Bearer [A-Za-z0-9._~+/\\-=]{20,}: Bearer tokens
PATTERNS=(
    'sk-[A-Za-z0-9]{20,}'
    'AIza[0-9A-Za-z_-]{20,}'
    'ghp_[A-Za-z0-9]{20,}'
    'github_pat_[A-Za-z0-9]{20,}'
    'xox[baprs]-[A-Za-z0-9]{20,}'
    'BEGIN (RSA )?PRIVATE KEY'
    'Bearer [A-Za-z0-9._~+/\\-=]{20,}'
)

LABELS=(
    'sk-* (API key)'
    'AIza* (Google API key)'
    'ghp_* (GitHub classic PAT)'
    'github_pat_* (GitHub fine-grained PAT)'
    'xox*-* (Slack token)'
    'BEGIN PRIVATE KEY'
    'Bearer token'
)

# Allowlist of known-synthetic secret-shaped fixtures: "<relative-path> <label>".
# Matches whose plugin-root-relative path and label both appear here are
# reported in the "allowlisted" array and never fail the scan. Every other
# match fails closed. The allowlist exists so redaction tests may carry
# obviously fake tokens; it must never list production files.
ALLOWLIST_FILE="${PLUGIN_ROOT}/scripts/security-check-allowlist.txt"
ALLOWLISTED=""

is_allowlisted() {
    local relative_path="$1" label="$2"
    [ -f "$ALLOWLIST_FILE" ] || return 1
    while IFS= read -r entry; do
        case "$entry" in
            ''|'#'*) continue ;;
        esac
        if [ "$entry" = "${relative_path} ${label}" ]; then
            return 0
        fi
    done <"$ALLOWLIST_FILE"
    return 1
}

# Scan files in the plugin root, skipping .git and node_modules
while IFS= read -r -d '' file; do
    # Skip binary files by checking MIME type
    if file -b --mime-type "$file" | grep -qv '^text/'; then
        continue
    fi

    for i in "${!PATTERNS[@]}"; do
        pattern="${PATTERNS[$i]}"
        label="${LABELS[$i]}"
        while IFS= read -r line_num; do
            line_num_clean="${line_num%%:*}"
            match_content="${line_num#*:}"
            relative_path="${file#"${PLUGIN_ROOT}/"}"
            if is_allowlisted "$relative_path" "$label"; then
                escaped_file="${file//\\/\\\\}"
                escaped_file="${escaped_file//\"/\\\"}"
                ALLOWLIST_ENTRY="{\"file\":\"${escaped_file}\",\"line\":${line_num_clean},\"pattern\":\"${label//\"/\\\"}\"}"
                if [ -z "$ALLOWLISTED" ]; then
                    ALLOWLISTED="$ALLOWLIST_ENTRY"
                else
                    ALLOWLISTED="${ALLOWLISTED},${ALLOWLIST_ENTRY}"
                fi
                continue
            fi
            SECRETS_FOUND=true
            # Escape double quotes and backslashes for JSON
            escaped_file="${file//\\/\\\\}"
            escaped_file="${escaped_file//\"/\\\"}"
            escaped_content="${match_content//\\/\\\\}"
            escaped_content="${escaped_content//\"/\\\"}"
            esc_pattern="${label//\"/\\\"}"
            if [ "$FIRST" = true ]; then
                FIRST=false
            else
                MATCHES+=','
            fi
            MATCHES+="{\"file\":\"${escaped_file}\",\"line\":${line_num_clean},\"pattern\":\"${esc_pattern}\"}"
        done < <(grep -nE "$pattern" "$file" 2>/dev/null || true)
    done
done < <(find "${PLUGIN_ROOT}" -type f \
    -not -path '*/.git/*' \
    -not -path '*/node_modules/*' \
    -not -path '*/dist/*' \
    -not -path '*/build/*' \
    -not -path '*/lazyzcode-security-check.sh' \
    -print0)

echo "{\"secrets_found\":${SECRETS_FOUND},\"matches\":[${MATCHES}],\"allowlisted\":[${ALLOWLISTED}]}"

if [ "$SECRETS_FOUND" = true ]; then
    exit 1
else
    exit 0
fi
