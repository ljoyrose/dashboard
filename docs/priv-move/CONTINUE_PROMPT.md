# Continue prompt: JOB PRIV-MOVE 2 (Dashboard private move prep, part 2)

Paste the standing PRIV-MOVE job brief (same rules: public repo = code only, privacy guard before every commit, no merges,
no visibility switch, no history rewrite, slips to 00 AI Commons > CHANGES), then:

1. Read `docs/priv-move/HANDOVER.md` and `docs/priv-move/RUN-PROGRESS.md` on branch `claude/sweet-johnson-13bvh1`.
2. Check the two open PRs from part 1 are still green on their head commits. Do not merge them.
3. Build section A (CI minutes trim) on a new branch from main. Workflow PR: open, do not merge. Put the measured
   before/after minutes in the PR.
4. Build section B (A1 Dockerfile + disabled deploy workflow, A2 notes) on a new branch from main.
5. Page through the rest of the Drive search for the github.io address and add the rows to the link list on Drive.
6. Slips continue the numbering `AA_DASH-PRIVATE-MOVE_2026-11-12-2015_<NN>.md` from the last one in CHANGES.

To run the browser suite in a cloud session, use `bash tools/ci-local/run-all.sh` (it points Playwright at the installed
Chromium). A full mocked + phone run takes about 40 minutes on 4 workers; edit nothing under the repo while it runs.
