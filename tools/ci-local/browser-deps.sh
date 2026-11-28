#!/usr/bin/env bash
# Installs the test browser's system libraries on a GitHub runner, without letting a third-party apt source fail the job.
# 27 Nov 2026: packages.microsoft.com answered 403 ("no longer signed"), so `playwright install-deps` exited 100. That failed
# the publish gate for #818 (it was merged but not published) and skipped a live check. That source is not needed
# for the browser's libraries, so it is removed first, and the install is tried twice.
#   bash tools/ci-local/browser-deps.sh deps      system libraries only (browser restored from the cache)
#   bash tools/ci-local/browser-deps.sh install   browser and system libraries (first time, or after a version change)
set -u
mode="${1:-deps}"
for f in /etc/apt/sources.list.d/*; do
  [ -f "$f" ] || continue
  if grep -q 'packages\.microsoft\.com' "$f" 2>/dev/null; then echo "Removing third-party apt source $f (not needed for the browser)"; sudo rm -f "$f"; fi
done
if [ "$mode" = install ]; then cmd=(npx playwright install --with-deps chromium); else cmd=(npx playwright install-deps chromium); fi
for attempt in 1 2; do
  "${cmd[@]}" && exit 0
  echo "::warning::${cmd[*]} failed (attempt $attempt of 2)"
  [ "$attempt" = 1 ] && sleep 20
done
echo "::error::Could not install the browser's system libraries after 2 attempts (see the apt errors above)."
exit 1
