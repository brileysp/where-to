import json,sys,re,math
sys.path.insert(0,'/tmp')
import ratio_check as rc
R=rc.R
C=json.load(open(R+'cost-seasonality-drafts.json'))
V=rc.V
fmt=rc.fmt
def lvl(b):
    return 'Flat' if b<1.12 else 'Mild' if b<1.31 else 'Moderate' if b<1.63 else 'High' if b<2.03 else 'Extreme'
def num(x): return (str(int(x)) if float(x).is_integer() else str(x))+'x'
FLAT_USE_V4={'Cusco & Sacred Valley','Atacama Desert','Bahamas','Canary Islands','Cape Town','Champagne','Guilin & Yangshuo','Hong Kong','Jamaica','Lake District'}
MANUAL={'Assam & Northeast India':"Hotel prices are fairly flat, with a slight rise at many hotels in December. Kaziranga National Park is closed from June to September for the monsoon, and a few lodges close with it.",
        'Dolomites':"Hotel prices are fairly flat, with a slight rise at many hotels in February, July and August."}
HOLCLAUSE={'Big Island':'jump'}
if __name__=='__main__':
    log=[]
    for c in C:
        i=c['id']; n=int(i[1:])
        if n>96: continue
        v=V[i]; old=c['sent']
        if c['name'] in ('Belize','Atacama Desert','Cusco & Sacred Valley'):
            c['weeks']=v['weeks']; c['sc']=v['sc']; c['spike']=v['spike']; c['holchart']=v['holchart']; c['special']=v['special']
        # late-December weeks follow the new rule where the old bump disagreed with the measured spike
        for k in (50,51,0):
            x,y=c['weeks'][k],v['weeks'][k]
            if x and y and abs(x/y-1)>0.12: c['weeks'][k]=y
        new=old
        if c['name'] in MANUAL: new=MANUAL[c['name']]
        elif c['name'] in FLAT_USE_V4: new=v['sent']
        else:
            p=rc.parse(old)
            if p:
                r=rc.group_ratio(c,v,p[0],p[2],p[1])
                if r:
                    t=r[0]; tgt=fmt(t)
                    if tgt!=float(p[1]):
                        new=re.sub(r'(?<![\d.])'+re.escape(p[1])+r'x',num(tgt),old,count=1)
        if c['name'] in HOLCLAUSE and 'holiday' not in new:
            parts=re.split(r'(?<=\.) ',new); main=parts[0].rstrip('.')
            parts[0]=main+f", and prices {HOLCLAUSE[c['name']]} around the winter holidays."
            new=' '.join(parts)
        if new!=old:
            log.append((c['name'],old,new)); c['sent']=new
        # badge follows the stated ratio
        p=rc.parse(c['sent'])
        if p:
            try: c['badge']=lvl(fmt(float(p[1])))
            except: pass
        elif c['name'] in FLAT_USE_V4 or c['name'] in MANUAL:
            c['badge']=lvl(fmt(v['R']))
    json.dump(C,open(R+'cost-seasonality-drafts.json','w'),ensure_ascii=False)
    json.dump(log,open(R+'compare-changes.json','w'),ensure_ascii=False,indent=1)
    print(len(log),'sentences changed')
    for n,o,nw in log: print('-',n,'\n    was:',o,'\n    now:',nw)
