# JOB 6.3 Web Estate DNS & Email section: run progress

| Stage | State | What |
|---|---|---|
| S0 read estate/ | done | 2.2, 2.3, 2.4 (two records, syntax, lookups) and 2.7 were already covered in mail.js / alerts.js |
| S1 pure checks | done | mail.js 1.2.0: DKIM "missing (google)", WebWave MX, no MX tied to the Mail map, hops(), domainHops(), switchProgress(), domainCards() |
| S2 alerts | done | alerts.js: optional Mail map argument; loop red, unknown target and 3+ stops amber, no MX only with addresses |
| S3 #/mail view | done | estate/index.html: "DNS & Email" under More, #/mail?d=<domain> for one domain, back button returns |
| S4 header contracts | done | mailMapFromValues / mailSwitchFromValues fail closed; page shows the problem line and no rows |
| S5 suite + guard + PR | done | PR #494 open; CI tab-bar plan updated for the new More item |

Tests: tests/estate/mail-phase2.test.js 19/19; tests/mocked/estate-mail-section.spec.js 3/3; estate browser specs 23/23.
