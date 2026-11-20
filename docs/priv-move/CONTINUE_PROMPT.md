# Continue prompt: Dashboard private move, after Lisa's choices

Paste the standing PRIV-MOVE job brief (public repo = code only, privacy guard before every commit, no merges, no
visibility switch, no history rewrite, slips to 00 AI Commons > CHANGES), then:

1. Read `docs/priv-move/HANDOVER.md` and `RUN-PROGRESS.md`. Check PRs 497, 729 and 730: merged, or still green on their heads.
2. Read Lisa's replies to the decision pack (HOST, CI, CONFIG, LOADER, OPEN, OWNER, PREVIEWS) in CHANGES.
3. Build only what those replies unlock: the private-repo CI cut (HANDOVER section A), then the "before any host switch"
   items (section B), then the later PRs (section C).
4. Slips continue the numbering `AA_DASH-PRIVATE-MOVE_2026-11-12-2015_<NN>.md` from the last one in CHANGES.

Browser suite in a cloud session: `bash tools/ci-local/run-all.sh`. A full run takes about 40 minutes on 4 workers; edit
nothing under the repo while it runs. Docker can be started in a cloud session with `dockerd` for container checks.
