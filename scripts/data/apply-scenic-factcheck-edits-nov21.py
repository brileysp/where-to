# 21 Nov 2026: Scenic text corrections found by the fact-check of the risky sentences (sources in scripts/data/finish/scenicLandscapes/factcheck-claims.json).
import json,re
D='scripts/data/'
R=json.load(open(D+'scenic-full-200-results-nov16.json')); by={x['name']:x for x in R}
log=[]
def blurb(name,months,old,new):
    g=by[name]['gemini']
    for b in g['blurbs']:
        if old in b['text'] and set(months)<=set(b['months']):
            assert old in b['text'],(name,months,old); b['text']=b['text'].replace(old,new); log.append((name,'months '+str(months),old,new)); return
    raise Exception((name,months))
def ov(name,old,new):
    g=by[name]['gemini']; assert old in g['overview'],(name,old); g['overview']=g['overview'].replace(old,new); log.append((name,'overview',old,new))
ov('Denali & the Interior',"often seen from Wonder Lake or on a flightseeing trip","often seen from the park road or on a flightseeing trip")
blurb('Denali & the Interior',[6,7,8],"providing access to the deep Interior and viewpoints like Wonder Lake.","with views of the Alaska Range from buses and overlooks along it.")
blurb('Dolomites',[6,7,8,9],"(Seceda's lifts and the Tre Cime toll road both need advance booking)","(the Tre Cime toll road needs an online reservation, and the Seceda lifts use timed entry)")
blurb('Dolomites',[11],"are closed, and snow begins to close","are closed for most of the month, and snow begins to close")
blurb('Grand Canyon',[11],"The North Rim is closed for the season, leaving the South Rim as the primary vantage point.","The North Rim has no visitor services and is open only for day use, weather permitting, so the South Rim is the main vantage point.")
blurb('Death Valley National Park',[6,7,8],"Daytime highs often above 110 degrees Fahrenheit limit viewing","Daytime highs above 105 degrees Fahrenheit on most days limit viewing")
# Iceland: split June from July-August
g=by['Iceland']['gemini']; i=[k for k,b in enumerate(g['blurbs']) if b['months']==[6,7,8]][0]; b=g['blurbs'][i]
assert 'deep interior' in b['text']
jun=dict(b); jun['months']=[6]; jun['text']="The road to Landmannalaugar is usually passable by now, though many routes into the deep interior stay closed, and the Jökulsárlón glacier lagoon is open."
b['months']=[7,8]; b['text']="The mountain roads open, allowing access to the colorful rhyolite peaks of Landmannalaugar and the deep interior, while the Jökulsárlón glacier lagoon is open."
b['text']=b['text'].replace("The mountain roads open, allowing","The mountain roads are open, allowing")
g['blurbs'].insert(i,jun); log.append(('Iceland','months [6,7,8] split','The mountain roads open, allowing access... deep interior','June: Landmannalaugar road usually passable, interior routes mostly closed; July and August: mountain roads open'))
blurb('Ladakh',[1,2],"Heavy winter snow blocks the high passes, cutting off road access to the lakes and valleys outside Leh.","Heavy snow often closes the high passes for days at a time, and the road to remote valleys such as Zanskar stays shut.")
blurb('Ladakh',[11,12],"The high passes close for the season, restricting travel to the immediate surroundings of Leh.","Snow often closes the highest passes for days at a time, and the road from Manali to Leh is not reliably open.")
blurb('Torres del Paine',[6,7,8],"require a guide or are closed entirely, and most refugios shut down.","are restricted or closed, and most refugios shut down.")
blurb('Yosemite National Park',[6],"The high passes are open,","The high passes are usually open,")
blurb('Yosemite National Park',[3,4],"remain blocked by snow.","remains blocked by snow, and Glacier Point Road is often blocked too.")
ov('Maldives',"Thousands of low-lying islands","More than a thousand low-lying islands")
blurb('Mongolia',[1,2,3,11],"and roads are impassable.","and snow blocks many roads.") if any(sorted(b['months'])==[1,2,3,11] for b in by['Mongolia']['gemini']['blurbs']) else None
blurb('North Cascades',[11,12],"The North Cascades Highway is shut for the season,","The North Cascades Highway is usually shut by mid-November,")
ov('Great Smoky Mountains National Park',"viewpoints like Clingmans Dome and","viewpoints like Kuwohi, formerly Clingmans Dome, and")
blurb('Great Smoky Mountains National Park',[1,2,3,12],"The road to Clingmans Dome is closed for the winter,","The road to Kuwohi, formerly Clingmans Dome, is closed for the winter,")
blurb('Banff & Jasper National Parks',[10],"The access road to Moraine Lake typically closes to vehicles in the middle of the month as winter conditions set in.","The shuttle to Moraine Lake stops running in the middle of the month as winter conditions set in.")
blurb('Milford Sound & Fiordland',[5,6,7,8],"Snow covers the mountains, shutting the Milford Track to independent hikers and limiting access to higher elevations.","Snow covers the mountains, and the Milford Track loses its bridges and staffed huts for the winter, limiting access to higher elevations.")
blurb('Zion & Bryce Canyon',[5,6,7,8],"The Narrows are typically open for wading,","The Narrows are typically open for wading, apart from closures after flash flood warnings,")
json.dump(R,open(D+'scenic-full-200-results-nov16.json','w'),ensure_ascii=False)
json.dump([dict(place=a,where=b,was=c,now=d) for a,b,c,d in log],open(D+'scenic-factcheck-edits-nov21.json','w'),ensure_ascii=False,indent=1)
print(len(log),'edits')
