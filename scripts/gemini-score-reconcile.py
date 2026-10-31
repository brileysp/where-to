import json,statistics
def r1(x): return round(x*10)/10
def reconcile(ours,gem):
    """Returns (class, proposed 12 scores, gap). Owner-approved rule, 1 Nov 2026."""
    gap=statistics.mean(abs(a-b) for a,b in zip(gem,ours))
    flat=(max(ours)-min(ours))<0.3; gr=max(gem)-min(gem)
    if gap<=1.0: return 'keep',[r1(v) for v in ours],gap
    if flat and gr>=2:
        mid=(max(ours)+max(gem))/2; k=mid/max(gem) if max(gem)>0 else 1
        cls='shape' if gap<=2.5 else 'decide'
        return cls,[r1(v*k) for v in gem],gap
    prop=[r1((a+b)/2) for a,b in zip(ours,gem)]
    return ('middle' if gap<=2.5 else 'decide'),prop,gap
if __name__=='__main__':
    import collections
    R=json.load(open('batch1_checked.json')); S={(x['k'],x['id']):x for x in json.load(open('batch1_scores.json'))}
    c=collections.Counter()
    for r in R:
        s=S.get((r['k'],r['id']))
        if not s: continue
        cls,p,g=reconcile(r['curve'],s['scores']); c[cls]+=1
        if r['name'].startswith('Acadia') and r['k']=='museumsArt': print(cls,p,round(g,2))
    print(c)
