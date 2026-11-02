#!/usr/bin/env bash
# Prints browser=true or browser=false (and appends it to $GITHUB_OUTPUT when set).
# browser=false only when EVERY file this branch changes against main is documentation:
# under docs/, or a .md file that is not TESTS.md and not under .github/ or tests/ (the suite reads those).
# The whole branch is compared, not just the last push, so a docs-only commit on top of a red code commit still runs everything.
# main, schedules and hand-started runs always say browser=true. No network, no secrets.
# PRIVATE repo (REPO_PRIVATE=true): pushes say browser=false, so the browser suite costs Actions minutes only on
# the weekly schedule or a hand-started run. Before a PR, run the suite on the Mac and paste the result (Lisa, 2 Nov 2026).
# Usage: bash tools/ci-local/docs-only.sh [event] [ref]   (defaults: GITHUB_EVENT_NAME, GITHUB_REF)
set -u
event="${1:-${GITHUB_EVENT_NAME:-push}}"
ref="${2:-${GITHUB_REF:-}}"
browser=true
if [ "${REPO_PRIVATE:-false}" = true ] && { [ "$event" = push ] || [ "$event" = pull_request ]; }; then
  browser=false
elif [ "$event" = push ] && [ "$ref" != refs/heads/main ]; then
  base=$(git merge-base origin/main HEAD 2>/dev/null || true)
  if [ -n "$base" ]; then
    files=$(git diff --name-only "$base" HEAD)
    code=$(printf '%s\n' "$files" | grep -v '^$' | grep -Ev '^docs/' | grep -Ev '\.md$' || true)
    read_by_tests=$(printf '%s\n' "$files" | grep -E '^(TESTS\.md|\.github/|tests/)' || true)
    if [ -n "$files" ] && [ -z "$code" ] && [ -z "$read_by_tests" ]; then browser=false; fi
  fi
fi
echo "browser=$browser"
if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "browser=$browser" >> "$GITHUB_OUTPUT"; fi
