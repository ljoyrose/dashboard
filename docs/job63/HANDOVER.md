# JOB 6.3 handover

Branch claude/nice-allen-yo0v1t. Read-only page work; no DNS, registrar, Workspace, engine or sheet change.
Done: S0 to S4 (see RUN-PROGRESS.md). Left: S5 (full suite result, guard --range, PR left open for Lisa's merge card).
The page reads the private "Mail map" and "Mail switch" tabs only when they exist; until Lisa OKs them it says
"not set up yet". The engine does not need a new field: the page computes Mail map counts and hops itself.
DKIM "missing (google)" needs the engine's embedded copy of mail.js refreshed at its install (patch note in the slip).
Open questions are parked in the slip (DKIM custom selector, hop counting words, loop level).
