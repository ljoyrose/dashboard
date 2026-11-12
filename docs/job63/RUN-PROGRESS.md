# JOB 6.3 Web Estate DNS & Email section: run progress

| Stage | State | What |
|---|---|---|
| S0 read estate/ | done | 2.2, 2.3, 2.4 (two records, syntax, lookups) and 2.7 already covered in mail.js / alerts.js |
| S1 pure checks | done | mail.js 1.2.0: DKIM "missing (google)", WebWave MX, no MX tied to the Mail map, hops(), domainHops(), switchProgress(), domainCards() |
| S2 alerts | done | alerts.js: optional Mail map argument; loop red, unknown target and 3+ stops amber, no MX only with addresses |
| S3 #/mail view | next | estate/index.html under More |
| S4 header contracts | done in S1 | mailMapFromValues / mailSwitchFromValues fail closed; wiring into the page in S3 |
| S5 suite + guard + PR | todo | |

Tests: tests/estate/mail-phase2.test.js 19/19; all estate unit files pass.
