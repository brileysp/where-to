# Working example from the 28 Oct 2026 Golf / Mountain Biking / Camping build. Set PLACES_DIR to the folder written by dump-places-geo.ts and run with PYTHONPATH pointing at a folder with duckdb, numpy and shapely installed (pip install --target <folder> duckdb numpy shapely).
import os
import json,math
import numpy as np
P=json.load(open(os.path.join(os.environ.get('PLACES_DIR','.'),'places.json')))['places']; PL=json.load(open(os.path.join(os.environ.get('PLACES_DIR','.'),'lat.json')))
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
def area(pid):
    R=EXTRA_R.get(pid,RAD[P[pid]['pt']]); b=BASES.get(pid,[(PL[pid]['lat'],PL[pid]['lon'])]); return R,b
def hav_np(la,lo,lats,lons):
    p=np.pi/180
    x=np.sin((lats-la)*p/2)**2+np.cos(la*p)*np.cos(lats*p)*np.sin((lons-lo)*p/2)**2
    return 2*6371*np.arcsin(np.sqrt(x))
def inside(pid,lats,lons):
    R,b=area(pid); m=np.zeros(len(lats),bool); d=np.full(len(lats),1e9)
    for la,lo in b:
        dd=hav_np(la,lo,lats,lons); d=np.minimum(d,dd)
    return d<=R, d
