import json,re,sys
fn=sys.argv[1] if len(sys.argv)>1 else 'family_samples1.json'
R=json.load(open(fn)); META={m['key']:m for m in json.load(open('cg2.json'))['meta'] if m['sv'] is not None}
BAN=re.compile(r"\b(boasts?|world-class|unparalleled|stunning|incredible|spectacular|breathtaking|paradise|unforgettable|legendary|teeming|thriving|must-see|hidden gem|bucket-list)\b",re.I)
MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
LV={'peak':3,'good':2,'fair':1,'poor':0,'closed':0}
def band(x,pk): q=x/pk if pk>0 else 0; return 3 if q>=0.85 else 2 if q>=0.6 else 1 if q>=0.3 else 0
def expect(sv): return 'months' if sv>=8 else 'groups' if sv>=6 else 'year' if sv<=3 else 'groups'
def checks(r):
    g=r['gemini']; out=[]
    if not g: return [('flag','No usable answer: '+str(r['parseError']))]
    cv=r['curve']; pk=max(cv)
    if not g.get('applicable'):
        return [('flag',f"Gemini says N/A ({g.get('na_reason','')}); our score peaks at {pk:.1f}. Applicable stays (owner rule); note only.")]
    if g.get('confidence')=='low': out.append(('flag','Gemini reports low confidence.'))
    if g.get('flags'): out.append(('flag','Gemini flagged: '+'; '.join(g['flags'])[:240]))
    bm=set(g.get('best_months') or []); top={i+1 for i,v in enumerate(cv) if v>=pk-1.0}
    if g['depth']!='year' and bm and len(bm)<12 and len(top)<12 and len(bm&top)<min(2,len(bm),len(top)):
        out.append(('flag',f"Best months differ: Gemini {', '.join(MN[m-1] for m in sorted(bm))}; our curve peaks {', '.join(MN[m-1] for m in sorted(top))}."))
    bad=[(m,b['level'],cv[m-1]) for b in g.get('blurbs',[]) for m in b['months'] if 1<=m<=12 and pk>=3 and abs(band(cv[m-1],pk)-LV[b['level']])>=2 and g['depth']!='year']
    if bad: out.append(('flag','Month level two bands from our curve: '+'; '.join(f"{MN[m-1]} {lv}" for m,lv,sc in bad[:4])))
    txt=g.get('overview','')+' '+' '.join(b['text'] for b in g.get('blurbs',[]))
    h=BAN.findall(txt)
    if h: out.append(('flag','Banned promotional words: '+', '.join(sorted(set(x.lower() for x in h)))))
    if re.search(r'\b\d+\s?(km|kilomet|meters|metres)\b|°\s?C\b',txt,re.I) or re.search(r'\b(colour|metre|harbour|neighbour|centre)\w*',txt): out.append(('flag','Metric units or UK spelling.'))
    if len(g.get('overview',''))>450: out.append(('flag',f"Overview {len(g['overview'])} characters (max 450)."))
    for b in g.get('blurbs',[]):
        if len(b['text'])>300: out.append(('flag',f"A blurb is {len(b['text'])} characters (max 300).")); break
    cov=sorted(m for b in g.get('blurbs',[]) for m in b['months'])
    if cov!=list(range(1,13)) and g['depth']!='year': out.append(('flag',f"Months not covered exactly once: {cov}"))
    sv=META[r['k']]['sv']; e=expect(sv); order=['year','groups','months']
    if abs(order.index(g['depth'])-order.index(e))>=2: out.append(('note',f"Depth '{g['depth']}' is two steps from what the seasonal score ({sv}) suggests ('{e}')."))
    elif g['depth']!=e: out.append(('note',f"Depth '{g['depth']}', one step from the seasonal score ({sv}) suggestion ('{e}')."))
    return out
if __name__=='__main__':
    import collections
    c=collections.Counter()
    for r in R:
        r['checks']=checks(r)
        for t,m in r['checks']: c[t]+=1
        g=r['gemini'] or {}
        print(r['k'][:12].ljust(12),r['rank'][:6].ljust(6),r['name'][:20].ljust(20),g.get('applicable'),g.get('depth'),len(g.get('blurbs',[])),g.get('confidence'),[ (t,m[:60]) for t,m in r['checks'] if t=='flag'])
    print(dict(c)); json.dump(R,open(fn.replace('.json','_checked.json'),'w'),indent=1,ensure_ascii=False)
