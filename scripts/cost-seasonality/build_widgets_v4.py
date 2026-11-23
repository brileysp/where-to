import json,html,math,collections,re
ROOT='/Users/brendansalant-pearce/Desktop/Claude Code/where-to-app/'
S='/private/tmp/claude-501/-Users-brendansalant-pearce-Desktop-Claude-Code/7967b631-7de4-44fc-a69e-c242cec19f01/scratchpad/'
M=json.load(open(S+'stats/master.json')); HS=json.load(open(S+'stats/hs_summaries.json'))
CONF={r['id']:r for r in json.load(open(ROOT+'.cache/hotel-confidence-rows.json'))}
MN=['January','February','March','April','May','June','July','August','September','October','November','December']
ml=[31,28,31,30,31,30,31,31,30,31,30,31]; ms=[sum(ml[:i]) for i in range(12)]; mid=[ms[i]+ml[i]/2 for i in range(12)]
def month_of(d):
    for i in range(11,-1,-1):
        if d>=ms[i]: return i
def fill(curve):
    c=list(curve); idx=[i for i,v in enumerate(c) if v is not None]
    for i in range(12):
        if c[i] is None:
            # circular linear interpolation
            lo=max([j for j in range(i-12,i) if c[j%12] is not None]); hi=min([j for j in range(i+1,i+13) if c[j%12] is not None])
            t=(i-lo)/(hi-lo); c[i]=c[lo%12]+(c[hi%12]-c[lo%12])*t
    return c
def rescale(c,S):
    lo,hi=min(c),max(c); r=hi/lo
    if r<1.02: return None
    p=math.log(S)/math.log(r)
    g=math.exp(sum(math.log(x) for x in c)/len(c))
    return [100*(x/g)**p for x in c]
def runs_of(flags):
    n=len(flags); out=[]; seen=set()
    for i in range(n):
        if flags[i] and not flags[(i-1)%n] :
            r=[];j=i
            while flags[j%n] and len(r)<n: r.append(j%n); j+=1
            out.append(r)
    if all(flags): out=[list(range(n))]
    return out
def phrase_run(r):
    names=[MN[i] for i in r]
    if len(r)==1: return names[0]
    if len(r)==2: return names[0]+' and '+names[1]
    return names[0]+' to '+names[-1]
def phrase(rs):
    if len(rs)==1:
        r=rs[0]
        return ('in '+phrase_run(r)) if len(r)<=2 else ('from '+MN[r[0]]+' to '+MN[r[-1]])
    flat_m=[i for r in rs for i in r]
    if len(flat_m)<=4:
        names=[MN[i] for i in flat_m]
        return 'in '+', '.join(names[:-1])+' and '+names[-1]
    parts=[('in '+phrase_run(r)) if len(r)<=2 else ('from '+MN[r[0]]+' to '+MN[r[-1]]) for r in rs]
    return ' and '.join(parts)
def pick(c,openm,top,frac=None):
    vals=[c[i] for i in range(12) if openm[i]]; lo,hi=min(vals),max(vals)
    thr=lo+0.8*(hi-lo) if top else lo+(frac or 0.2)*(hi-lo)
    flags=[openm[i] and ((c[i]>=thr) if top else (c[i]<=thr)) for i in range(12)]
    rs=runs_of(flags)
    rs.sort(key=lambda r:-max(c[i] for i in r) if top else min(c[i] for i in r))
    rs=rs[:2]
    # if one run is long (>6), shrink to the 4 most extreme months
    out=[]
    for r in rs:
        if len(r)>6:
            ex=max(r,key=lambda i:c[i]) if top else min(r,key=lambda i:c[i])
            win=[ex]
            while len(win)<4:
                pos=[r.index(i) for i in win]; cand=[]
                if min(pos)>0: cand.append(r[min(pos)-1])
                if max(pos)<len(r)-1: cand.append(r[max(pos)+1])
                if not cand: break
                nxt=max(cand,key=lambda i:c[i]) if top else min(cand,key=lambda i:c[i]); win.append(nxt)
            r=sorted(win,key=lambda i:r.index(i))
        out.append(r)
    out.sort(key=lambda r:r[0])
    return out
from decimal import Decimal,ROUND_HALF_UP

def widen_peak(rs,c,openm):
    vals=[c[i] for i in range(12) if openm[i]]; lo,hi=min(vals),max(vals)
    rs=[list(r) for r in rs]
    changed=True
    while changed and len(rs)>1:
        changed=False
        for a in range(len(rs)):
            for b in range(len(rs)):
                if a==b: continue
                gap=(rs[b][0]-rs[a][-1])%12
                if gap==2:
                    m=(rs[a][-1]+1)%12
                    if openm[m] and c[m]>=lo+0.4*(hi-lo) and c[m]>=0.9*min(max(c[i] for i in rs[a]),max(c[i] for i in rs[b])):
                        rs[a]=rs[a]+[m]+rs[b]; rs.pop(b); changed=True; break
            if changed: break
    return rs
def season_of(r,lat):
    ms=set(r)
    if lat>23.5 and len(r)>=3 and ms<={10,11,0,1,2}: return 'winter months'
    return None
def fmt_s(x):
    if x>=1.5: v=max(1.5,math.floor((x+0.17)/0.5)*0.5)
    else: v=round(x+1e-9,1)
    t=('%g'%v)
    return t+'x'
# --- special curves from the Agoda check
ag=collections.defaultdict(dict)
for l in open(S+'ag/results.txt'):
    p=l.strip().split('|')
    if len(p)==4 and p[3].isdigit(): ag[(p[0],p[1])][p[2]]=int(p[3])
DM={'2026-12-15':11,'2027-01-19':0,'2027-02-16':1,'2027-03-16':2,'2027-05-18':4,'2027-07-20':6,'2027-08-17':7,'2027-09-21':8,'2027-11-09':10}
def agoda_curve(place,hotels):
    per=collections.defaultdict(list)
    for h in hotels:
        s=ag[(place,h)]; g=math.exp(sum(math.log(v) for v in s.values())/len(s))
        for d,v in s.items(): per[DM[d]].append(math.log(v/g))
    c=[None]*12
    for m,l in per.items(): c[m]=100*math.exp(sum(l)/len(l))
    return fill(c)
SPECIAL={'Hokkaido':agoda_curve('hokkaido',['Furano Natulux','Windsor Toya','Sapporo Grand','Park Hyatt Niseko']),
         'Istanbul':agoda_curve('istanbul',['Four Seasons Bosphorus','Ciragan','Peninsula'])}
RENAMED=['Myanmar','Cambodia','Laos','Wales','Northern Ireland','French Polynesia','Aspen Snowmass','Banff','Napa','Northern Tanzania','Komodo','Kruger','Vancouver','El Chalt']
SRC={'Official statistics':'official hotel statistics','Booking.com only':'Booking.com','Booking.com and Expedia agree':'Booking.com and Expedia','Booking.com, Expedia and outside checks':'Booking.com, Expedia and outside checks','Safari lodge rate cards':'lodge rate cards','Booking.com and rate cards agree':'Booking.com and lodge rate cards','Lodge rate cards only':'lodge rate cards','Booking.com, checked against official figures':'Booking.com and official figures'}
PL={p['name']:p for p in json.load(open(ROOT+'.cache/place-rows.json'))}
import glob
PARTS={}
for f_ in glob.glob(ROOT+'scripts/data/hotel-quote-panel-nov14-part*.json'):
    for k_,p_ in json.load(open(f_))['places'].items(): PARTS[k_]=p_
POS=[3,4,5,6,7,8,9,10,11,12,13,0]
def gm_curve(p,keep=None,min_h=3):
    rows=[]
    for h,v in p['hotels'].items():
        if keep and not keep(h): continue
        pr=[None if x=='-' else float(x) for x in v.split('/')]
        used=[pr[i] for i in POS if pr[i]]
        if len(used)<5: continue
        med=sorted(used)[len(used)//2]
        pr=[x if (x and med/2.2<=x<=med*2.2) else None for x in pr]      # drop placeholder prices
        used=[pr[i] for i in POS if pr[i]]
        if len(used)<5: continue
        g=math.exp(sum(math.log(x) for x in used)/len(used))
        rows.append([None if pr[i] is None else pr[i]/g for i in POS])
    out=[]
    for m in range(12):
        v=[r_[m] for r_ in rows if r_[m]]
        out.append(None if len(v)<min_h else 100*math.exp(sum(math.log(x) for x in v)/len(v)))
    if any(x is None for x in out) and sum(x is None for x in out)<=3:
        out=fill(out)
    return out
def corr_(a,b):
    ma=sum(a)/12; mb=sum(b)/12
    cov=sum((x-ma)*(y-mb) for x,y in zip(a,b)); va=sum((x-ma)**2 for x in a); vb=sum((y-mb)**2 for y in b)
    return cov/math.sqrt(va*vb) if va*vb>0 else 0
FLAGGED={'Bhutan','Death Valley National Park','El Chaltén & El Calafate'}
INPARK=('The Inn at Death Valley','The Ranch At Death Valley','Stovepipe Wells Village')
drafts=[]
for r in M:
    if r['tier'] not in ('Fair','Reliable','Very reliable'): continue
    name=r['name']; best=r['best']; cid=r['id']; conf=CONF.get(cid); hs=HS.get(conf['key']) if conf else None
    closed=set(); note=''; special=''
    curve=r['curve']
    GM=False
    if conf and conf['key'] in PARTS and curve and r['src'] not in ('Official statistics','Safari lodge rate cards','Lodge rate cards only') and not name.startswith('Denali'):
        g_=gm_curve(PARTS[conf['key']],(lambda h:h in INPARK) if name=='Death Valley National Park' else None, 2 if name=='Death Valley National Park' else 3)
        if all(v is not None for v in g_) and all(v is not None for v in curve):
            if name in FLAGGED or (int(cid[1:])>96 and corr_(curve,g_)<0.6):
                curve=g_; GM=True
                if name in FLAGGED:
                    sw_=max(g_)/min(g_); best=round(sw_*20)/20
    if name=='Dubai':
        curve=list(curve); curve[11]=curve[10]
        special='December is set equal to November: our one mid-December quote (the lowest of the year) looks wrong, and Wego\'s booking data for the 12 months to August 2026 has December as Dubai\'s priciest month (about $256 a night against $106 in June).'
    if name=='Belize':
        curve=[112,120,112,98,98,98,98,98,98,98,98,98]; best=1.22
        special='Raised from our Booking.com quotes (about +7 to 15% from late December to March) to about +15%, in line with outside sources that put the December to April premium at 20 to 30%.'
    if name=='Cotswolds':
        curve=list(curve); curve[2]=(curve[1]+curve[3])/2     # the 16 March spike is Cheltenham Festival week, handled as an event
        best=round(max(curve)/min(curve)*20)/20
    # closures: only where the flag is real and the source is a Booking.com panel
    if hs and hs['closedMonths'] and r['src']!='Official statistics' and name in ('Amalfi Coast','Ladakh'):
        closed={m-1 for m in hs['closedMonths']}
    CAND=json.load(open(S+'stats/closure_candidates.json'))
    partly={}
    for mon,sh in CAND.get(name,[]):
        mi=MN.index([x for x in MN if x.startswith(mon)][0])
        if sh>=75: closed.add(mi)
        else: partly[mi]=sh
    for mi in list(partly):
        if mi in closed: partly.pop(mi)
    openm=[i not in closed for i in range(12)]
    window=None
    if name=='Denali & the Interior':
        curve=[None,None,None,None,100,154,154,154,100,None,None,None]; closed={0,1,2,3,9,10,11}; openm=[i not in closed for i in range(12)]
        window=(135,258); special='Rough shape: four lodges\' rate cards give the peak and the size of the swing, not monthly prices.'
    if name in SPECIAL: curve=SPECIAL[name]; special='Shape from the Agoda check (nine dates), then stretched to our estimate.'
    if name=='Atacama Desert':
        curve=[138,138,116,116,100,100,100,100,100,116,138,138]; best=1.38
        special='Season dates and sizes from Awasi Atacama\'s 2026-27 rate sheet (high season November to February is about 1.4 times off-peak May to September, shoulder October, March and April about 1.15 times). Nayara and Explora assumed similar.'
    # curve to 12 filled values over open months
    if name!='Denali & the Interior':
        if closed:
            cc=[curve[i] if openm[i] else None for i in range(12)]
            vals=[v for v in cc if v is not None]
            # months open but missing: interpolate within the open months only
            for i in range(12):
                if openm[i] and cc[i] is None: cc[i]=sum(vals)/len(vals)
            c12=cc
        else:
            c12=fill(curve) if any(v is None for v in curve) else list(curve)
    else: c12=curve
    # stretch to the estimate
    vals=[c12[i] for i in range(12) if openm[i]]
    S_=best
    if closed and name=='Ladakh':
        # open months barely move; keep the measured shape unstretched
        S_=max(vals)/min(vals)
    sc=None
    if name=='Denali & the Interior':
        sc=c12
    else:
        tmp=[c12[i] if openm[i] else vals[0] for i in range(12)]
        rs=rescale(tmp,S_) if S_>1.02 else None
        if rs is None:
            # curve too flat to stretch: take months from the earlier research if we have them
            if S_>=1.12:
                MS3=[x[:3] for x in MN]; pk=[MS3.index(x) for x in r['oldPeak']]; lw=[MS3.index(x) for x in r['oldLow']]
                base=[100]*12
                for i in pk: base[i]=100*S_
                special=(special+' ' if special else '')+'Shape taken from the earlier month research; the measured curve was too flat to use.'
                tmp=base; rs=tmp
            else: rs=[100]*12
        sc=[rs[i] if openm[i] else None for i in range(12)]
    vals=[v for v in sc if v is not None]; lo,hi=min(vals),max(vals); swing=hi/lo
    flat=swing<1.12
    # December holiday
    spike=None; hol=False
    if hs and not closed:
        h=hs['holiday']; cand=[(h['dec29'],h['n29']),(h['dec31'],h['n31'])]
        cand=[(v,n) for v,n in cand if v is not None and n>=5]
        base=[x for x in (hs['months'][11],hs['months'][0]) if x]
        if cand and base:
            spike=max(v for v,_ in cand)/(sum(base)/len(base))
    if name=='Belize' and hs and not closed: spike=max(spike or 0,1.15)
    chk=False
    lat=PL.get(name,{}).get('latitude') or 0
    openidx=[i for i in range(12) if openm[i]]
    vals_o=[sc[i] for i in openidx]; lo_,hi_=min(vals_o),max(vals_o); rng=hi_-lo_
    def circ(sel): return runs_of([i in sel for i in range(12)])
    Pset={i for i in openidx if sc[i]>=lo_+0.75*rng}
    for i in openidx:
        if i in Pset or sc[i]<lo_+0.45*rng: continue
        l_=sc[(i-1)%12] if openm[(i-1)%12] else -1; r_=sc[(i+1)%12] if openm[(i+1)%12] else -1
        if sc[i]>=l_*1.04 and sc[i]>=r_*1.04 and sc[i]>=1.03*sorted(vals_o)[len(vals_o)//2] and all(min((i-j)%12,(j-i)%12)>=2 for j in Pset): Pset.add(i)
    _med=sorted(vals_o)[len(vals_o)//2]
    _cand={i for i in openidx if i not in Pset and sc[i]>=lo_+0.45*rng}
    for _run in [r_ for r_ in circ(_cand) if len(r_)>=2]:
        _mx=max(sc[i] for i in _run)
        _lf=(_run[0]-1)%12; _rt=(_run[-1]+1)%12
        l_=sc[_lf] if openm[_lf] else -1; r_=sc[_rt] if openm[_rt] else -1
        if _mx>=l_*1.04 and _mx>=r_*1.04 and _mx>=1.08*_med and all(min((i-j)%12,(j-i)%12)>=2 for i in _run for j in Pset):
            for i in _run:
                if sc[i]>=_mx*0.9: Pset.add(i)
    for _i in [i for i in list(Pset) if sc[i]<lo_+0.75*rng]:      # a secondary peak takes in a neighbouring month at nearly the same level (Hokkaido July and August)
        for _j in ((_i-1)%12,(_i+1)%12):
            if openm[_j] and _j not in Pset and sc[_j]>=0.9*sc[_i] and sc[_j]>=lo_+0.45*rng: Pset.add(_j)
    pk=widen_peak(circ(Pset),sc,openm)
    Pm=sorted({i for r_ in pk for i in r_})
    Lset={i for i in openidx if i not in Pm and sc[i]<=lo_+0.2*rng}
    lowruns=circ(Lset); lowruns.sort(key=lambda r_:sum(sc[i] for i in r_)/len(r_)); lowruns=lowruns[:2]; lowruns.sort(key=lambda r_:r_[0])
    Lm=sorted({i for r_ in lowruns for i in r_})
    if len(Lm)==1:                      # one outlier month is not a low season: widen to the neighbouring cheap months
        Lset={i for i in openidx if i not in Pm and sc[i]<=lo_+0.35*rng}
        lowruns=circ(Lset); lowruns.sort(key=lambda r_:sum(sc[i] for i in r_)/len(r_)); lowruns=lowruns[:2]; lowruns.sort(key=lambda r_:r_[0])
        Lm=sorted({i for r_ in lowruns for i in r_})
    def rtxt_(r_):
        nm=[MN[i] for i in r_]
        return nm[0] if len(nm)==1 else (nm[0]+' and '+nm[1] if len(nm)==2 else nm[0]+' to '+nm[-1])
    N=(sum(sc[i] for i in Pm)/len(Pm))/(sum(sc[i] for i in Lm)/len(Lm)) if Pm and Lm else best
    nonP=[i for i in openidx if i not in Pm]
    if len(Pm)>=8: kind='dip'
    elif N<1.25: kind='flat'
    else: kind='ratio'
    if kind=='dip':
        pass
    if Lm and not [i for i in nonP if i not in Lm]: lowp='in the rest of the year'
    elif closed and name!='Denali & the Interior': lowp='in the shoulder months'
    elif lat>23.5 and len(Lm)>=3 and set(Lm)<={10,11,0,1,2} and not (set(Pm)&{10,11,0,1,2}): lowp='in winter months'
    elif Lm and len(lowruns)>1 and len(Lm)<=4:
        nm_=[MN[i] for i in Lm]; lowp='in '+', '.join(nm_[:-1])+' and '+nm_[-1]
    elif Lm: lowp='in '+' and '.join(rtxt_(r_) for r_ in lowruns)
    else: lowp='in the rest of the year'
    RT=fmt_s(N); RANGE=False
    if len(Lm)==1 and Pm and best>=1.8:
        pl_=sum(sc[i] for i in Pm)/len(Pm); mn_=sc[Lm[0]]
        oth=sorted(sc[i] for i in openidx if i not in Pm and i!=Lm[0])[:3]; sh_=sum(oth)/len(oth) if oth else mn_
        lo_txt=fmt_s(pl_/sh_)[:-1]; hi_txt=fmt_s(pl_/mn_)[:-1]
        if lo_txt!=hi_txt: RT=f"{lo_txt}x to {hi_txt}x"
        RANGE=True; lowp='in the shoulder months'
    chk=(not Lm) or (abs(N/best-1)>0.35)
    decJan_in_peak=any(11 in r_ and 0 in r_ for r_ in pk)
    exempt=decJan_in_peak
    if kind in ('flat','dip') and not (Pm and Lm): exempt=False
    elif kind in ('flat','dip'):
        _mP=sum(sc[i] for i in Pm)/len(Pm); _mL=sum(sc[i] for i in Lm)/len(Lm)
        _nonL=[sc[i] for i in openidx if i not in Lm]; _nonP=[sc[i] for i in nonP]
        _dip=(1-_mL/(sum(_nonL)/len(_nonL)))*100 if _nonL else 0
        if kind=='dip': _dip=(1-_mL/_mP)*100
        _rise=(_mP/(sum(_nonP)/len(_nonP))-1)*100 if _nonP else 0
        exempt=decJan_in_peak and not (kind=='dip' or _dip>=_rise)
    if exempt and spike and spike>=1.5: exempt=False
    if spike and spike>=1.3 and not exempt: hol=True
    sp_=spike or 0
    VERB='spike' if sp_>=2.0 else ('jump' if sp_>=1.5 else None)
    XM=(f', and prices {VERB} around the winter holidays.' if VERB else ', and prices increase a bit around the winter holidays.')
    APART=(f', apart from a {VERB} around the winter holidays.' if VERB else ', apart from a small increase around the winter holidays.')
    def r5(x): return int(round(x/5.0))*5
    # sentence
    if name=='Denali & the Interior':
        sent="Hotels and lodges open from mid-May to mid-September, and many cost about "+fmt_s(best)+" as much in June to August as at the start and end of the season."
    elif kind=='dip' or kind=='flat':
        if hol and 11 in Lm and len(Lm)>2:        # the holiday clause covers late December; do not also call December a dip
            _L2=[m_ for m_ in Lm if m_!=11]; _o=[sc[i] for i in openidx if i not in Lm]; _o2=[sc[i] for i in openidx if i not in _L2]
            _d1=1-(sum(sc[i] for i in Lm)/len(Lm))/(sum(_o)/len(_o)) if _o else 0
            _d2=1-(sum(sc[i] for i in _L2)/len(_L2))/(sum(_o2)/len(_o2)) if _o2 else 0
            if _d2>=_d1-0.03:
                Lm=_L2
                lowruns=[[m_ for m_ in r_ if m_!=11] for r_ in lowruns]; lowruns=[r_ for r_ in lowruns if r_]
        mP=sum(sc[i] for i in Pm)/len(Pm); mL=(sum(sc[i] for i in Lm)/len(Lm)) if Lm else mP
        nonL=[sc[i] for i in openidx if i not in Lm]; nonPv=[sc[i] for i in nonP]
        dip=(1-mL/(sum(nonL)/len(nonL))*1.0)*100 if nonL else 0
        if kind=='dip': dip=(1-mL/mP)*100
        rise=(mP/(sum(nonPv)/len(nonPv))-1)*100 if nonPv else 0
        if max(dip,rise)<=10:
            sent="Hotel prices barely change from month to month"+(APART if hol else ".")
        elif hol and VERB=='spike' and max(dip,rise)<=20:
            sent="Hotel prices are fairly flat, apart from a spike around the winter holidays."
        elif kind=='dip' or dip>=rise:
            sent=f"Hotel prices are fairly flat, with a {r5(dip)}% dip at many hotels {phrase(lowruns) if lowruns else 'in winter'}"+(XM if hol else ".")
        else:
            rtxt=('a slight rise' if rise<=20 else f"a {r5(rise)}% rise")
            pk_r=[r_ for r_ in pk if not (hol and r_==[11])]
            if pk_r:
                sent=f"Hotel prices are fairly flat, with {rtxt} at many hotels {phrase(pk_r)}"+(XM if hol else ".")
            else:
                sent="Hotel prices are fairly flat"+APART
        if closed:
            cr=runs_of([not o for o in openm])[0]; sent=sent[:-1]+f". Most hotels close from {MN[cr[0]]} to {MN[cr[-1]]}."
    else:
        SP={2,3,4}; FA={8,9,10}
        clear=N>=1.6 and len(Pm)<=6
        _sf=[i for i in SP|FA if openm[i]]
        _sfok=bool(Lm) and bool(_sf) and fmt_s((sum(sc[i] for i in _sf)/len(_sf))/(sum(sc[i] for i in Lm)/len(Lm)))==fmt_s(N)
        if lat>23.5 and len(pk)==2 and set(pk[0])<=SP and set(pk[1])<=FA and _sfok:
            sent=f"Prices peak in spring and fall, when many hotels cost about {RT} as much as {lowp}"+(XM if hol and VERB=='spike' else ".")
            if hol and VERB!='spike': sent+=f" Prices also {VERB or 'increase a bit'} around the winter holidays."
        elif clear:
            sent=f"Prices peak {phrase(pk)}, with many hotels costing about {RT} as much as {lowp}"
            if hol and VERB=='spike': sent+=XM
            else:
                sent+="."
                if hol: sent+=f" Prices also {VERB or 'increase a bit'} around the winter holidays."
        else:
            sent=f"Many hotels cost about {RT} as much {phrase(pk)} as {lowp}"+(XM if hol else ".")
        if closed:
            cr=runs_of([not o for o in openm])[0]
            sent=sent.rstrip()+f" Most hotels close from {MN[cr[0]]} to {MN[cr[-1]]}."
    def runs_months(ms_):
        ms_=sorted(ms_); out=[]
        for m_ in ms_:
            if out and m_==out[-1][-1]+1: out[-1].append(m_)
            else: out.append([m_])
        if len(out)>1 and out[0][0]==0 and out[-1][-1]==11: out[0]=out[-1]+out[0]; out.pop()
        return out
    def cl_phrase(r_):
        return 'in '+MN[r_[0]] if len(r_)==1 else ('from '+MN[r_[0]]+' to '+MN[r_[-1]])
    if partly and not closed:
        rr=runs_months(partly.keys())
        avg_sh=sum(partly.values())/len(partly)
        q='About a third of hotels' if avg_sh<42 else ('Roughly half of hotels' if avg_sh<58 else 'About two thirds of hotels')
        sent=sent+' '+q+' close '+' and '.join(cl_phrase(r_) for r_ in rr)+'.'
    elif partly and closed and name=='Acadia National Park':
        sent=sent.replace('. Most hotels close from December to March.','. Most hotels close from December to March (about a third are still closed in April).',1)
    # weekly series
    w=[]; ptw=[]; holchart=False
    for k in range(52):
        d=(k+0.5)*7
        if window and not (window[0]<=d<=window[1]): w.append(None); continue
        m=month_of(d)
        if not openm[m]: w.append(None); continue
        v=sc[m]; j=m+1 if d>mid[m] else m-1
        if 0<=j<12 and sc[j] is not None and openm[j]:
            t=abs(d-mid[m])/abs(mid[j]-mid[m]); t=(1-math.cos(math.pi*t))/2
            v=sc[m]+(sc[j]-sc[m])*t*0.5
        elif 0<=j<12 and name in('Hokkaido',): pass
        if j==-1 or j==12:
            jj=j%12
            if sc[jj] is not None and openm[jj]:
                dd=d if j==12 else d+365
                t=abs(d-mid[m])/ (365-mid[11]+mid[0]) if True else 0
                t=min(1,max(0,(1-math.cos(math.pi*t))/2))
                v=sc[m]+(sc[jj]-sc[m])*t*0.5
        w.append(v)
        if month_of(d) in partly: ptw.append(k)
    if hol:
        f=min(spike,2.0); base_lvl=w[51]
        if w[51] is not None: w[51]*=f
        if w[0] is not None: w[0]*=1+(f-1)/2
    elif hs and not closed:
        h_=hs['holiday']; cd=[v for v,n in ((h_['dec29'],h_['n29']),(h_['dec31'],h_['n31'])) if v is not None and n>=5]
        d15=hs['months'][11]
        if cd and d15 and spike and spike>=1.05:
            f=min(spike,2.0); holchart=True
            if w[51] is not None: w[51]*=f
            if w[50] is not None: w[50]*=1+(f-1)/2
    area=hs['area'] if hs else ''
    drafts.append(dict(id=cid,name=name,tier=r['tier'],score=r['score'],best=best,src=SRC.get(r['src'],r['src']),sent=sent,weeks=[None if x is None else round(x,1) for x in w],closed=sorted(closed),flat=flat,hol=hol,spike=None if spike is None else round(spike,2),area=area,special=special,R=round((N if kind=='ratio' else hi_/lo_),2),kind=kind,sc=[None if v is None else round(v,1) for v in sc],pt=ptw,holchart=holchart,check=bool(chk),renamed=any(name.startswith(x) for x in RENAMED),ssw=round(swing,2)))
json.dump(drafts,open(ROOT+'.cache/cost-seasonality-drafts-v4.json','w'),ensure_ascii=False)
print(len(drafts),'drafts;','holiday clause',sum(d['hol'] for d in drafts),'flat',sum(d['flat'] for d in drafts),'closed',sum(1 for d in drafts if d['closed']),'special',sum(1 for d in drafts if d['special']))
for d in drafts[:6]: print(d['name'],'|',d['sent'])
