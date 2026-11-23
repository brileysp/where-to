import json,math,sys
R='/Users/brendansalant-pearce/Desktop/Claude Code/where-to-app/.cache/'
cur={d['id']:d for d in json.load(open(R+'cost-seasonality-drafts.json'))}
v4=json.load(open(R+'cost-seasonality-drafts-v4.json'))
REGEN={'p0028','p0033','p0047','p0051','p0053','p0055','p0057','p0059','p0060','p0063','p0069','p0080','p0082','p0090','p0096'}
TEXT={'p0033':"Prices peak in March and November, with many hotels costing about 1.5x as much as in April to September, and prices spike around the winter holidays.",
 'p0057':"Many hotels cost about 1.4x as much in February, July and August as in the rest of the year.",
 'p0047':"Hotel prices are fairly flat, apart from a spike around the winter holidays."}
def fmt(x):
    if x>=1.5: return max(1.5,math.floor((x+0.17)/0.5)*0.5)
    return round(x+1e-9,1)
def level(b):
    if b<1.12: return 'Flat'
    if b<1.31: return 'Mild'
    if b<1.63: return 'Moderate'
    if b<2.03: return 'High'
    return 'Extreme'
def bump(d,a,b,f):
    for k in range(a,b+1):
        if d['weeks'][k] is not None: d['weeks'][k]=round(d['weeks'][k]*f,1)
EV={'Singapore':([(40,40,2.9)]," During the Singapore Grand Prix weekend (October 8 to 10), many hotels cost about 3x as much."),
    'Tokyo & Kyoto':([(12,13,2.0)]," During cherry blossom season (late March to early April), many hotels cost about 2x as much."),
    'Rio de Janeiro':([(5,5,1.6)]," During Carnival (February 5 to 10), many hotels cost about 1.5x to 2x as much."),
    'New Orleans':([(4,4,1.5),(5,5,2.1)]," During Mardi Gras (February 3 to 9), many hotels cost about 2x as much."),
    'Nice & the French Riviera':([(18,18,2.0),(19,19,3.0),(20,20,2.0)]," The spike in mid-May is the Cannes Film Festival (May 11 to 22), when hotels in Cannes cost about 4x as much; Nice hotels barely change."),
    'Mexico City':([(43,43,2.5)]," During the Mexican Grand Prix and Day of the Dead (October 29 to November 2), many hotels cost about 2.5x as much."),
    'Palm Springs & Joshua Tree':([(14,15,2.0)]," Most hotels sell out during Coachella (April 9 to 11 and 16 to 18), and those left cost about 2x as much.")}
FACT=json.load(open(R+'cost-seasonality-fixes.json')) if len(sys.argv)>1 and sys.argv[1]=='fixes' else {}
out=[]
for d in v4:
    i=d['id']; n=int(i[1:]); c=cur[i]
    if n<=96 and i not in REGEN: out.append(c); continue
    d['reviewed']=(n<=96); d['edited']=False
    if i in TEXT: d['sent']=TEXT[i]; d['edited']=True
    d['badge']=level(fmt(d['R']))
    if d['name'] in EV:
        ev,txt=EV[d['name']]; d['events']=ev
        for a,b,f in ev: bump(d,a,b,f)
        d['sent']=d['sent']+txt
    if i=='p0051':
        d['events']=[(10,11,1.5)]; bump(d,10,11,1.5)
        d['sent']="Hotel prices are fairly flat, apart from Cheltenham Festival week (March 16 to 19), when many hotels sell out and those left cost about 1.5x as much."; d['edited']=True
    if i=='p0131': d['special']="Prices rechecked on Expedia for Hunza (12 dates), Skardu and Swat as well as Islamabad: flat in all four. About half of Skardu's hotels drop off the site from January to April."
    if i=='p0055': d['special']="Shape from the three hotels inside the park (the Inn, the Ranch and Stovepipe Wells); the other seven in the earlier panel are in Pahrump, Big Pine and Lone Pine and barely change."
    if i=='p0028': d['special']="Shape from the same-hotel index (the earlier index was flat); peak seasons and discounts match published guides."
    if i=='p0063': d['special']="Shape from the same-hotel index; hotel counts also fall by about half from June to September."
    out.append(d)
json.dump(out,open(R+'cost-seasonality-drafts.json','w'),ensure_ascii=False)
print(len(out),'cards written')
