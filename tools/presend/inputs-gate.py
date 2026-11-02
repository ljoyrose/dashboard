#!/usr/bin/env python3
"""inputs-gate: are the inputs a paid prompt depends on present and newer than the app's last change?
  python3 inputs-gate.py INPUTS-<APP>.json        exit 1 on any FAIL
  python3 inputs-gate.py --selftest
INPUTS-<APP>.json (kept with the data outside the repo; written by the inputs watcher routine from the builder platform, plus the dates read in the editor):
 {"app":"<app id> <name>","checked_at":"...Z",
  "app_updated_at":"...Z", "brief_file_mtime":"...Z",          <- the builder platform's app record
  "export_zip_at":"...Z", "export_zip_file":"...",              <- newest Export ZIP
  "custom_instructions_read_at":"...Z", "project_brief_read_at":"...Z",  <- read in the editor
  "chat_log_last_turn_at":"...Z", "prompt_file":"..."}
Rules (each FAIL blocks the send; 5 Oct 2026: inputs mandated as pre-prompt checks):
 I1 every input present
 I2 Export ZIP taken after the app's last change (app_updated_at)
 I3 Custom Instructions and Project Brief read after the brief file last changed (the platform rewrites it)
 I4 nothing older than 7 days
 I5 the simulation/prediction for the prompt is newer than every input (else re-simulate)
 I6 a value carried over from an older inputs file (listed in "carried") is never fresh: it FAILs until re-read (23 Oct 2026)"""
import json, sys
from datetime import datetime, timedelta, timezone
def t(s): return datetime.fromisoformat(s.replace('Z','+00:00')) if s else None
REQ=['app_updated_at','brief_file_mtime','export_zip_at','custom_instructions_read_at','project_brief_read_at','chat_log_last_turn_at']
def gate(m):
    out=[]
    for k in REQ:
        if not m.get(k): out.append(('I1',f'missing: {k}'))
    now=t(m.get('checked_at')) or datetime.now(timezone.utc)
    up=t(m.get('app_updated_at')); ex=t(m.get('export_zip_at'))
    if up and ex and ex<up: out.append(('I2',f'Export ZIP {m["export_zip_at"]} is older than the app\'s last change {m["app_updated_at"]}: take a new export'))
    bf=t(m.get('brief_file_mtime'))
    for k in ('custom_instructions_read_at','project_brief_read_at'):
        v=t(m.get(k))
        if bf and v and v<bf: out.append(('I3',f'{k} {m[k]} is older than the brief file change {m["brief_file_mtime"]}: re-read the settings in the editor'))
    for k in REQ:
        v=t(m.get(k))
        if v and k not in ('app_updated_at','brief_file_mtime','chat_log_last_turn_at') and now-v>timedelta(days=7): out.append(('I4',f'{k} older than 7 days'))
    sim=t(m.get('simulated_at'))
    if sim:
        newest=max([x for x in (t(m.get(k)) for k in REQ if k!='app_updated_at') if x],default=None)
        if newest and sim<newest: out.append(('I5',f'simulation {m["simulated_at"]} predates an input ({newest.isoformat()}): re-simulate'))
    else: out.append(('I5','no simulation recorded for this prompt'))
    for k in m.get('carried',[]): out.append(('I6',f'{k} is CARRIED from an older inputs file, not re-read'))
    return out
def report(path):
    m=json.load(open(path)); r=gate(m)
    print(f'== inputs-gate {m.get("app")} · {m.get("prompt_file","")}')
    for c,msg in r: print('  FAIL',c,msg)
    print(f'  RESULT: {len(r)} FAIL'); return len(r)
def selftest():
    good={"checked_at":"2026-10-05T12:00:00Z","app_updated_at":"2026-10-04T21:01:23Z","brief_file_mtime":"2026-10-04T20:51:45Z","export_zip_at":"2026-10-05T11:00:00Z","custom_instructions_read_at":"2026-10-05T11:05:00Z","project_brief_read_at":"2026-10-05T11:05:00Z","chat_log_last_turn_at":"2026-08-18T21:12:00Z","simulated_at":"2026-10-05T11:30:00Z"}
    bad=dict(good,export_zip_at="2026-10-04T18:27:00Z",project_brief_read_at="2026-10-03T12:00:00Z",simulated_at="2026-10-04T23:00:00Z")
    ok=not gate(good) and {'I2','I3','I5'}<= {c for c,_ in gate(bad)} and 'I6' in {c for c,_ in gate(dict(good,carried=['custom_instructions_read_at']))}
    print('selftest:', 'OK' if ok else f'FAILED good={gate(good)} bad={gate(bad)}'); return 0 if ok else 1
if __name__=='__main__':
    a=sys.argv[1:]
    if not a: print(__doc__); sys.exit(2)
    sys.exit(selftest() if a[0]=='--selftest' else (1 if report(a[0]) else 0))
