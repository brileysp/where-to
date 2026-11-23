"""Writes src/lib/cost-seasonality/cards.generated.json from the reviewed drafts: one small card per place, keyed by place key.
Fields: s sentence, b badge word, w 52 bar heights (percent of the tallest week, null = closed), p weeks drawn faded (some hotels closed), a average-price line (percent)."""
import json
ROOT='/Users/brendansalant-pearce/Desktop/Claude Code/where-to-app/'
D=json.load(open(ROOT+'.cache/cost-seasonality-drafts.json'))
def level(b):
    return 'Flat' if b<1.12 else 'Mild' if b<1.31 else 'Moderate' if b<1.63 else 'High' if b<2.03 else 'Extreme'
out={}
for d in D:
    w=d['weeks']; vals=[x for x in w if x is not None]; mx=max(vals)
    n=len(vals); skip=(0,51) if d['hol'] else ()
    avg=sum(v for k,v in enumerate(w) if v is not None and k not in skip)/max(1,n-len([k for k in skip if w[k] is not None]))
    out[d['id']]={'s':d['sent'],'b':d.get('badge') or level(d['best']),
                  'w':[None if x is None else max(3,round(x/mx*100)) for x in w],
                  'p':sorted(d.get('pt',[])),'a':round(avg/mx*100)}
json.dump(out,open(ROOT+'src/lib/cost-seasonality/cards.generated.json','w'),ensure_ascii=False,separators=(',',':'))
print(len(out),'cards written')
