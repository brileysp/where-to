import json,re,statistics as st,sys
R='/Users/brendansalant-pearce/Desktop/Claude Code/where-to-app/.cache/'
D=json.load(open(R+'cost-seasonality-drafts.json'))
MN=['January','February','March','April','May','June','July','August','September','October','November','December']
ml=[31,28,31,30,31,30,31,31,30,31,30,31]; ms=[sum(ml[:i]) for i in range(12)]
def month_of(d):
    for i in range(11,-1,-1):
        if d>=ms[i]: return i
def expand(txt):
    """months named in a phrase like 'July and August', 'from June to September', 'February, July and August', 'April and from July to October'"""
    toks=re.findall(r'(January|February|March|April|May|June|July|August|September|October|November|December|\bto\b)',txt)
    out=[];i=0
    while i<len(toks):
        t=toks[i]
        if t=='to': i+=1; continue
        a=MN.index(t)
        if i+2<len(toks) and toks[i+1]=='to' and toks[i+2]!='to':
            b=MN.index(toks[i+2]); k=a
            while True:
                out.append(k)
                if k==b: break
                k=(k+1)%12
            i+=3
        else: out.append(a); i+=1
    return sorted(set(out))
def season_months(txt,north=True):
    t=txt.lower(); out=set()
    if 'spring' in t: out|={2,3,4}
    if 'fall' in t or 'autumn' in t: out|={8,9,10}
    if 'winter months' in t or re.search(r'\bwinter\b',t): out|=({11,0,1} if north else {5,6,7})
    return out
issues=[]; unparsed=[]
def monthvals(d):
    w=d['weeks']; by={i:[] for i in range(12)}
    for k,x in enumerate(w):
        if x is None: continue
        by[month_of((k+0.5)*7)].append(x)
    ev=set()
    for a,b,f in d.get('events',[]) or []:
        ev|=set(range(a,b+1))
    # median of weeks excluding event weeks and the three holiday weeks
    out={}
    for m,v in by.items(): out[m]=None
    for m in range(12):
        v=[x for k,x in enumerate(w) if x is not None and month_of((k+0.5)*7)==m and k not in ev and k not in (50,51,0)]
        out[m]=st.median(v) if v else None
    return out
for d in D:
    s=d['sent']; mv=monthvals(d); P=[]; L=[]; claims={}; SPRINGFALL=False
    open_=[m for m in range(12) if mv[m] is not None]
    if not open_: continue
    med=st.median([mv[m] for m in open_]); hi=max(mv[m] for m in open_); lo=min(mv[m] for m in open_)
    north=(d.get('lat') or 1)>=0
    text=re.sub(r'\([^)]*\)','',s)   # drop parentheticals
    # --- ratio sentence forms
    m=re.search(r'cost(?:ing)? about ([\d.]+)x(?: to ([\d.]+)x)? as much (?:in|from|as in)? ?(.*?) as (?:in |from )?(.+?)(?:,| and prices| Prices|\.|$)',text)
    pm=re.search(r'Prices peak (?:in|from) (.+?)(?:, with| and can|, when|\.)',text)
    spf=re.search(r'Prices peak in spring and fall, when many hotels cost about ([\d.]+)x as much as (?:in )?(.+?)(?:,|\.)',text)
    if spf:
        Pm=sorted(season_months('spring and fall')); Lm=sorted(season_months(spf.group(2))) or None; SPRINGFALL=True
        N=(float(spf.group(1)),float(spf.group(1))); lowtxt=spf.group(2)
    elif pm and re.search(r'as much as',text):
        Pm=expand(pm.group(1)); mm=re.search(r'as much as (?:in |from )?(.+?)(?:,| and prices|\.|$)',text); lowtxt=mm.group(1) if mm else ''
        mn=re.search(r'about ([\d.]+)x(?: to ([\d.]+)x)?',text); N=(float(mn.group(1)),float(mn.group(2) or mn.group(1))) if mn else None
        Lm=None
    elif m and not re.search(r'fairly flat',text):
        Pm=expand(m.group(3)); lowtxt=m.group(4); N=(float(m.group(1)),float(m.group(2) or m.group(1))); Lm=None
    else:
        Pm=None; Lm=None; N=None; lowtxt=''
    if Pm is not None:
        if re.search(r'rest of the year',lowtxt): Lm=[x for x in open_ if x not in Pm]
        elif re.search(r'shoulder',lowtxt): Lm=None
        else:
            Lm=expand(lowtxt) or sorted(season_months(lowtxt,north)) or None
            if re.search(r'winter',lowtxt) and not expand(lowtxt): Lm=sorted(season_months(lowtxt,north))
        Pm=[x for x in Pm if x in open_]
        if Lm: Lm=[x for x in Lm if x in open_]
        # C1 peak months are high
        if Pm:
            pv=sum(mv[x] for x in Pm)/len(Pm)
            if (pv<med*1.03 and not SPRINGFALL) or (SPRINGFALL and (sum(mv[x] for x in Pm if x in (2,3,4))/max(1,len([x for x in Pm if x in (2,3,4)]))<med*1.0 or sum(mv[x] for x in Pm if x in (8,9,10))/max(1,len([x for x in Pm if x in (8,9,10)]))<med*1.0)): issues.append((d['id'],d['name'],'peak months not high on the chart',f"{[MN[x][:3] for x in Pm]} avg {pv:.0f} vs median {med:.0f}"))
            weak=[MN[x][:3] for x in Pm if mv[x]<med*0.97] if not SPRINGFALL else []
            if weak: issues.append((d['id'],d['name'],'a named peak month is below the chart median',str(weak)))
            # C2 highest month not mentioned
            top=[x for x in open_ if mv[x]>=0.96*hi] if not SPRINGFALL else []
            miss=[MN[x][:3] for x in top if x not in Pm]
            if miss and not (d.get('events') and any(True for _ in [0])): issues.append((d['id'],d['name'],'chart high month not named as a peak',f"{miss} (chart max {hi:.0f})"))
        # C3 low months low
        if Lm and not re.search(r'rest of the year',lowtxt):
            hiL=[MN[x][:3] for x in Lm if mv[x]>med*1.08]
            if hiL: issues.append((d['id'],d['name'],'a named low month is above the chart median',str(hiL)))
        # C4 ratio
        if Pm and Lm and N:
            r=(sum(mv[x] for x in Pm)/len(Pm))/(sum(mv[x] for x in Lm)/len(Lm))
            if r<N[0]*0.8 or r>N[1]*1.25: issues.append((d['id'],d['name'],'stated ratio differs from the chart',f"says {N[0]:g}x{'-'+format(N[1],'g')+'x' if N[1]!=N[0] else ''}, chart {r:.2f}x"))
        elif Pm and not Lm and N:
            others=[mv[x] for x in open_ if x not in Pm]
            if others:
                r=(sum(mv[x] for x in Pm)/len(Pm))/min(others)
                if r<N[0]*0.8: issues.append((d['id'],d['name'],'stated ratio differs from the chart',f"says {N[0]:g}x vs the lowest months, chart {r:.2f}x"))
    # --- flat forms
    fm=re.search(r'fairly flat, with (?:a (\d+)% (dip|rise)|a slight (rise|dip)) at many hotels (.+?)(?:,|\.|$)',text)
    if fm:
        mths=expand(fm.group(4)); mths=[x for x in mths if x in open_]
        others=[x for x in open_ if x not in mths]
        if mths and others:
            a=sum(mv[x] for x in mths)/len(mths); b=sum(mv[x] for x in others)/len(others)
            delta=(a/b-1)*100
            kind=fm.group(2) or fm.group(3); claim=int(fm.group(1)) if fm.group(1) else None
            if kind=='dip' and (delta>-6): issues.append((d['id'],d['name'],'claimed dip not on the chart',f"{[MN[x][:3] for x in mths]} chart {delta:+.0f}%"))
            if kind=='rise' and (delta<6): issues.append((d['id'],d['name'],'claimed rise not on the chart',f"{[MN[x][:3] for x in mths]} chart {delta:+.0f}%"))
            if claim and kind=='dip' and abs(abs(delta)-claim)>10: issues.append((d['id'],d['name'],'dip size differs from the chart',f"says {claim}%, chart {abs(delta):.0f}%"))
    elif re.search(r'barely change',text):
        if hi/med>1.12 or med/lo>1.12: issues.append((d['id'],d['name'],'says barely changes but the chart moves',f"chart max/min {hi/lo:.2f}"))
    elif Pm is None and not re.search(r'apart from a spike|Cheltenham|closed',text):
        unparsed.append((d['id'],d['name'],s))
    # --- closures
    for cm in re.finditer(r'(Most hotels|About a third of hotels|Roughly half of hotels|About two thirds of hotels) close (?:from ([A-Za-z]+) to ([A-Za-z]+)|in ([A-Za-z]+))(?: and in ([A-Za-z]+))?',s):
        txt=' '.join(x for x in cm.groups()[1:] if x)
        mths=expand(('from '+cm.group(2)+' to '+cm.group(3)) if cm.group(2) else cm.group(4)+(' and '+cm.group(5) if cm.group(5) else ''))
        w=d['weeks']; cl=set()
        for k,x in enumerate(w):
            mm_=month_of((k+0.5)*7)
            if x is None or k in d.get('pt',[]): cl.add(mm_)
        # months mostly flagged
        flagged={m_ for m_ in range(12) if sum(1 for k in range(52) if month_of((k+0.5)*7)==m_ and (w[k] is None or k in d.get('pt',[])))>=2}
        if not set(mths)<=flagged: issues.append((d['id'],d['name'],'text says hotels close but the chart does not show it',f"{[MN[x][:3] for x in mths]} vs chart {[MN[x][:3] for x in sorted(flagged)]}"))
    flagged={m_ for m_ in range(12) if sum(1 for k in range(52) if month_of((k+0.5)*7)==m_ and (d['weeks'][k] is None or k in d.get('pt',[])))>=2}
    if flagged and not re.search(r'close',s) and not d['name'].startswith('Denali'): issues.append((d['id'],d['name'],'chart shows closed or faded months the text does not mention',str([MN[x][:3] for x in sorted(flagged)])))
    # --- holiday clause vs chart week 51
    w=d['weeks']
    if w[51] and w[47]:
        pre=[x for x in w[47:50] if x]; post=[x for x in w[1:4] if x]
        ref=max(sum(pre)/len(pre), (sum(post)/len(post)) if post else 0)
        rise=w[51]/ref
        says=re.search(r'winter holidays',s)
        if says and rise<1.08: issues.append((d['id'],d['name'],'text mentions a holiday rise the chart barely shows',f"late-Dec week {rise:.2f}x"))
        if not says and rise>=1.4 and not d.get('events'): issues.append((d['id'],d['name'],'chart shows a big late-December rise the text does not mention',f"{rise:.2f}x"))
    # --- events vs chart
    for ev in re.finditer(r'\((?:[A-Z][a-z]+ \d+ to \d+|April 9 to 11 and 16 to 18|late March to early April)\)',s):
        if not d.get('events'): issues.append((d['id'],d['name'],'text names an event the chart does not show',ev.group(0)))
json.dump(issues,open(R+'compare-issues.json','w'))
print(len(D),'cards;',len(issues),'discrepancies in',len({i[0] for i in issues}),'cards;',len(unparsed),'sentences not parsed')
import collections
print(collections.Counter(i[2] for i in issues))
for i in issues[:0]: print(i)
json.dump(unparsed,open(R+'compare-unparsed.json','w'))
