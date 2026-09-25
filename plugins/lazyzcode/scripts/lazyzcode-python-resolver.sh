# lazyzcode-python-resolver.sh — canonical Python interpreter resolution.
#
# Source this file, then use "$LAZYZCODE_PYTHON_RESOLVED". Consumers that must
# stay self-contained (lazyzcode-verify.sh, lazyzcode-plugin-doctor.sh) keep
# their own inline copy of the same candidate list — keep the lists in sync.
#
# Resolution order:
#   1. LAZYZCODE_PYTHON (explicit override)
#   2. python3 when it is 3.10+
#   3. python3.13 / python3.12 / python3.11 / python3.10
# Resolves to the empty string when no candidate meets the 3.10 floor.

if [ -n "${LAZYZCODE_PYTHON:-}" ]; then
    LAZYZCODE_PYTHON_RESOLVED="$LAZYZCODE_PYTHON"
else
    LAZYZCODE_PYTHON_RESOLVED=""
    _lz_pv="$(command -v python3 >/dev/null 2>&1 && python3 -c 'import sys; print("%d%02d" % sys.version_info[:2])' 2>/dev/null || true)"
    if [ -n "$_lz_pv" ] && [ "$_lz_pv" -ge 310 ]; then
        LAZYZCODE_PYTHON_RESOLVED="python3"
    else
        for _lz_cand in python3.13 python3.12 python3.11 python3.10; do
            command -v "$_lz_cand" >/dev/null 2>&1 || continue
            _lz_cv="$("$_lz_cand" -c 'import sys; print("%d%02d" % sys.version_info[:2])' 2>/dev/null || true)"
            if [ -n "$_lz_cv" ] && [ "$_lz_cv" -ge 310 ]; then
                LAZYZCODE_PYTHON_RESOLVED="$_lz_cand"
                break
            fi
        done
    fi
    unset _lz_pv _lz_cand _lz_cv
fi
