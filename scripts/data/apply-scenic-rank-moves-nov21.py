# 21 Nov 2026: force-rank moves for Scenic Landscapes (staged, not saved in the app). Each move scales the whole 12-month curve so its highest month equals the new peak.
import json,re
D='scripts/data/'
R=json.load(open(D+'scenic-full-200-results-nov16.json')); N=json.load(open(D+'scenic-full-notes-nov16.json')); M=json.load(open(D+'rank-moves-scenic-nov21.json'))
by={x['id']:x for x in R}
for m in M:
    x=by[m['id']]; g=x['gemini']; s=g['monthly_scores']; old=max(s)
    if abs(old-m['to'])<1e-9: continue
    k=m['to']/old; new=[round(v*k,1) if v not in (0,) else 0 for v in s]
    new[new.index(max(new))]=m['to'] if max(new)!=m['to'] else new[new.index(max(new))]
    assert max(new)==m['to'],(m['name'],max(new))
    g['monthly_scores']=new
    if 'gemini_scores' in x: x['gemini_scores']=new
    N[m['id']]['why']=(N[m['id']]['why']+f" Force rank (21 Nov): peak {old:g} to {m['to']:g}. {m['why']}").strip()
pat=re.compile(r'Rank among the (\d+) ([a-z &,]+?) in this batch: (\d+) at ([\d.]+)(?:; next above (.+?) \(([\d.]+)\))?(?:; next below (.+?) \(([\d.]+)\))?\.')
groups={}
for x in R:
    m=pat.search(N.get(x['id'],{}).get('why',''))
    if m: groups.setdefault(m.group(2),[]).append((x['id'],x['name'],max(x['gemini']['monthly_scores'])))
fmt=lambda v:'%g'%v; chg=0
for t,L in groups.items():
    L.sort(key=lambda r:(-r[2],r[1]))
    for i,(pid,name,pk) in enumerate(L):
        up=L[i-1] if i>0 else None; dn=L[i+1] if i+1<len(L) else None
        s_=f"Rank among the {len(L)} {t} in this batch: {i+1} at {fmt(pk)}"
        if up: s_+=f"; next above {up[1]} ({fmt(up[2])})"
        if dn: s_+=f"; next below {dn[1]} ({fmt(dn[2])})"
        s_+="."
        w=N[pid]['why']; mm=pat.search(w)
        if mm.group(0)!=s_: chg+=1; N[pid]['why']=w.replace(mm.group(0),s_)
json.dump(R,open(D+'scenic-full-200-results-nov16.json','w'),ensure_ascii=False); json.dump(N,open(D+'scenic-full-notes-nov16.json','w'),ensure_ascii=False)
print('rank sentences refreshed',chg)
import collections
pk=sorted([(max(x['gemini']['monthly_scores']),x['name']) for x in R if x['gemini'].get('applicable')],reverse=True)
print('top 20 distinct values:',len(set(p for p,_ in pk[:20])),[p for p,_ in pk[:20]])
c=collections.Counter(p for p,_ in pk); print('largest groups:',c.most_common(6)); print('count at 10:',c[10])
