# 10 Nov 2026: dietary ease ratings. Map listings (Overture Maps places release 2026-10-21.0) of vegetarian, vegan, gluten-free, halal and kosher restaurants within 30 km (19 miles) of a city or
# 60-80 km (37-50 miles) of anywhere else (counts in travel-needs-diet-counts-nov10.json), turned into 0-10 tiers, then raised to a country floor where the cuisine itself settles it
# (Muslim-majority countries for halal; India and Ethiopia for vegetarian and vegan; coeliac awareness for gluten-free). Rating = the higher of the two.
# 10 Nov 2026 (owner: research remote parks better): a country floor is lowered where the circle holds few restaurants of any kind (under 5: -3, under 40: -1),
# and places whose meals are arranged in advance by a lodge, camp or ship get set values (LODGE), because an empty map there does not mean nothing to eat.
import json
C=json.load(open('scripts/data/travel-needs-diet-counts-nov10.json'))
RC=json.load(open('scripts/data/travel-needs-restaurant-counts-nov10.json'))  # restaurants of any kind in the same circle (Overture, 2026-10-21.0), for dining depth
P={x['id']:x for x in json.load(open('/tmp/pilot_places.json'))}
def tier(c,steps):  # steps: list of (min count, rating) ascending
    r=0
    for m,v in steps:
        if c>=m: r=v
    return r
VEG=[(1,4),(3,5),(10,6),(25,7),(60,8),(120,9),(250,10)]
VGN=[(1,3),(3,4),(8,5),(20,6),(40,7),(80,8),(160,9),(300,10)]
GF=[(1,4),(3,5),(6,6),(12,7),(25,8),(50,9)]
HAL=[(1,4),(3,5),(8,6),(20,7),(50,8),(100,9),(200,10)]
KOS=[(1,3),(3,4),(6,5),(12,6),(25,7),(50,8),(100,9)]
# country floors; place overrides win over country
VEG_F={'IND':8,'NPL':7,'LKA':7,'BTN':4,'MNG':2,'DNK':3,'THA':7,'VNM':7,'KHM':5,'LAO':5,'MMR':6,'TWN':8,'ETH':9,'MEX':5,'ZAF':5,'ISL':4,'ARG':3,'URY':3,'KOR':4,'JPN':4,'CHN':4,'MAR':5,'EGY':6,'JOR':6,'TUR':6,'GEO':5,'GRC':6,'ITA':6,'ESP':5,'PRT':5,'FRA':5,'DEU':6,'GBR':7,'IRL':6,'USA':7,'CAN':7,'AUS':8,'NZL':8,'UGA':3,'KEN':3,'TZA':3,'RWA':3,'ZMB':3,'ZWE':3,'GRL':2,'FLK':2,'ATA':3}
VEG_P={'rajasthan-golden-triangle':10,'kerala':8,'ladakh':7,'kaziranga':6,'bali':9,'komodo':5,'rajaampat':4,'uyuni':3,'tierra-del-fuego':2,'el-chalten':3,'torres-del-paine':2,'greenland':2,'falklands':2,'antarctica':3,'svalbard':3,'lofoten':3,'faroe-islands':3}
VGN_F={'ETH':8,'IND':5,'THA':5,'TWN':6,'VNM':5,'LKA':5,'NPL':5,'MMR':4,'ISL':3,'DEU':5,'GBR':6,'USA':6,'AUS':6,'NZL':6,'CAN':6,'JPN':3,'KOR':3}
VGN_P={'bali':9,'berlin':9,'rajasthan-golden-triangle':5,'kerala':5,'greenland':1,'falklands':1,'mongolia':1,'antarctica':2}
GF_F={'ITA':8,'ESP':6,'GBR':8,'IRL':8,'USA':8,'CAN':8,'AUS':9,'NZL':9,'DEU':7,'FRA':5,'AUT':6,'CHE':7,'NLD':6,'DNK':6,'NOR':6,'FIN':7,'PRT':4,'GRC':4,'TUR':3,'JPN':3,'KOR':3,'CHN':2,'TWN':3,'THA':4,'VNM':4,'KHM':3,'LAO':3,'MMR':3,'IDN':4,'IND':5,'LKA':3,'NPL':3,'MEX':4,'ARG':6,'BRA':4,'CHL':4,'PER':4,'COL':4,'ECU':3,'BOL':3,'CRI':5,'PAN':4,'GTM':3,'NIC':3,'CUB':2,'DOM':4,'JAM':5,'BHS':6,'BRB':6,'ABW':6,'TCA':6,'BLZ':5,'PYF':5,'FJI':5,'MUS':4,'SYC':4,'MDV':5,'ZAF':7,'KEN':4,'TZA':3,'UGA':3,'RWA':3,'ZMB':3,'ZWE':4,'BWA':4,'NAM':5,'MDG':3,'GHA':3,'ETH':2,'MAR':3,'EGY':3,'JOR':4,'ARE':7,'UZB':2,'KGZ':2,'MNG':2,'BTN':2,'PAK':2,'GEO':3,'HRV':5,'HUN':5,'CZE':5,'PLW':4,'PHL':4,'MYS':5,'SGP':7,'ISL':6,'FLK':5,'ATA':4,'GRL':3,'PNG':2}
HAL_F={'ARE':10,'EGY':10,'JOR':10,'MAR':10,'MDV':10,'PAK':10,'TUR':9,'UZB':9,'KGZ':8,'MYS':9,'SGP':9,'MUS':7,'ETH':7,'LKA':6,'THA':4,'KHM':4,'TZA':4,'KEN':4,'UGA':4,'GHA':4,'NPL':4,'MMR':4}
HAL_P={'borneo':8,'bali':6,'komodo':6,'rajaampat':6,'thailand':7,'bangkok':6,'rajasthan-golden-triangle':7,'kerala':7,'ladakh':6,'beijing':7,'hongkong':6,'taiwan':5,'seoul':4,'tanzania':5,'angkor':4,'jordan':10}
KOS_P={}
LODGE={'antarctica':(7,6,6),'botswana':(7,5,6),'zambia':(7,5,6),'pantanal':(7,5,6),'denali-interior':(6,5,6),'falklands':(5,3,5),'churchill':(5,3,5),'torres-del-paine':(6,4,5),'milford-sound-fiordland':(6,4,6),'kenya':(7,5,6),'tanzania':(7,5,6),'kruger':(6,4,7),'zimbabwe':(6,4,5)}
def depth_pen(n): return 3 if n<5 else 1 if n<40 else 0
MUSLIM={'dubai','egypt','jordan','morocco','maldives','pakistan','istanbul','uzbekistan','kyrgyzstan','borneo'}
RESORT={'aruba':(5,3),'punta-cana':(5,3),'maldives':(6,4),'jamaica':(7,6),'barbados':(6,4),'bahamas':(6,3),'turks-caicos':(5,3),'seychelles':(5,3),'borabora':(4,2),'fiji':(5,3),'palau':(4,2),'mauritius':(7,4),'antarctica':(4,2),'egypt':(7,3)}
def r(v): return max(0,min(10,int(round(v))))
out={}
for i,x in P.items():
    c=C[i]; cc=x['cc']
    veg=max(VEG_P.get(i,VEG_F.get(cc,3)),tier(c.get('vegetarian_restaurant',0),VEG))
    vgn=max(VGN_P.get(i,VGN_F.get(cc,2)),tier(c.get('vegan_restaurant',0),VGN))
    if vgn>veg: veg=vgn
    gf=max(GF_F.get(cc,4),tier(c.get('gluten_free_restaurant',0),GF)) if i not in ('ethiopia',) else GF_F['ETH']
    hal=max(HAL_P.get(i,HAL_F.get(cc,1)),tier(c.get('halal_restaurant',0),HAL))
    kos=max(KOS_P.get(i,1),tier(c.get('kosher_restaurant',0),KOS))
    pen=depth_pen(RC[i])
    if pen:
        # only the part that comes from a country floor is lowered; a count of dedicated places stays as it is
        veg=max(tier(c.get('vegetarian_restaurant',0),VEG),VEG_P.get(i,VEG_F.get(cc,3))-pen)
        vgn=max(tier(c.get('vegan_restaurant',0),VGN),VGN_P.get(i,VGN_F.get(cc,2))-pen)
        gf=max(tier(c.get('gluten_free_restaurant',0),GF),(GF_F.get(cc,4) if i!='ethiopia' else GF_F['ETH'])-pen)
        if vgn>veg: veg=vgn
    if i in LODGE: veg,vgn,gf=LODGE[i]
    veg,vgn,gf=max(veg,1),max(vgn,1),max(gf,1)
    if i in RESORT: veg,vgn=RESORT[i]
    if hal>9 and i not in MUSLIM: hal=9
    out[i]={'veg':r(veg),'vegan':r(vgn),'gf':r(gf),'halal':r(hal),'kosher':r(kos),'c':{k:c.get(k,0) for k in ['vegetarian_restaurant','vegan_restaurant','gluten_free_restaurant','halal_restaurant','kosher_restaurant']},'r':c['r'],'rest':RC[i]}
json.dump(out,open('/tmp/diet_out.json','w'))
if __name__=='__main__':
    for i in sorted(out,key=lambda k:P[k]['name']):
        o=out[i]; print(f"{i:26s} veg {o['veg']:2d} vegan {o['vegan']:2d} gf {o['gf']:2d} halal {o['halal']:2d} kosher {o['kosher']:2d}   counts {list(o['c'].values())}")
