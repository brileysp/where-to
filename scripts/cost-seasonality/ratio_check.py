import json,re,math,sys
R='/Users/brendansalant-pearce/Desktop/Claude Code/where-to-app/.cache/'
V={d['id']:d for d in json.load(open(R+'cost-seasonality-drafts-v4.json'))}
C=json.load(open(R+'cost-seasonality-drafts.json'))
MN=['January','February','March','April','May','June','July','August','September','October','November','December']
def fmt(x):
    if x>=1.5: return max(1.5,math.floor((x+0.17)/0.5)*0.5)
    return round(x+1e-9,1)
def expand(txt):
    if 'spring and fall' in txt: return [2,3,4,8,9,10]
    toks=re.findall(r'(January|February|March|April|May|June|July|August|September|October|November|December|\bto\b)',txt)
    out=[];i=0
    while i<len(toks):
        t=toks[i]
        if t=='to': i+=1; continue
        a=MN.index(t)
        if i+2<len(toks) and toks[i+1]=='to' and toks[i+2]!='to':
            b=MN.index(toks[i+2]);k=a
            while True:
                out.append(k)
                if k==b: break
                k=(k+1)%12
            i+=3
        else: out.append(a); i+=1
    return sorted(set(out))
def parse(s):
    """returns (P months text, N string, low text) for the main sentence"""
    main=re.split(r'(?<!vs)\. ',s)[0]
    if not main.endswith('.'): main+='.'
    m=re.search(r'Prices peak (?:in|from) (.+?),? (?:and can be|with many hotels (?:costing |at )?about|where they cost about|when many hotels cost about) ?~?([\d.]+)x(?: as much)? ?(?:as )?(.*?)(?:, and| and prices|\.$)',main)
    if m: return m.group(1),m.group(2),m.group(3)
    m=re.search(r'Many hotels cost about ([\d.]+)x as much (?:in|from) (.+?) (?:as|vs\.) (?:in )?(.*?)(?:, and prices|\.$)',main)
    if m: return m.group(2),m.group(1),m.group(3)
    return None
def group_ratio(c,v,Ptxt,low,stated=None):
    sc=v['sc']; open_=[k for k in range(12) if sc[k] is not None]
    P=[k for k in expand(Ptxt) if sc[k] is not None]
    lw=low.rstrip('.')
    def ratio(L):
        return (sum(sc[k] for k in P)/len(P))/(sum(sc[k] for k in L)/len(L))
    if 'rest of the year' in lw: L=[k for k in open_ if k not in P]; alts=[L]
    elif lw.strip() in ('winter','in winter') or 'winter months' in lw:
        a=[k for k in (11,0,1) if sc[k] is not None]; b=[k for k in (10,11,0,1,2) if sc[k] is not None]
        alts=[b,a]; L=b
    elif 'shoulder' in lw: return None
    else: L=[k for k in expand(lw) if sc[k] is not None]; alts=[L]
    alts=[x for x in alts if x]
    if not P or not alts: return None
    rs=[ratio(x) for x in alts]
    if stated is not None:
        for r in rs:
            if fmt(r)==float(stated): return r,P,alts[0]
    return rs[0],P,alts[0]
if __name__=='__main__':
    lim=int(sys.argv[1]) if len(sys.argv)>1 else 96
    for c in C:
        if int(c['id'][1:])>lim: continue
        p=parse(c['sent'])
        if not p: print('NOPARSE',c['name'],'|',c['sent']); continue
        r=group_ratio(c,V[c['id']],p[0],p[2],p[1])
        if not r: print('SKIP',c['name'],'|',p); continue
        t,P,L=r
        if fmt(t)!=float(p[1]): print(f"{c['name']:34s} stated {p[1]:>4}x  true {t:.2f}->{fmt(t)}x  low='{p[2]}'  {'REVIEWED-EDITED' if c.get('edited') else ''}")
