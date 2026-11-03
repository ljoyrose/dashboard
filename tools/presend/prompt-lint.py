#!/usr/bin/env python3
"""prompt-lint: every prompt lesson is a row in PROMPT-LESSONS.csv; this runs them all.
  python3 prompt-lint.py PROMPT.txt            check one draft (exit 1 on any FAIL)
  python3 prompt-lint.py --selftest            every row's control text must trip its own check
  python3 prompt-lint.py --regress             every old failed prompt in regression/ must still be caught
  python3 prompt-lint.py --split               split the Drive bundles PROMPT-REGRESSION-SET*.txt into regression/*.txt + .expect
  python3 prompt-lint.py --presend PROMPT.txt [--meta M.json] [--app ID] [--now ISO]
                                               THE pre-send check: lessons + internal terms + file scope +
                                               out-of-scope clash + fold-in + freshness + inputs-gate + cost +
                                               obligations (CK51) + role gate (CK57) + newer draft + Dashboard lines.
                                               One line per check, last line READY or NOT READY. READY writes the
                                               SHA-256 stamp to runs/. Exit 0 only on READY.
Adding a lesson = adding a row. Nothing in this file names a lesson; the pre-send checks below are named
by their CHECKS.csv id (CK51, CK56, CK57) or a plain word. Per-app facts live in APPS.csv, never here.
Real data lives OUTSIDE this public repo: set PRESEND_DATA to that folder (lessons, APPS.csv, data/, sends,
regression/, runs/ and outbox/ are all read and written there). --selftest needs no data: invented inputs only."""
import csv, re, sys, os, glob, json, hashlib, importlib.util
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
HERE=os.path.dirname(os.path.abspath(__file__))
UK=ZoneInfo('Europe/London')
DATA=None  # set by data_dir() from env PRESEND_DATA; never a folder inside the repo
def data_dir():
    global DATA
    d=os.environ.get('PRESEND_DATA','')
    if not d: sys.exit('SETUP: set PRESEND_DATA to the data folder outside the repo (see README "Data").')
    d=os.path.realpath(d); root=os.path.realpath(os.path.join(HERE,'..','..'))
    if d==root or d.startswith(root+os.sep): sys.exit('SETUP: PRESEND_DATA is inside the repo. Real data must live outside it.')
    if not os.path.isdir(d): sys.exit(f'SETUP: PRESEND_DATA folder not found: {d}')
    DATA=d; return d
def lessons_file(): return next((p for p in (os.path.join(DATA,'PROMPT-LESSONS.csv'),os.path.join(DATA,'PROMPT-LESSONS-CHECKS.csv')) if os.path.exists(p)),None) if DATA else None
def lessons(path=None):
    path=path or lessons_file()
    if not path: return None
    return [r for r in csv.DictReader(open(path,encoding='utf8')) if r['status'].strip()=='CHECK']
def flat(t): return re.sub(r'\s+',' ',t)
def hit(row,text):
    """True when the lesson's failure is present in text."""
    k,p=row['kind'],row['pattern']
    if row['check']=='blank_lines': return bool(re.search(r'\n[ \t]*\n',text))
    if k=='max_chars': return len(text)>int(p)
    f=flat(text)
    if k=='absent': return bool(re.search(p,f,re.I))
    if k=='absent_affirmed':
        # the thing may be forbidden in the prompt ("do not rename...") but never asked for
        g=re.sub(r"\b(do not|don't|never|must not|no)\b[^.;:]*", ' ', f, flags=re.I)
        return bool(re.search(p,g,re.I))
    trig=row['trigger']
    if k=='present_if' and not re.search(trig,f,re.I): return False
    return not re.search(p,f,re.I)
def check(text,rows):
    return [(r,hit(r,text)) for r in rows]
def report(text,rows,name='draft'):
    res=check(text,rows); fails=[r for r,h in res if h and r['severity']=='FAIL']; warns=[r for r,h in res if h and r['severity']!='FAIL']
    print(f'== {name}: {len(text)} chars, {text.count(chr(10))+1} lines, {len(rows)} checks run')
    for r,h in res:
        if h: print(f"  {r['severity']:4} {r['id']} {r['what_went_wrong']} -> FIX: {r['fix']}")
    print(f'  RESULT: {len(fails)} FAIL, {len(warns)} WARN, {len(rows)-len(fails)-len(warns)} PASS')
    return fails
INVENTED_LESSONS=[  # shape of PROMPT-LESSONS.csv, invented rows: the self-test runs on these when no data folder is set
 {'id':'X01','status':'CHECK','check':'','kind':'absent','pattern':r'\bZQX-FORBIDDEN\b','trigger':'','severity':'FAIL','what_went_wrong':'invented forbidden word','fix':'remove it','control':'say ZQX-FORBIDDEN here'},
 {'id':'X02','status':'CHECK','check':'','kind':'present_if','pattern':r'END OF PROMPT','trigger':r'THE WORK','severity':'FAIL','what_went_wrong':'no end marker','fix':'add END OF PROMPT','control':'THE WORK. 1. do a thing'},
 {'id':'X03','status':'CHECK','check':'','kind':'max_chars','pattern':'40','trigger':'','severity':'WARN','what_went_wrong':'too long','fix':'shorten','control':'x'*41},
 {'id':'X04','status':'CHECK','check':'blank_lines','kind':'absent','pattern':'x','trigger':'','severity':'FAIL','what_went_wrong':'blank line','fix':'join lines','control':'a\\n\\nb'}]
def selftest(rows):
    bad=0; n=0
    f=lessons_file()
    if rows is None: rows=INVENTED_LESSONS; print('  no PRESEND_DATA lessons: lesson controls run on invented rows')
    for r in (csv.DictReader(open(f,encoding='utf8')) if f else []):
        if None in r or r['status'] not in ('CHECK','ADVICE','RETIRED'): print('  MALFORMED ROW (quote patterns with commas):',r['id']); bad+=1
        elif r['status']=='CHECK':
            try: re.compile(r['pattern'] or 'x'); re.compile(r['trigger'] or 'x')
            except re.error as e: print('  BAD REGEX:',r['id'],e); bad+=1
    for r in rows:
        c=r['control'].replace('\\n','\n')
        if not c: continue
        n+=1
        if not hit(r,c): print('  CONTROL DID NOT FIRE:',r['id'],repr(c)); bad+=1
    bad+=presend_selftest()
    print(f'selftest: {n} controls, {bad} silent'); return bad
def bundles():
    """Drive form: PROMPT-REGRESSION-SET*.txt, each case '=== name | expect: L01 L02' then the prompt."""
    cases=[]
    for bundle in sorted(glob.glob(os.path.join(DATA,'PROMPT-REGRESSION-SET*.txt'))):
        for part in open(bundle,encoding='utf8').read().split('\n=== ')[1:]:
            head,_,body=part.partition('\n'); name,_,exp=head.partition('| expect:')
            cases.append((name.strip(),set(exp.split()),body.rstrip('\n')+'\n'))
    return cases
def split():
    """Write each bundle case to regression/<name>.txt + <name>.expect (the split set the regress run reads)."""
    os.makedirs(os.path.join(DATA,'regression'),exist_ok=True); n=0
    for name,exp,text in bundles():
        b=os.path.join(DATA,'regression',re.sub(r'[^\w.-]+','-',name))
        open(b+'.txt','w',encoding='utf8').write(text); open(b+'.expect','w',encoding='utf8').write(' '.join(sorted(exp))+'\n'); n+=1
    print(f'split: {n} cases into regression/'); return 0
def regress(rows):
    """regression/<name>.txt + <name>.expect. The .expect holds the lesson ids the old prompt must trip.
    A token +presend switches on the text-only pre-send checks for that case; their ids then count too."""
    FAILS={r['id'] for r in rows if r['severity']=='FAIL'}|set(TEXT_CHECKS)
    cases=[]
    for f in sorted(glob.glob(os.path.join(DATA,'regression','*.txt'))):
        exp=set(open(f[:-4]+'.expect',encoding='utf8').read().split())
        cases.append((os.path.basename(f),exp,open(f,encoding='utf8').read()))
    if not cases: cases=bundles()  # no split folder yet: read the Drive bundles directly
    bad=0
    for name,exp,text in cases:
        on='+presend' in exp; exp=exp-{'+presend'}
        got={r['id'] for r,h in check(text,rows) if h}
        if on: got|={cid for cid,(st,_) in text_checks(text,app_row(None,text)).items() if st=='FAIL'}
        else: exp={e for e in exp if e not in TEXT_CHECKS}
        miss=exp-got; extra={i for i in got-exp if i in FAILS and (on or i not in TEXT_CHECKS)}
        print(f"  {name}: expected {sorted(exp)} caught {sorted(exp&got)}"+(f' MISSED {sorted(miss)}' if miss else '')+(f' FALSE ALARM {sorted(extra)}' if extra else '')+('' if miss or extra else ' OK'))
        bad+=len(miss)+len(extra)
    print(f'regress: {len(cases)} old prompts, {bad} misses'); return bad

# ---------------------------------------------------------------- pre-send checks
# CK56 pattern: CHECKS.csv CK56, kept with the data as data/CK56-PATTERN.txt (one line, a regex).
def ck56_pattern():
    p=os.path.join(DATA,'data','CK56-PATTERN.txt') if DATA else ''
    return open(p,encoding='utf8').read().strip() if os.path.exists(p) else None
PATH=r'(?<![\w/])(?:src|public|api|functions|server)/[\w./-]+\.[A-Za-z]{2,4}\b'
BARE=r'\b[A-Za-z][\w-]*\.(?:tsx|ts|jsx|js|css|html)\b'
NUM={w:i for i,w in enumerate('zero one two three four five six seven eight nine ten eleven twelve'.split())}
NEG=r"\b(do not|don't|never|must not|change no|create no|add no|nothing|not)\b"
ACT=r'\b(change|add|make|show|remove|rename|create|update|fix|replace|move|edit|rewrite|build|put|apply|call|delete|translate|restyle)\b'
GENERIC=set('code file app member prompt page today thing change'.split())
STOP=set('the a an and or of to in on for by with any every its their this that these those from at as is are be held shown today own how which where what all'.split())
def stem(p): return re.sub(r'\.[A-Za-z]+$','',os.path.basename(p)).lower()
def stems(s): return {stem(x) for x in re.findall(PATH,s)}|{stem(x) for x in re.findall(BARE,s)}
def sect(text,start,end=r'\.(?:\s|$)'):
    m=re.search(start+r'(.+?)'+end,flat(text),re.I); return m.group(1) if m else None
def items(text):
    """Numbered work items: lines starting 'N. ' after THE WORK (or anywhere if there is no such line)."""
    lines=text.split('\n'); k=next((i for i,l in enumerate(lines) if re.match(r'\s*THE WORK\b',l)),-1)
    return [l for l in lines[k+1:] if re.match(r'\s*\d+\.\s',l)]
def sentences(s): return [x for x in re.split(r'(?<=[.;:])\s+',s) if x.strip()]
def app_row(app,text=''):
    p=os.path.join(DATA or '','APPS.csv')
    if not DATA or not os.path.exists(p): return None
    rows=list(csv.DictReader(open(p,encoding='utf8')))
    for r in rows:
        if app and app in (r['app_id'],r['key']): return r
    for r in rows:
        if r['match'] and re.search(r['match'],text): return r
    return None
def controls(app):
    """APPS.csv ui_controls: 'label@file@where@family regex;...' -> [(label, file stem, where, family)].
    A family groups controls a prompt may name by kind alone (Sign out / Log out)."""
    out=[]
    for c in (app or {}).get('ui_controls','').split(';'):
        if c.strip(): l,f,w,fam=(c.split('@')+['','',''])[:4]; out.append((l.strip(),stem(f.strip()),w.strip(),fam.strip()))
    return out
def file_scope(text,app):
    fence=sect(text,r'Change no file other than ')
    if fence is None: return 'FAIL','no "Change no file other than ..." line, so the builder may touch any file'
    fence_s=stems(fence)
    ro=stems(sect(text,r'READ ONLY: ',r'\.\s') or '')
    scope=sect(text,r'files this prompt may change: ',r'\. ')
    msgs=[]
    if scope is not None and stems(scope)!=fence_s: msgs.append(f'scope-of-reading list {sorted(stems(scope))} differs from the change list {sorted(fence_s)}')
    it=items(text); named=set()
    for l in it:
        for s in sentences(l):
            if re.search(r'\bREAD ONLY\b|\bread\b.*\bendpoint\b',s) and not re.search(ACT,s.split('READ ONLY')[0],re.I): continue
            named|=stems(s)
    named-=ro
    extra=named-fence_s
    if extra: msgs.append(f'items name files outside the change list: {sorted(extra)}')
    unused=fence_s-named
    if unused: msgs.append(f'change list has files no item names: {sorted(unused)}')
    rr=re.search(r'Re-read all (\w+) changed files',flat(text),re.I)
    if rr:
        n=NUM.get(rr.group(1).lower(),int(rr.group(1)) if rr.group(1).isdigit() else -1)
        if n!=len(fence_s): msgs.append(f're-read list says {rr.group(1)} files, change list holds {len(fence_s)}')
    elif it: msgs.append('no "Re-read all N changed files" item, so the re-read list cannot be matched')
    # a control named only by its kind ("Sign out buttons") reaches every file that holds one, unless the prompt pins it down
    work=' '.join(it)
    for fam in sorted({c[3] for c in controls(app) if c[3]}):
        pinned=re.search(r'Do not (edit|change|touch) any other[^.]*('+fam+')',work,re.I)
        asked=[s for l in it for s in sentences(l) if re.search(fam,s,re.I) and re.search(ACT,s,re.I) and not re.search(r"\b(do not|don't|never) (edit|change|touch)\b",s,re.I)]
        if not asked or pinned: continue
        for l,f,w,cf in controls(app):
            if cf==fam and f not in fence_s and f not in ro:
                msgs.append(f'a sign-out/log-out button is asked for without saying which one and without "Do not edit any other"; this app also has "{l}" ({w}) in {f}, outside the change list')
    return ('FAIL','; '.join(msgs)) if msgs else ('PASS',f'{len(fence_s)} files: change list = items = re-read list'+(' = scope of reading' if scope else ''))
def oos_clash(text,app=None):
    f=flat(text)
    m=re.search(r'(?:out of scope[^:]*:|deliberately out of scope for this prompt:)\s*(.+?)(?:\.\s+[A-Z]|$)',f,re.I)
    if not m: return 'PASS','no out-of-scope list'
    clauses=[c for c in re.split(r';',re.sub(r'\([^)]*\)','',m.group(1))) if c.strip()]
    def words(s): return [re.sub(r'(?<=[a-z]{3})s$','',w) for w in re.findall(r'[a-z]+',s.lower()) if w not in STOP and len(w)>2]
    bad=[]
    for c in clauses:
        cw=set(words(c))-GENERIC
        if len(cw)<2: continue
        need=max(2,-(-len(cw)*2//5))
        for l in items(text):
            for s in sentences(l):
                if re.search(NEG,s,re.I) or not re.search(ACT,s,re.I): continue
                both=cw&set(words(s))
                if len(both)>=need: bad.append(f'item asks for {" ".join(sorted(both))}, listed out of scope ("{c.strip()[:60]}")')
    return ('FAIL','; '.join(sorted(set(bad))[:4])) if bad else ('PASS',f'{len(clauses)} out-of-scope entries, none asked for in an item')
def ck56(text,pattern=None):
    pat=pattern or ck56_pattern()
    if not pat: return 'NOT RUN','no data/CK56-PATTERN.txt (copy it from Drive)'
    h=sorted({m.group(0).strip() for m in re.finditer(pat,text)})
    return ('FAIL','internal terms: '+', '.join(h)) if h else ('PASS','internal-terms scan: 0 hits')
TEXT_CHECKS={'CK56':lambda t,a: ck56(t),'FILESCOPE':file_scope,'OOSCLASH':oos_clash}
def text_checks(text,app): return {k:fn(text,app) for k,fn in TEXT_CHECKS.items()}

def rd(p): return open(p if os.path.isabs(p) else os.path.join(DATA,p),encoding='utf8').read()
def exists(p): return bool(p) and (os.path.isabs(p) or bool(DATA)) and os.path.exists(p if os.path.isabs(p) else os.path.join(DATA,p))
def ts(s):
    if not s: return None
    d=datetime.fromisoformat(str(s).replace('Z','+00:00'))
    return d if d.tzinfo else d.replace(tzinfo=UK)
def ukfmt(d): return d.astimezone(UK).strftime('%d %b %Y %H:%M UK')
def fold_in(text,app,meta):
    sid=str((meta or {}).get('send_id','')).lower()
    sn=(app or {}).get('snags_file','')
    if not exists(sn): return 'NOT RUN',f'no snags file for this app (APPS.csv snags_file = "{sn}")',[]
    fence=stems(sect(text,r'Change no file other than ') or '')
    out=[]; sec=None; files=set()
    for line in rd(sn).split('\n'):
        h=re.match(r'###\s+\d+\.\s+(.+?)\((.+?)\)',line)
        if h: sec=h.group(1).strip(); files={stem(x.strip()) for x in h.group(2).split(',')}; continue
        r=[c.strip() for c in line.strip().strip('|').split('|')]
        if sec and len(r)>=6 and re.match(r'^[A-Z]\d+$',r[0]) and files&fence:
            st=r[4].lower()
            if (sid and st.startswith('in '+sid)) or 'platform gap' in st: continue
            out.append((r[0],f'{sec}: {re.sub(r"[*]","",r[1])[:90]} | fix: {r[2][:70]} | {r[4]} | cheap: {r[5]}'))
    rm=(app or {}).get('roadmap_file','')
    if rm and exists(rm):
        for line in rd(rm).split('\n'):
            r=[c.strip() for c in line.strip().strip('|').split('|')]
            if len(r)>=3 and re.match(r'^[LR]\d+$',r[0]) and stems(line)&fence: out.append((r[0],'roadmap: '+' | '.join(r[1:3])[:150]))
    decided=set((meta or {}).get('fold_in_decided',[]))
    missing=[i for i,_ in out if i not in decided]
    why=f'{len(out)} open snag/roadmap rows touch these files'+('' if rm and exists(rm) else '; roadmap file not configured, snags only')
    if missing: return 'FAIL',why+f'; no in/out decision recorded for {", ".join(missing)}',out
    if not (rm and exists(rm)): return 'NOT RUN',why,out
    return 'PASS',why+', each decided',out
def freshness(text,meta,now):
    m=re.search(r'read live on (\d{1,2} \w+ \d{4}) at (\d{1,2}:\d{2}) UK time',flat(text))
    reads={'code read':datetime.strptime(m.group(1)+' '+m.group(2),'%d %B %Y %H:%M').replace(tzinfo=UK) if m else None,
           'ClickUp pull':ts((meta or {}).get('clickup_pulled_at')),'register read':ts((meta or {}).get('register_read_at'))}
    bad=[f'{k} missing' for k,v in reads.items() if not v]+[f'{k} {ukfmt(v)} is {(now-v).total_seconds()/3600:.1f} h old' for k,v in reads.items() if v and now-v>timedelta(hours=6)]
    shown=', '.join(f'{k} {ukfmt(v)}' for k,v in reads.items() if v)
    return ('FAIL','; '.join(bad)+(f' (have: {shown})' if shown else '')) if bad else ('PASS','all under 6 h: '+shown)
def inputs(app,now):
    p=(app or {}).get('inputs_file','')
    if not exists(p): return 'NOT RUN',f'no inputs file (APPS.csv inputs_file = "{p}")'
    spec=importlib.util.spec_from_file_location('inputs_gate',os.path.join(HERE,'inputs-gate.py')); g=importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
    m=json.loads(rd(p)); r=g.gate(m); ck=ts(m.get('checked_at'))
    if ck and now-ck>timedelta(hours=6): r.append(('I0',f'inputs file checked {ukfmt(ck)}, over 6 h ago: re-run the inputs watcher'))
    return ('FAIL','; '.join(f'{c} {x}' for c,x in r)) if r else ('PASS',f'I1-I5 pass ({os.path.basename(p)})')
def cost(meta):
    e=(meta or {}).get('credit_estimate'); s=(meta or {}).get('ledger_stop')
    if not e: return 'FAIL','no credit estimate'
    hi=max(e) if isinstance(e,list) else e
    if not s: return 'FAIL',f'estimate {e} but no ledger stop (should be {round(hi*1.5):,})'
    if abs(s-1.5*hi)>0.01*hi: return 'FAIL',f'ledger stop {s:,} is not 1.5 x the top of the estimate ({round(hi*1.5):,})'
    return 'PASS',f'estimate {"-".join(f"{x:,}" for x in e) if isinstance(e,list) else e}, ledger stop {s:,}'
def ledger_rows(app):
    p=(app or {}).get('ledger_file',''); sec=(app or {}).get('ledger_section','3.7')
    if not exists(p): return None,f'APPS.csv ledger_file "{p}"'
    t=rd(p); m=re.search(r'^#+\s*'+re.escape(sec)+r'\b.*$',t,re.M)
    if not m: return None,f'{p}: no "{sec}" heading'
    body=t[m.end():]; nx=re.search(r'^#{1,3}\s+\d',body,re.M); body=body[:nx.start()] if nx else body
    rows=[[c.strip() for c in l.strip().strip('|').split('|')] for l in body.split('\n') if re.match(r'\|\s*OB-',l)]
    return rows,f'{os.path.basename(p)} {sec} ({len(rows)} rows)'
def ck51(text,app,meta):
    rows,where=ledger_rows(app)
    if rows is None: return 'NOT RUN',f'ledger not found; looked in {where}',[]
    sid=(meta or {}).get('send_id','')
    due=[r for r in rows if len(r)>=6 and (re.match(r'(each|every) prompt',r[3],re.I) or (sid and re.fullmatch(re.escape(sid)+r'( session)?',r[3],re.I)))]
    mp={r['ob']:r['lessons'].split() for r in csv.DictReader(open(os.path.join(DATA,'data','OB-LESSON-MAP.csv'),encoding='utf8'))} if exists('data/OB-LESSON-MAP.csv') else {}
    fired={r['id'] for r,h in check(text,lessons() or []) if h}
    quoted=[]; bad=[]; unchecked=[]
    for r in due:
        if r[4].upper() in ('OPEN','PART') or (r[1] in ('DATA','ASSET') and r[4].upper()!='DONE'): bad.append(r[0]); how='OPEN'
        elif r[0] in mp: how='carried (lessons '+' '.join(mp[r[0]])+(' FAIL' if fired&set(mp[r[0]]) else ' pass')+')'; bad+= [r[0]] if fired&set(mp[r[0]]) else []
        else: how='NOT CHECKED: no lesson tests this rule text'; unchecked.append(r[0])
        quoted.append(f'{r[0]} [{r[1]}, {r[4]}] {how} · {r[5][:70]}')
    if bad: return 'FAIL',f'{len(due)} rows due at this send ({where}); open or not carried: {", ".join(bad)}',quoted
    if unchecked: return 'NOT RUN',f'{len(due)} rows due ({where}), {len(due)-len(unchecked)} carried; rule text not checkable for {", ".join(unchecked)}',quoted
    return 'PASS',f'{len(due)} rows due at this send ({where}), all carried',quoted
SERVER=r'\b(add|create|write|change|update)\b[^.;]*\b(endpoint|server code|server function|api route|backend function|/api/)'
def ck57(text,app):
    work=' '.join(items(text))
    adds=[s for s in sentences(work) if re.search(SERVER,s,re.I) and not re.search(NEG+r'[^.;]*\b(endpoint|server)',s,re.I)]
    if not adds: return 'N/A','no server code added or changed by this prompt'
    p=(app or {}).get('ledger_file',''); sec=(app or {}).get('roles_section','4.0')
    if not exists(p): return 'NOT RUN',f'server code added; table register not found (APPS.csv ledger_file "{p}")'
    t=rd(p); m=re.search(r'^#+\s*'+re.escape(sec)+r'\b.*$',t,re.M)
    if not m: return 'NOT RUN',f'server code added; {os.path.basename(p)} has no "{sec}" heading'
    lines=t[m.end():].split('\n'); hdr=next((l for l in lines if l.startswith('| Table')),'')
    cols=[c.strip().lower() for c in hdr.strip('|').split('|')]
    if 'role gate' not in cols: return 'FAIL',f'server code added; {sec} has no Role gate column, so no table it reads is gated'
    gi=cols.index('role gate'); tabs={}
    for l in lines:
        r=[c.strip() for c in l.strip().strip('|').split('|')]
        if len(r)>gi and re.match(r'^[a-z_]+$',r[0]): tabs[r[0]]=r[gi]
    named=[x for x in tabs if re.search(r'\b'+x+r'\b',work)]
    bad=[x for x in named if tabs[x].strip().lower() in ('','none','-','—')]
    if bad: return 'FAIL','Role gate blank or none for '+', '.join(bad)
    return 'PASS',f'{len(named)} tables read by the new server code all carry a Role gate'
def newer_draft(path):
    m=re.match(r'(.+?)-v(\d+)\.txt$',os.path.basename(path))
    if not m: return 'PASS','not a versioned draft name'
    later=[f for f in glob.glob(os.path.join(os.path.dirname(os.path.abspath(path)),m.group(1)+'-v*.txt')) if (re.search(r'-v(\d+)\.txt$',f) and int(re.search(r'-v(\d+)\.txt$',f).group(1))>int(m.group(2)))]
    return ('FAIL','a newer draft exists: '+', '.join(os.path.basename(x) for x in later)) if later else ('PASS',f'v{m.group(2)} is the newest draft in its folder')
def dash_lines(meta):
    d=(meta or {}).get('dashboard_lines') or []
    return ('PASS',f'{len(d)} Dashboard lines in the pack') if d else ('FAIL','no Dashboard lines in the pack')
def presend(path,meta_path=None,app_id=None,now=None,write=True):
    text=open(path,encoding='utf8').read(); now=now or datetime.now(timezone.utc)
    meta_path=meta_path or (path[:-4]+'.meta.json' if os.path.exists(path[:-4]+'.meta.json') else None)
    meta=json.load(open(meta_path,encoding='utf8')) if meta_path else {}
    app=app_row(app_id or meta.get('app'),text); rows=lessons()
    sha=text_sha(path)
    out=[]; extra=[]
    res=check(text,rows or []); lf=[r for r,h in res if h and r['severity']=='FAIL']; lw=[r for r,h in res if h and r['severity']!='FAIL']
    if rows is None: out.append(('NOT RUN','LESSONS','no PROMPT-LESSONS.csv in PRESEND_DATA'))
    else: out.append(('FAIL' if lf else 'PASS','LESSONS',f'{len(rows)-len(lf)-len(lw)}/{len(rows)} lesson checks pass'+(f'; FAIL {" ".join(r["id"] for r in lf)}' if lf else '')+(f'; WARN {" ".join(r["id"] for r in lw)}' if lw else '')))
    for k,(st,why) in text_checks(text,app).items(): out.append((st,k,why))
    st,why,cons=fold_in(text,app,meta); out.append((st,'FOLD-IN',why)); extra+=[('CONSIDER',i,w) for i,w in cons]
    out.append((*freshness(text,meta,now)[:1],'FRESHNESS',freshness(text,meta,now)[1]))
    st,why=inputs(app,now); out.append((st,'INPUTS-GATE',why))
    st,why=cost(meta); out.append((st,'COST',why))
    st,why,q=ck51(text,app,meta); out.append((st,'CK51',why)); extra+=[('QUOTE','CK51',x) for x in q]
    st,why=ck57(text,app); out.append((st,'CK57',why))
    st,why=newer_draft(path); out.append((st,'NEWER-DRAFT',why))
    st,why=dash_lines(meta); out.append((st,'DASHBOARD',why))
    ready=all(s in ('PASS','N/A') for s,_,_ in out)
    nf=sum(s=='FAIL' for s,_,_ in out); nr=sum(s=='NOT RUN' for s,_,_ in out)
    head=f'== presend {os.path.basename(path)} · {app["name"] if app else "app not found in APPS.csv"} · {ukfmt(now)}'
    stamp=f'presend: READY sha256:{sha} {now.astimezone(UK).strftime("%d %b %Y")} UK' if ready else f'presend: NOT READY ({nf} FAIL, {nr} NOT RUN) sha256:{sha} {ukfmt(now)}'
    lines=[head]+[f'{s:<9}{k:<12}{w}' for s,k,w in out]+[f'{s:<9}{k:<12}{w}' for s,k,w in extra]+[('READY' if ready else 'NOT READY')+(f' · stamp sha256:{sha}' if ready else f' · {nf} FAIL, {nr} NOT RUN · no stamp')]
    print('\n'.join(lines))
    if write:
        os.makedirs(os.path.join(DATA,'runs'),exist_ok=True); os.makedirs(os.path.join(DATA,'outbox'),exist_ok=True)
        stem_=os.path.basename(path)[:-4]; tag=now.astimezone(UK).strftime('%Y%m%d-%H%M')
        open(os.path.join(DATA,'runs',f'RUN-{stem_}-{tag}.md'),'w',encoding='utf8').write('\n'.join(['# '+head[3:],'```']+lines+['```',stamp,'Any edit to the text changes the SHA-256: re-run before sending.','']))
        if meta.get('clickup_task_id'):
            json.dump({'kind':'stamp','taskId':meta['clickup_task_id'],'line':stamp,'sha256':sha,'ready':ready,'at':now.isoformat(),'by':'presend checker'},
                      open(os.path.join(DATA,'outbox',f'stamp-{stem_}-{tag}.json'),'w',encoding='utf8'),indent=1)
    return ready,stamp,lines
def text_sha(path):
    """The stamp's hash: SHA-256 of the text with leading and trailing whitespace removed (UTF-8).
    The Factory Copy button hashes the same trimmed text, so a newline at the end of the file never breaks the match."""
    return hashlib.sha256(open(path,encoding='utf8').read().strip().encode('utf8')).hexdigest()
def verify(path,line):
    """The Send gate's test: the stamp must be READY and its SHA-256 must equal the text being sent."""
    m=re.search(r'presend: READY sha256:([0-9a-f]{64})',line or '')
    return bool(m) and m.group(1)==text_sha(path)
GOOD_CONTROL="""Standing rules apply.
Code described below was read live on 1 January 2030 at 09:00 UK time.
SCOPE OF READING: the only existing files in scope are the two files this prompt may change: src/pages/Home.tsx and src/lib/store.ts. READ ONLY: src/lib/auth.ts.
Known and out of scope, do not change or report: brand names, logos and colours shown in the header; plans and checkout.
THE WORK. Three numbered items. Start your reply by stating how many numbered items you received.
1. In src/pages/Home.tsx, make one Enter save the note once. Make the Sign out button on the Home page clear the note. Do not edit any other sign-out or log-out button.
2. In src/lib/store.ts, add one function that clears the saved note.
3. Re-read all two changed files after all edits and confirm each change with file and line.
Create no table, column or endpoint. Change no file other than src/pages/Home.tsx and src/lib/store.ts. Add no test page.
END OF PROMPT
"""
CONTROL_APP={'ui_controls':'Log out@Header.tsx@the header@sign[- ]?out|log[- ]?out;Sign out@Home.tsx@the Home page@sign[- ]?out|log[- ]?out'}
CONTROL_LEDGER="""### 3.7 Obligations ledger
| Id | Type | Owner | Due | Status | Obligation | Note |
|---|---|---|---|---|---|---|
| OB-X01 | PROMPT | CLAUDE | each prompt | RULE | A rule every prompt carries. | - |
| OB-X02 | DATA | OWNER | P1 | OPEN | Data keyed in before P1. | - |
"""
def presend_selftest():
    """Controls for the pre-send checks, on invented text only: each must fire on a broken copy and stay quiet on the good one."""
    global DATA
    keep,DATA=DATA,None  # the controls never read real data (an OB-LESSON-MAP row could hide a control)
    try: return _presend_selftest()
    finally: DATA=keep
def _presend_selftest():
    import tempfile
    bad=0; t=GOOD_CONTROL; app=CONTROL_APP; pat=r'\bZQX[0-9]\b'  # invented internal-term pattern
    checks={'CK56':lambda x,a: ck56(x,pat),'FILESCOPE':file_scope,'OOSCLASH':oos_clash}
    cases={'CK56':t.replace('make one Enter','(ZQX2, ZQX1) make one Enter'),
           'FILESCOPE':t.replace(' Do not edit any other sign-out or log-out button.',''),
           'OOSCLASH':t.replace('clears the saved note.','clears the saved note. Also change the brand logos shown in the header.')}
    for k,c in cases.items():
        if checks[k](t,app)[0]!='PASS': print('  CONTROL TEXT FAILS',k,checks[k](t,app)[1]); bad+=1
        if checks[k](c,app)[0]!='FAIL': print('  CONTROL DID NOT FIRE:',k); bad+=1
    if file_scope(t.replace('and src/lib/store.ts. Add no','and src/lib/store.ts and src/pages/Other.tsx. Add no'),app)[0]!='FAIL': print('  CONTROL DID NOT FIRE: FILESCOPE extra file'); bad+=1
    if cost({'credit_estimate':[3300,5900]})[0]!='FAIL' or cost({'credit_estimate':[3300,5900],'ledger_stop':8850})[0]!='PASS': print('  CONTROL DID NOT FIRE: COST'); bad+=1
    if freshness(t,{'clickup_pulled_at':'2026-10-01T00:00:00Z','register_read_at':'2026-10-01T00:00:00Z'},datetime.now(timezone.utc))[0]!='FAIL': print('  CONTROL DID NOT FIRE: FRESHNESS'); bad+=1
    if ck57('THE WORK.\n1. Add an endpoint /api/x that reads tenants.\n',{})[0] not in ('FAIL','NOT RUN') or ck57(t,app)[0]!='N/A': print('  CONTROL DID NOT FIRE: CK57'); bad+=1
    d=tempfile.mkdtemp(); led=os.path.join(d,'ledger.md'); open(led,'w').write(CONTROL_LEDGER); g=os.path.join(d,'draft.txt'); open(g,'w').write(t)
    if ck51(t,{'ledger_file':os.path.join(d,'none.md')},{})[0]!='NOT RUN': print('  CONTROL DID NOT FIRE: CK51 missing ledger must be NOT RUN, never PASS'); bad+=1
    if ck51(t,{'ledger_file':led,'ledger_section':'3.7'},{'send_id':'P1'})[0]!='FAIL': print('  CONTROL DID NOT FIRE: CK51 open row due at P1'); bad+=1
    if ck51(t,{'ledger_file':led,'ledger_section':'3.7'},{'send_id':'P2'})[0]!='NOT RUN': print('  CONTROL DID NOT FIRE: CK51 rule with no lesson must be NOT RUN'); bad+=1
    sha=text_sha(g)
    if not verify(g,f'presend: READY sha256:{sha} 1 Jan 2030 UK') or verify(g,f'presend: READY sha256:{"0"*64} 1 Jan 2030 UK') or verify(g,'inputs-gate: PASS'):
        print('  CONTROL DID NOT FIRE: STAMP verify'); bad+=1
    g2=os.path.join(d,'draft-nl.txt'); open(g2,'w').write(t.rstrip('\n')+'\n\n\n'); g3=os.path.join(d,'draft-edit.txt'); open(g3,'w').write(t.replace('one Enter','one  Enter'))
    if text_sha(g2)!=sha or text_sha(g3)==sha: print('  CONTROL DID NOT FIRE: STAMP hash must ignore end newlines and catch an inside edit'); bad+=1
    return bad
if __name__=='__main__':
    a=sys.argv[1:]
    if not a: print(__doc__); sys.exit(2)
    if a[0]=='--selftest':
        if os.environ.get('PRESEND_DATA'): data_dir()
        sys.exit(1 if selftest(lessons()) else 0)
    if a[0]=='--verify': sys.exit(0 if verify(a[1],a[2]) else 1)
    data_dir(); rows=lessons()
    if rows is None and a[0]!='--presend': sys.exit('SETUP: no PROMPT-LESSONS.csv in PRESEND_DATA')
    if a[0]=='--regress': sys.exit(1 if regress(rows) else 0)
    if a[0]=='--split': sys.exit(split())
    if a[0]=='--presend':
        opt=dict(zip(a[2::2],a[3::2])); now=ts(opt.get('--now'))
        sys.exit(0 if presend(a[1],opt.get('--meta'),opt.get('--app'),now)[0] else 1)
    sys.exit(1 if report(open(a[0],encoding='utf8').read(),rows,os.path.basename(a[0])) else 0)
