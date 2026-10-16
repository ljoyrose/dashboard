# E16-GATE handover
What exists: tools/gate/{gate.mjs,gates.unified.json,README.md}, tests/gate/gate.test.mjs, .github/workflows/gate.yml, npm scripts test:gate and gate.
What does not: any change to GATES.csv, GATE-LOG.csv or the framework. Those are master registers; proposals are in the Drive conflicts report.
To resolve one: set its status to RESOLVED in gates.unified.json and, if the ruling changes a verdict set or transition, edit that gate row. Run: node --test tests/gate/gate.test.mjs
Do not merge; Lisa decides. No Overskill action in this job.
16 Oct 2026 update: all 10 conflicts are RESOLVED (rulings DE62), so no transition reports WAITS-LISA from the shipped data any more; the WAITS-LISA path is kept and tested with a synthetic OPEN conflict. Leak is phased (LEAK:DESIGN at 5->6, LEAK:MONITOR and LEAK:POST at 7->8). Return has "required": false. Tests: node --test tests/gate/gate.test.mjs (70). Names fold spaces and underscores, so "Leak design" is Leak_design. Still do not merge; Lisa decides.
