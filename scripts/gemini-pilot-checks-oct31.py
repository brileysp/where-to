import json,re
R=json.load(open('pilot_results.json'))
SV={'whaleWatching':9,'diving':6,'museumsArt':2,'golf':8}
EXPECT={9:'months',6:'groups',2:'year',8:'months'}
NUM={'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9,'ten':10,'dozen':12}
def band(x,pk=10):
    q=x/pk if pk>0 else 0
    return 3 if q>=0.85 else 2 if q>=0.6 else 1 if q>=0.3 else 0
LV={'peak':3,'good':2,'fair':1,'poor':0,'closed':0}
MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
def checks(r):
    g=r['gemini']; out=[]
    if not g: return [('error','No usable answer: '+str(r['parseError']))]
    cv=r['curve']; pk=max(cv)
    if not g.get('applicable'):
        out.append(('flag',f"Gemini says N/A ({g.get('na_reason','')}); our score peaks at {pk:.1f}, so we have it applicable."))
        return out
    bm=set(g.get('best_months') or [])
    top={i+1 for i,v in enumerate(cv) if v>=pk-1.0}
    if g['depth']!='year' and bm and len(bm)<12 and len(top)<12:
        inter=bm&top
        if len(inter)<min(2,len(bm),len(top)): out.append(('flag',f"Best months differ: Gemini {', '.join(MN[m-1] for m in sorted(bm))}; our curve peaks {', '.join(MN[m-1] for m in sorted(top))}."))
    bad=[]
    for b in g.get('blurbs',[]):
        for m in b['months']:
            if 1<=m<=12 and abs(band(cv[m-1],pk)-LV[b['level']])>=2: bad.append((m,b['level'],cv[m-1]))
    if bad and pk>=3:
        out.append(('flag','Month level two bands from our curve (relative to its own peak): '+'; '.join(f"{MN[m-1]} {lv} vs our {sc:.1f}" for m,lv,sc in bad[:5])+('...' if len(bad)>5 else '')))
    cov=sorted(m for b in g.get('blurbs',[]) for m in b['months'])
    if cov!=list(range(1,13)) and g['depth']!='year' : out.append(('flag',f"Months not covered exactly once: {cov}"))
    ov=g.get('overview','')
    if len(ov)>450: out.append(('flag',f"Overview {len(ov)} characters (max 450)."))
    for b in g.get('blurbs',[]):
        if len(b['text'])>300: out.append(('flag',f"A blurb is {len(b['text'])} characters (max 300)."))
    txt=ov+' '+' '.join(b['text'] for b in g.get('blurbs',[]))
    if re.search(r'\b\d+\s?(km|kilomet|meters|metres)\b|°\s?C\b|\bcolour|\bmetre|\bharbour|\bcentre',txt,re.I): out.append(('flag','Metric units or UK spelling.'))
    if r['k']=='golf' and r.get('columns'):
        col=r['columns'].get('golfCourses')
        for m in re.finditer(r'(\d+|two|three|four|five|six|seven|eight|nine|ten|dozen)\s+(?:\w+\s+){0,3}courses?',txt,re.I):
            n=NUM.get(m.group(1).lower(),None) or (int(m.group(1)) if m.group(1).isdigit() else None)
            if n and col is not None and n<=60 and abs(n-col)>max(3,0.5*col): out.append(('flag',f"Text says {n} courses; our column says {col}."))
    exp=EXPECT[SV[r['k']]]; d=g['depth']; order=['year','groups','months']
    if abs(order.index(d)-order.index(exp))>=2: out.append(('note',f"Depth '{d}' is two steps from what the seasonal score ({SV[r['k']]}) suggests ('{exp}')."))
    elif d!=exp: out.append(('note',f"Depth '{d}', one step from what the seasonal score ({SV[r['k']]}) suggests ('{exp}')."))
    return out
if __name__=='__main__':
    import collections
    c=collections.Counter()
    for r in R:
        ck=checks(r); r['checks']=ck
        for t,m in ck: c[(r['k'],r['model'][7:12],t)]+=1
        print(r['k'][:6],r['name'][:18].ljust(18),r['model'][7:12],[ (t,m[:70]) for t,m in ck])
    print(dict(c))
    json.dump(R,open('pilot_checked.json','w'),indent=1,ensure_ascii=False)
