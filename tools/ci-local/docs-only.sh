#!/usr/bin/env bash
set -u
event="${1:-${GITHUB_EVENT_NAME:-push}}"
ref="${2:-${GITHUB_REF:-}}"
browser=true
if [ "${REPO_PRIVATE:-false}" = true ] && { [ "$event" = push ] || [ "$event" = pull_request ] || [ "$event" = merge_group ]; }; then
  browser=false
elif [ "$event" = schedule ] && [ "${NIGHTLY_SKIP_IDLE:-false}" = true ]; then
  last=$(git log -1 --format=%ct HEAD 2>/dev/null || echo 0)
  now="${NOW_EPOCH:-$(date +%s)}"
  if [ "$last" -gt 0 ] && [ $((now - last)) -gt $((26 * 3600)) ]; then browser=false; fi
elif { [ "$event" = push ] && [ "$ref" != refs/heads/main ]; } || [ "$event" = pull_request ]; then
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

