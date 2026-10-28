# Working example from the 28 Oct 2026 Golf / Mountain Biking / Camping build. Set PLACES_DIR to the folder written by dump-places-geo.ts and run with PYTHONPATH pointing at a folder with duckdb, numpy and shapely installed (pip install --target <folder> duckdb numpy shapely).
import duckdb,json,math,time,sys,os
P=json.load(open(os.path.join(os.environ.get('PLACES_DIR','.'),'places.json'))); pl=json.load(open(os.path.join(os.environ.get('PLACES_DIR','.'),'lat.json')))
RAD={'city':35,'region':60,'coastal_area':60,'national_park':40,'wilderness_area':40,'state_province':100,'island':100,'country':100}
BASES={'tokyo-kyoto':[(35.68,139.77),(35.01,135.77)],'taiwan':[(25.03,121.56)],
 # 28 Oct 2026: places whose name lists a second hub outside the usual radius get that hub as an extra base (like Tokyo & Kyoto)
 'whistler':[(49.27,-123.12),(50.12,-122.95)],
 'banff':[(51.18,-115.57),(52.87,-118.08)],
 'quebec-city':[(46.81,-71.21),(45.50,-73.57)],
 'el-chalten':[(-49.33,-72.89),(-50.34,-72.27)],
 'charleston-savannah':[(32.78,-79.93),(32.08,-81.09)],
 'douro-valley-porto':[(41.15,-7.8),(41.15,-8.61)],
 'kenya':[(-1.49,35.14),(-2.65,37.26)],
 'zimbabwe':[(-18.07,25.84),(-18.63,26.50)],
 'zion-bryce':[(37.5,-112.4),(37.30,-113.03)],
 'rajasthan-golden-triangle':[(27.2,76.3),(28.61,77.21),(27.18,78.02)],
 'beijing':[(39.91,116.4),(40.43,116.56)],
 'bavaria-munich':[(48.14,11.58),(47.49,11.10),(47.63,13.0)]}
EXTRA_R={'tokyo-kyoto':120}   # owner: a very broad region
REL='s3://overturemaps-us-west-2/release/2026-10-21.0'
con=duckdb.connect(); con.execute("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2'; INSTALL spatial; LOAD spatial;")
def hav(a,b,c,d):
    R=6371;p=math.pi/180
    x=math.sin((c-a)*p/2)**2+math.cos(a*p)*math.cos(c*p)*math.sin((d-b)*p/2)**2
    return 2*R*math.asin(math.sqrt(x))
out=json.load(open('golf_raw.json')) if os.path.exists('golf_raw.json') else {}
ids=[p for p,v in P['places'].items() if 'golf' not in v['na']]
print(len(ids),'golf places',flush=True)
for pid in ids:
    if pid in out: continue
    typ=P['places'][pid]['pt']; R=EXTRA_R.get(pid,RAD[typ])
    bases=BASES.get(pid,[(pl[pid]['lat'],pl[pid]['lon'])])
    courses={}; hotels=[]
    for la,lo in bases:
        dlat=R/111.0; dlon=R/(111.0*max(0.2,math.cos(math.radians(la))))
        bb=f"bbox.xmin BETWEEN {lo-dlon} AND {lo+dlon} AND bbox.ymin BETWEEN {la-dlat} AND {la+dlat}"
        rows=con.execute(f"""
        WITH g AS (SELECT id, names.primary AS name, geometry AS geom, ST_Area_Spheroid(geometry)/10000.0 AS ha FROM read_parquet('{REL}/theme=base/type=land_use/*', hive_partitioning=1) WHERE class='golf_course' AND {bb}),
        gr AS (SELECT ST_Centroid(geometry) AS c FROM read_parquet('{REL}/theme=base/type=land_use/*', hive_partitioning=1) WHERE class='green' AND {bb}),
        pt AS (SELECT names.primary AS pname, taxonomy.primary AS cat, confidence, ST_Point(bbox.xmin,bbox.ymin) AS p FROM read_parquet('{REL}/theme=places/type=place/*', hive_partitioning=1) WHERE taxonomy.primary IN ('golf_course','driving_range','miniature_golf_course') AND {bb})
        SELECT g.id, g.name, round(g.ha,1), round(ST_Y(ST_Centroid(g.geom)),5), round(ST_X(ST_Centroid(g.geom)),5),
               (SELECT count(*) FROM gr WHERE ST_Contains(g.geom, gr.c)),
               (SELECT string_agg(pname||'|'||cat, ';') FROM pt WHERE ST_Contains(g.geom, pt.p))
        FROM g
        """).fetchall()
        for r in rows:
            d=hav(la,lo,r[3],r[4])
            if d<=R: courses[r[0]]={'name':r[1],'ha':r[2],'lat':r[3],'lon':r[4],'greens':r[5],'pts':r[6],'km':round(d,1)}
        # standalone golf course points not inside any polygon (no land-use mapped)
        prow=con.execute(f"""
        SELECT names.primary, taxonomy.primary, round(confidence,2), bbox.ymin, bbox.xmin FROM read_parquet('{REL}/theme=places/type=place/*', hive_partitioning=1)
        WHERE taxonomy.primary IN ('golf_course') AND {bb}""").fetchall()
        for n,c,cf,y,x in prow:
            d=hav(la,lo,y,x)
            if d<=R: courses.setdefault('pt:%s:%s'%(round(y,4),round(x,4)),{'name':n,'ha':None,'lat':y,'lon':x,'greens':None,'pts':'%s|%s|%s'%(n,c,cf),'km':round(d,1),'pointOnly':True})
        hrow=con.execute(f"""
        SELECT names.primary, taxonomy.primary, bbox.ymin, bbox.xmin FROM read_parquet('{REL}/theme=places/type=place/*', hive_partitioning=1)
        WHERE taxonomy.primary IN ('hotel','resort','lodge','bed_and_breakfast','inn','resort_hotel') AND {bb} AND confidence>0.5""").fetchall()
        hotels+= [(n,c,y,x) for n,c,y,x in hrow]
    # hotels within 1 km of each course
    for k,c in courses.items():
        c['hotels']=[h[0] for h in hotels if abs(h[2]-c['lat'])<0.012 and hav(c['lat'],c['lon'],h[2],h[3])<=1.0][:5]
    out[pid]={'R':R,'courses':courses}
    print(pid,len(courses),flush=True)
    json.dump(out,open('golf_raw.json','w'))
print('done')
