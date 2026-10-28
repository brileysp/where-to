import urllib.parse,urllib.request,json,time
def api(p):
    u='https://en.wikipedia.org/w/api.php?'+urllib.parse.urlencode({**p,'format':'json'})
    return json.load(urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'WhereToApp-research/1.0 (brileysp@gmail.com)'}),timeout=60))
titles=[]
for y in range(1990,2027):
    titles+= [f'{y} Open Championship',f'{y} U.S. Open (golf)',f'{y} PGA Championship']
for y in [1991,1993,1995,1997,1999,2002,2004,2006,2008,2010,2012,2014,2016,2018,2021,2023,2025,2027]: titles.append(f'{y} Ryder Cup')
for y in [1994,1996,1998,2000,2003,2005,2007,2009,2011,2013,2015,2017,2019,2022,2024,2026]: titles.append(f'{y} Presidents Cup')
titles+=['Kasumigaseki Country Club','Le Golf National','Olympic Golf Course','Augusta National Golf Club']
res={}
for i in range(0,len(titles),40):
    ch=titles[i:i+40]
    d=api({'action':'query','titles':'|'.join(ch),'prop':'coordinates','redirects':1,'colimit':'max'})
    for p in d['query']['pages'].values():
        res[p['title']]=(p['coordinates'][0]['lat'],p['coordinates'][0]['lon']) if p.get('coordinates') else None
    time.sleep(0.3)
miss=[t for t,v in res.items() if v is None]
print(len(res),'pages;',len(miss),'without coordinates:',miss[:40])
json.dump(res,open('venues2.json','w'),indent=1)
