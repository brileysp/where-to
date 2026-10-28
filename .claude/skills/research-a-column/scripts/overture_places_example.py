# Working example from the 28 Oct 2026 Golf / Mountain Biking / Camping build. Set PLACES_DIR to the folder written by dump-places-geo.ts and run with PYTHONPATH pointing at a folder with duckdb, numpy and shapely installed (pip install --target <folder> duckdb numpy shapely).
import duckdb,json,math,os,re
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
EXTRA_R={'tokyo-kyoto':120}
REL='s3://overturemaps-us-west-2/release/2026-10-21.0'
con=duckdb.connect(); con.execute("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';")
def hav(a,b,c,d):
    R=6371;p=math.pi/180
    x=math.sin((c-a)*p/2)**2+math.cos(a*p)*math.cos(c*p)*math.sin((d-b)*p/2)**2
    return 2*R*math.asin(math.sqrt(x))
OUT='camp_raw.json'; out=json.load(open(OUT)) if os.path.exists(OUT) else {}
ids=[p for p,v in P['places'].items() if 'campingBackcountry' not in v['na'] or 'mountainBiking' not in v['na']]
print(len(ids),'places',flush=True)
for pid in ids:
    if pid in out: continue
    typ=P['places'][pid]['pt']; R=EXTRA_R.get(pid,RAD[typ]); bases=BASES.get(pid,[(pl[pid]['lat'],pl[pid]['lon'])])
    items={}
    for la,lo in bases:
        dlat=R/111.0; dlon=R/(111.0*max(0.2,math.cos(math.radians(la))))
        rows=con.execute(f"""SELECT names.primary, taxonomy.primary, round(confidence,2), bbox.ymin, bbox.xmin, id FROM read_parquet('{REL}/theme=places/type=place/*', hive_partitioning=1)
        WHERE bbox.xmin BETWEEN {lo-dlon} AND {lo+dlon} AND bbox.ymin BETWEEN {la-dlat} AND {la+dlat}
          AND taxonomy.primary IN ('campground','rv_park','cabin','lodge','bike_rental','canoe_and_kayak_hire_service','horseback_riding_service','mountain_bike_trail','hiking_trail','national_park','state_park','nature_reserve') AND confidence>=0.5""").fetchall()
        for n,c,cf,y,x,i in rows:
            d=hav(la,lo,y,x)
            if d<=R: items[i]={'n':n,'c':c,'cf':cf,'lat':y,'lon':x,'km':round(d,1)}
    out[pid]={'R':R,'items':list(items.values())}
    print(pid,len(items),flush=True); json.dump(out,open(OUT,'w'))
print('done')
