import json,sys,re
sys.path.insert(0,'/tmp')
import ratio_check as rc
from merge5 import lvl,num
R=rc.R
C=json.load(open(R+'cost-seasonality-drafts.json'))
V=rc.V
fmt=rc.fmt
def raw_p(s):
    main=re.split(r'(?<!vs)\. ',s)[0]
    m=re.match(r'Prices peak ((?:in|from) .+?)(?:,? (?:with|and can be|where|when)|\.$)',main)
    if m: return m.group(1),'A'
    m=re.match(r'Many hotels cost about [\d.]+x as much ((?:in|from) .+?) (?:as|vs\.) ',main)
    if m: return m.group(1),'B'
    return None,None
FULL_GEN={'Arches & Canyonlands','Grand Canyon','Budapest'}   # label or low phrase differs: take the generator's own sentence
log=[]
for c in C:
    i=c['id']
    if int(i[1:])>96: continue
    v=V[i]; a=rc.parse(c['sent']); b=rc.parse(v['sent'])
    if not a or not b: continue
    if set(rc.expand(a[0]))==set(rc.expand(b[0])) and 'spring and fall' not in a[0]: continue
    if set(rc.expand(a[0]))==set(rc.expand(b[0])): continue
    old=c['sent']
    if c['name'] in FULL_GEN: new=v['sent']
    else:
        pg,tg=raw_p(v['sent']); pc,tc=raw_p(old)
        if not pg or not pc: continue
        new=old.replace(pc,pg,1)
        r=rc.group_ratio(c,v,pg,a[2])
        if r:
            tgt=fmt(r[0]); new=re.sub(r'(?<![\d.])'+re.escape(a[1])+r'x',num(tgt),new,count=1)
    if new!=old:
        c['sent']=new; log.append((c['name'],old,new))
        p=rc.parse(new)
        if p: c['badge']=lvl(fmt(float(p[1])))
json.dump(C,open(R+'cost-seasonality-drafts.json','w'),ensure_ascii=False)
prev=json.load(open(R+'compare-changes.json'))
json.dump(prev+log,open(R+'compare-changes.json','w'),ensure_ascii=False,indent=1)
print(len(log),'more sentences changed')
for n,o,nw in log: print('-',n,'\n    was:',o,'\n    now:',nw)
