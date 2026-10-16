# E16-GATE handover
What exists: tools/gate/{gate.mjs,gates.unified.json,README.md}, tests/gate/gate.test.mjs, .github/workflows/gate.yml, npm scripts test:gate and gate.
What does not: any change to GATES.csv, GATE-LOG.csv or the framework. Those are master registers; proposals are in the Drive conflicts report.
Open: 10 conflicts (C1-C10) in gates.unified.json. Four gates wait on them (BASE, SLOT, LEAK, RETURN), so transitions 2->3, 5->6, 7->8, rescue->slot report WAITS-LISA until Lisa rules.
To resolve one: set its status to RESOLVED in gates.unified.json and, if the ruling changes a verdict set or transition, edit that gate row. Run: node --test tests/gate/gate.test.mjs
Do not merge; Lisa decides. No Overskill action in this job.
