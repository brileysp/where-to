# How src/lib/onboarding/world-map-data.ts was made: download https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json as world110.json,
# split Russia and Turkey at the Urals and the Bosphorus, project to a 720 by 284 equirectangular map, and merge the countries of each region
# into one path (no borders). Kept for the record; the generated file is what the app uses.
import json
t=json.load(open('world110.json'))
sc=t['transform']['scale']; tr=t['transform']['translate']
arcs=[]
for a in t['arcs']:
    x=y=0; pts=[]
    for dx,dy in a:
        x+=dx; y+=dy; pts.append((x*sc[0]+tr[0], y*sc[1]+tr[1]))
    arcs.append(pts)
def arc(i): return arcs[i] if i>=0 else arcs[~i][::-1]
def ring(idxs):
    out=[]
    for i in idxs:
        pts=arc(i); out.extend(pts if not out else pts[1:])
    return out
W=720; TOP=84; BOT=-58; H=(TOP-BOT)*2
def proj(p): return ((p[0]+180)/360*W, (TOP-p[1])/(TOP-BOT)*H)
def pieces(r):
    ps=[[r[0]]]
    for a,b in zip(r,r[1:]):
        if abs(b[0]-a[0])>180: ps.append([b])
        else: ps[-1].append(b)
    if len(ps)>1 and abs(r[0][0]-r[-1][0])<=180: ps[0]=ps[-1]+ps[0]; ps.pop()
    return ps
def clip(poly, axis, c, keep_ge):
    # Sutherland-Hodgman against one half-plane (axis 0 = lon, 1 = lat)
    inside=(lambda p:p[axis]>=c) if keep_ge else (lambda p:p[axis]<c)
    out=[]
    for i,cur in enumerate(poly):
        prev=poly[i-1]
        if inside(cur):
            if not inside(prev): out.append(inter(prev,cur,axis,c))
            out.append(cur)
        elif inside(prev): out.append(inter(prev,cur,axis,c))
    return out
def inter(a,b,axis,c):
    d=b[axis]-a[axis]; k=0 if d==0 else (c-a[axis])/d
    p=[a[0]+(b[0]-a[0])*k, a[1]+(b[1]-a[1])*k]; p[axis]=c; return tuple(p)
def dpath(polys):
    d=[]
    for pc in polys:
        if len(pc)<3: continue
        pts=[proj(p) for p in pc]; q=[pts[0]]
        for p in pts[1:]:
            if abs(p[0]-q[-1][0])>0.35 or abs(p[1]-q[-1][1])>0.35: q.append(p)
        if len(q)<3: continue
        d.append('M'+'L'.join('%.1f,%.1f'%p for p in q)+'Z')
    return ''.join(d)
old=json.load(open('map-paths.json')); reg={n:r for n,r,_ in old}
out=[]
for g in t['objects']['countries']['geometries']:
    n=g['properties']['name']
    if n in ('Antarctica','Fr. S. Antarctic Lands'): continue
    polys=[g['arcs']] if g['type']=='Polygon' else g['arcs']
    rings=[ring(p[0]) for p in polys]
    pcs=[pc for r in rings for pc in pieces(r)]
    if n=='Russia':
        eu=[];asia=[]
        for pc in pcs:
            mean=sum(p[0] for p in pc)/len(pc)
            if mean<-100: asia.append(pc); continue      # Chukotka east of the antimeridian
            e=clip(pc,0,60,False); a=clip(pc,0,60,True)
            if len(e)>2: eu.append(e)
            if len(a)>2: asia.append(a)
        out.append(['Russia (west of the Urals)','eu',dpath(eu)]); out.append(['Russia (Siberia and the Far East)','as',dpath(asia)])
    elif n=='Turkey':
        eu=[];asia=[]
        for pc in pcs:
            west=clip(pc,0,29.05,False)           # west of the Bosphorus
            thrace=clip(west,1,40.6,True)         # north part of it: Thrace
            south=clip(west,1,40.6,False)
            east=clip(pc,0,29.05,True)
            if len(thrace)>2: eu.append(thrace)
            if len(south)>2: asia.append(south)
            if len(east)>2: asia.append(east)
        out.append(['Turkey (Thrace)','eu',dpath(eu)]); out.append(['Turkey (Anatolia)','as',dpath(asia)])
    else:
        out.append([n,reg[n],dpath(pcs)])
json.dump(out,open('map-paths.json','w'),separators=(',',':'))
print(len(out),'shapes')
