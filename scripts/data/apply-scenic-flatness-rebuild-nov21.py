# 21 Nov 2026: flatness check rebuild. New month scores and month text for 16 places that looked too flat or too swingy against comparable places. Peaks are unchanged.
import json,re
D='scripts/data/'
R=json.load(open(D+'scenic-full-200-results-nov16.json')); N=json.load(open(D+'scenic-full-notes-nov16.json')); by={x['name']:x for x in R}
def B(months,level,text): return dict(months=months,level=level,text=text)
S={}
S['Barcelona']=([5.6,5.7,5.9,6.1,6.2,6.1,5.7,5.5,6.0,5.8,5.7,5.6],[
B([4,5,6],'peak',"Mild, bright days and green hills show the grid of the Eixample and the Mediterranean from Park Güell and the Collserola hills."),
B([7,8],'fair',"Heat and humid air soften the long views from Park Güell and the Collserola hills."),
B([9,10],'good',"Warm, bright spells show the Eixample and the sea from Park Güell, though autumn storms can bring heavy rain and gray skies."),
B([11,12,1,2,3],'fair',"Cool, often gray days mute the city, but clear days after rain give sharp views from the Collserola hills.")],
"Flat at 6.2 was too flat against Rome, Paris, London and Lisbon (0.6 to 0.7). Now 5.5 to 6.2: the sea and hills are at their best in spring and early summer, humid heat softens the long views in mid-summer, and autumn storms (October has the most rainy days) dull the autumn. Barcelona's air pollution is a year-round background in the city council's own figures, with no seasonal pattern found, so it is already in the base score and adds no month change.")
S['Oaxaca']=([7.4,7.2,6.9,6.7,6.8,7.3,7.6,7.6,7.6,7.7,7.7,7.5],[
B([10,11],'peak',"The valley hills are still green from the rains, and dry, bright days give sharp views from Monte Albán and at the petrified cascades of Hierve el Agua."),
B([6,7,8,9],'good',"Afternoon showers keep the hills green while mornings are usually clear, so the valleys below Monte Albán look fresh, though low cloud can hang over the mountains."),
B([12,1,2],'good',"Dry, bright days keep the views sharp, but the valley hills turn brown and dry."),
B([3,4,5],'fair',"Dry heat browns the hills, and smoke from seasonal fires can haze the valley views.")],
"Flat at 7.7 was too flat. Now 6.7 to 7.7. The rainy season is not lower here: sources call it not all that rainy, with showers on about two days in three, morning valley fog that burns off by noon, and persistent rain rare, so the green months score near the top and the best months are the first dry ones after the rains. The lowest are the dry, brown, hot months, when seasonal fires (the Mexican fire season runs from about mid-March into May) can haze the valleys.")
S['Jamaica']=([7.7,7.7,7.7,7.5,7.1,7.0,7.3,6.8,6.5,6.4,6.7,7.5],[
B([12,1,2,3,4],'peak',"Dry weather keeps the skies mostly clear over the cliffs at Negril, the Blue Mountains and the cascades of Dunn's River Falls."),
B([5,6],'good',"Heavy showers come and go, and cloud often hangs over the Blue Mountains, though the interior is green and the rivers run full."),
B([7],'good',"A drier break between the two rainy seasons gives clearer skies over the coast, though Saharan dust can haze distant views."),
B([8,9,10],'fair',"Hurricane season brings the heaviest rain and the highest chance of storms, and the Blue Mountains stay clouded, though the interior is at its greenest."),
B([11],'fair',"Heavy showers are still common and the mountains stay clouded, though storms are less likely than in the weeks before.")],
"Flat at 7.7 was too flat for a hurricane-belt island (Bahamas 2.7, Belize 1.9). Now 6.4 to 7.7. Sources put the dry season at about December to April (February and March driest), two rainy peaks around May and June and again around October and November with a drier lull in July, and hurricane risk mainly in August to October. Rain is usually brief and overcast days are rare, so the drop is moderate. Saharan dust (NOAA: June to September, can cut visibility under 3 miles) is added to the summer text.")
S['Turks & Caicos']=([8.6,8.6,8.6,8.5,8.3,8.0,7.9,7.6,7.1,7.2,8.0,8.5],[
B([12,1,2,3,4],'peak',"Dry weather keeps the water off Grace Bay bright turquoise, with long, clear sightlines across the low islands."),
B([5,6,7],'good',"Warm, humid air and Saharan dust can soften the horizon, though the shallows keep their color."),
B([8,9,10],'fair',"Hurricane season brings the most cloud and rain, and storms can stir up the shallows and dull the turquoise for days at a time."),
B([11],'good',"Late storms are still possible, but the water off Grace Bay is bright turquoise most days.")],
"Swing was 0.4, too flat beside the Bahamas at 2.7. Now 7.1 to 8.6. About 82% of a hurricane season's activity falls from late August to October (NOAA), so those months are now the lowest and no longer group with the clear months; Saharan dust from June to September softens the mid-summer horizon.")
S['Dominican Republic']=([7.6,7.6,7.6,7.4,7.1,6.9,7.0,6.8,6.4,6.4,6.9,7.4],[
B([12,1,2,3,4],'peak',"Dry, sunny weather and clear skies show the white sand beaches and palm trees along the shore, and the forested hills and valleys of the interior are clear on drives across the country. The Cordillera Central, which holds the Caribbean's highest peak, is at its clearest."),
B([5,6,7],'good',"Afternoon showers and cloud come and go over the coast, Saharan dust can haze the horizon, and the interior hills and valleys are green."),
B([8,9,10],'fair',"Heavy rain and tropical storms can dull the coast and slow the interior roads, though the forested hills are at their greenest."),
B([11],'good',"Showers and late storms are still possible, but the interior stays green and the coast is bright between them.")],
"Swing was 0.7, thin for the hurricane belt. Now 6.4 to 7.6, with September and October the lowest (peak hurricane activity) and November split out as a recovering month. Your overview wording is unchanged.")
S['Puerto Rico']=([7.5,7.5,7.5,7.3,6.9,6.8,6.9,6.5,6.3,6.3,6.7,7.4],[
B([12,1,2,3,4],'peak',"Drier weather brings the clearest skies and firm trails, so the El Yunque canopy and waterfalls, the coastal viewpoints and the blue cobblestone streets of Old San Juan show at their sharpest."),
B([5,6,7],'good',"Afternoon showers build over the mountains and make the rainforest trails muddy, and Saharan dust can haze the coast, though mornings are often clear for the coastal views and Old San Juan."),
B([8,9,10],'fair',"Hurricane season brings heavy rain, low cloud over the mountains and rough surf, and storms can close the El Yunque roads and trails until conditions clear."),
B([11],'good',"Late storms can still bring heavy rain and low cloud over El Yunque, though the coast and Old San Juan are bright between them.")],
"Swing was 0.6, thin for the hurricane belt. Now 6.3 to 7.5, with August to October lowest and November split out. Saharan dust added to the mid-year text.")
S['Maui']=([7.9,7.8,8.0,8.4,8.5,8.6,8.6,8.6,8.6,8.5,8.2,7.9],[
B([12,1,2,3],'good',"Winter storms, including Kona storms, can bring heavy rain, flooding and landslides, and the Hana road and the Haleakalā summit can be shut until the weather passes, though the waterfalls run at their fullest."),
B([4,5],'good',"Fewer storms leave the drive to Hana and the summit of Haleakalā mostly open, and the waterfalls still run well."),
B([6,7,8,9],'peak',"Drier weather gives the best odds of clear views of the Haleakalā crater and the coast, and the Hana road is at its most reliable. The partially submerged crater of Molokini is easy to see from the coast."),
B([10],'good',"Settled, mostly dry weather keeps the views good, though the first winter storms can reach the island late in the month."),
B([11],'good',"Rain and Kona storms are more frequent, so the Hana road and the Haleakalā summit can be shut for a day or two.")],
"Flat at 8.6 was too flat. Now 7.8 to 8.6. County reports from the Kona storms of December 2023 and February and March 2026 show floods, landslides, Hana road washouts and Haleakalā summit closures, so the storm months are lower. Vog from Kilauea is covered on the Big Island card (its sources describe the Kona coast, not Maui).")
S['Big Island']=([8.3,8.3,8.4,8.6,8.7,8.7,8.7,8.7,8.7,8.6,8.4,8.3],[
B([11,12,1,2,3],'good',"Winter storms bring heavy rain to the Hamakua coast, and weak winds can let volcanic haze from Kilauea pool over the Kona coast, though the volcanic landscapes and Mauna Kea stay in view on better days."),
B([4,5,6,7,8,9,10],'peak',"Drier weather gives the clearest views of the volcanic landscapes of Hawaii Volcanoes National Park and the high summit of Mauna Kea. The Hamakua coast shows Akaka Falls and Waipio Valley, while the western coasts show stark contrasts between black lava fields and the ocean.")],
"Flat at 8.7 was too flat. Now 8.3 to 8.7. Kilauea has been erupting in pulses since December 2024 and state health notices describe vog pooling when winds are weak; the Kona winds of winter are the weak-wind season, so the winter months are lowest. Hilo's rain by month was not sourced, so the winter rain claim is kept general.")
S['Canary Islands']=([7.8,7.8,8.0,8.2,8.3,8.3,8.3,8.2,8.2,8.1,7.9,7.8],[
B([11,12,1,2,3],'good',"Winter brings rain to the north-facing slopes, and Saharan dust haze, called calima, can blur the horizon, though Mount Teide is often capped with snow."),
B([4,5,6,7,8,9,10],'peak',"Dry, sunny weather gives clear views from Mount Teide and the coasts, though a layer of trade-wind cloud often sits over the north-facing slopes. The volcanic peaks, coastal cliffs and ancient forests vary from island to island, and the dunes of Fuerteventura make a striking contrast to the ocean.")],
"Flat at 8.3 was too flat. Now 7.8 to 8.3. Sources say calima is more frequent in winter and early spring (though it can come at any time) and that trade winds put cloud over the north slopes; Teide snow is most likely in March.")
S['Bhutan']=([7.4,7.7,8.5,8.8,8.6,5.3,4.6,4.9,7.0,9.1,9.2,8.1],None,
"Monsoon months were 5.6 to 6.1 while Nepal, with the same monsoon over the peaks, drops to 3.2. Now 4.6 to 5.3. Sources disagree on how severe the monsoon is in the north (one calls the cloud a misconception), so the wording stays at 'often hide'. I found no source for spring haze, so none is added; one source says views in late spring can be obscured by rain clouds and humidity, so May is slightly lower.")
S['Greenland']=([1.2,2.2,3.2,5.0,6.8,8.8,9.6,9.6,8.2,5.2,1.4,1.0],[
B([11,12,1],'poor',"Polar darkness and extreme cold leave only a few hours of twilight, flights and boat tours are limited, and most of the landscape is snow-covered and hard to reach."),
B([2],'poor',"Daylight is longer and a few winter trips run to the Ilulissat Icefjord by dog sled, but most of the country is still hard to reach."),
B([3],'poor',"Longer days bring more winter trips to the Ilulissat Icefjord, with dog sleds and dark nights for the northern lights, though most of the country is still locked in snow and ice."),
('keep',[4]),('keep',[5]),('keep',[6,7,8]),('keep',[9]),('keep',[10])],
"Winter was 0 as if closed. Now 1.0 to 3.2. A winter-travel source puts the small window to visit Ilulissat at mid-February to April and says air service is spotty in the coldest weeks, so December and January stay very low but not zero, and February and March rise.")
S['Svalbard']=([1.6,2.8,6.0,8.0,8.8,9.2,9.4,9.4,8.2,6.2,1.8,1.4],[
B([11,12,1],'poor',"The polar night leaves almost no daylight, so the glaciers and fjords can be seen only by moonlight or in the glow of the northern lights, though snowmobile trips run from Longyearbyen."),
B([2],'poor',"A few hours of blue twilight at midday show the snow-covered mountains and frozen fjords, and snowmobile trips are the main way to see them."),
('keep',[3]),('keep',[4]),('keep',[5,6,7,8]),('keep',[9]),('keep',[10])],
"Winter was 0 as if closed. Now 1.4 to 2.8. Sources say flights run daily from Oslo and Tromsø, the polar night lasts late November to February with a few hours of twilight at the edges, and snowmobile trips run through the winter season. Overview now says the polar night leaves almost no light rather than hiding the landscape entirely.")
S['Mongolia']=([1.4,1.8,2.2,2.4,6.4,8.1,8.4,8.4,7.9,4.5,2.0,1.5],[
B([11,12,1],'poor',"Extreme cold and heavy snow make travel across the steppe and desert difficult, most tourist camps are closed, and the capital's winter air can hang heavy with pollution."),
B([2,3],'poor',"Snow still blocks many roads and most tourist camps are closed, though Lake Khuvsgul is frozen solid and its ice festival draws visitors."),
('keep',[4]),('keep',[5]),('keep',[6,7,8]),('keep',[9]),('keep',[10])],
"Winter was 0 as if closed. Now 1.4 to 2.4. Winter is the off-season but not closed: Khuvsgul freezes solid and holds an ice festival on 3 and 4 March, and the capital's winter air pollution is a recurring complaint in guides (no measured figures found).")
S['North Cascades']=([3.0,3.1,3.2,3.6,5.4,7.8,9.3,9.0,8.6,6.3,3.5,2.9],[
B([12,1,2,3],'poor',"Heavy snow shuts the North Cascades Highway to the park's core, but the lower Skagit valley stays reachable, with snowy peaks above the forests."),
('keep',[4]),('keep',[5]),('keep',[6]),
B([7],'peak',"Glacial flour turns Diablo Lake a brilliant turquoise. High passes and trails are clear of snow, giving expansive views of the glaciers and Mount Shuksan."),
B([8,9],'good',"Wildfire smoke can haze the Ross Lake area and the high views in some years, though Diablo Lake stays turquoise and the high passes are free of snow."),
('keep',[10]),('keep',[11])],
"Winter was 1.0 to 1.3, below Glacier (4.3), Yellowstone (3.7) and Denali (2.0), which also lose their main roads. Now 2.9 to 3.6 (the lower valleys stay reachable; the lower-valley access is from general knowledge of where the highway gate sits, not a source I could open). Smoke: Park Service updates show smoke at Ross Lake in July 2026 and a season that can run into late September when rains are late; no frequency data found, so August and September are lower and worded as 'in some years'. July is now the peak month.")
S['Dolomites']=([7.6,7.6,7.0,5.6,6.2,9.8,10.0,10.0,9.5,8.5,5.6,6.8],[
B([12],'good',"Ski lifts run in the main valleys by early December, so the snow-covered peaks are reachable, though days are short and many high passes stay closed."),
B([1,2],'good',"Pale peaks stand out under snow above open ski areas, and the lifts run, though many high passes, trails and scenic drives stay closed."),
B([3],'good',"Ski lifts still run and the snow-capped peaks are bright, though many high passes and trails stay closed and the valleys turn to mud."),
B([4],'fair',"Melting snow and mud cover the valleys, the ski lifts have stopped, and the summer lifts and mountain huts are still closed, so the signature viewpoints are hard to reach."),
('keep',[5]),('keep',[6,7,8,9]),('keep',[10]),
B([11],'fair',"The summer lifts, mountain huts and the Tre Cime toll road are closed for most of the month, and snow begins to close the high passes and trails, while the valleys are bare and cold before the ski lifts open.")],
"Winter was 5.4 and spring and November 4.1 to 4.8 against Chamonix 7.0 to 8.6 and Zermatt 7.2 to 9.5. Now 5.6 to 7.6 in the shoulder and winter months, with the real closures (April mud with lifts stopped, November between seasons) still the lowest. Dolomiti Superski opened its core valleys on 4 December in 2025 and Alta Badia lifts run from early December to early April.")
S['Glacier & Waterton Lakes']=([5.3,5.4,5.5,5.4,6.6,7.9,9.5,9.3,9.1,7.4,5.0,5.1],[
B([11,12,1,2,3,4],'fair',"Heavy snow shuts the higher Going-to-the-Sun Road, but the west side stays plowed to Lake McDonald Lodge, so the snow-covered peaks and the frozen edges of the lake can be seen on foot, snowshoes or skis."),
('keep',[5]),('keep',[6]),
B([7],'peak',"The Going-to-the-Sun Road is open, allowing drives over Logan Pass. The high alpine scenery, deep glacial valleys, and clear waters of Lake McDonald are all in view."),
B([8,9],'peak',"The Going-to-the-Sun Road is open and the high alpine scenery and clear waters of Lake McDonald are in view, though smoke from regional wildfires can gray out the skies in some years."),
('keep',[10])],
"Winter was 4.3 to 5.1 against Banff & Jasper at 6.4 to 6.9. Now 5.0 to 5.5: the Park Service plows the west side to Lake McDonald Lodge and calls it the most popular skiing area in the park. Smoke: one guide says a British Columbia fire can gray out the skies over Glacier; no frequency data found, so August and September are slightly lower and worded as 'in some years'. July is now the peak month.")
# Palm Springs: split the winter group so the bloom has its own text (scores unchanged)
ps=by['Palm Springs & Joshua Tree']['gemini']
i=[k for k,b in enumerate(ps['blurbs']) if sorted(b['months'])==[1,2,3,4,11,12]][0]; old=ps['blurbs'][i]
a=dict(months=[11,12,1],level='peak',text="Cool temperatures allow long hikes into the exposed boulder fields and palm oases. The low winter sun casts long shadows across the desert floor, highlighting the rugged texture of the San Jacinto Mountains.")
b=dict(months=[2,3,4],level='peak',text="Cool temperatures allow long hikes into the exposed boulder fields and palm oases, and in years with enough winter rain wildflowers color the desert floor. The low sun still casts long shadows across the rugged San Jacinto Mountains.")
ps['blurbs'][i:i+1]=[a,b]
N[by['Palm Springs & Joshua Tree']['id']]['why']+=" Flatness check (21 Nov): scores unchanged; the cool-season blurb is split so wildflowers have their own text (Park Service: bloom depends mainly on October to February rain; a big bloom is the exception, not the rule). Summer here is low because of heat, not rain, so it stays low."
sm=by['San Miguel de Allende & Guanajuato']['id']
N[sm]['why']+=" Flatness check (21 Nov): left as is. The peak is already the green rainy season (sources: afternoon storms, clear mornings, rain over in late September leaving the hills intensely green), the dry months are brown, and jacaranda in March and April holds those months up."
# apply
order=lambda bl: sorted(bl,key=lambda b:min(m if m>=1 else 99 for m in b['months']))
for name,(scores,blurbs,note) in S.items():
    x=by[name]; g=x['gemini']; old_peak=max(g['monthly_scores'])
    assert abs(max(scores)-old_peak)<1e-9,(name,max(scores),old_peak)
    g['monthly_scores']=scores
    if 'gemini_scores' in x: x['gemini_scores']=scores
    if blurbs is not None:
        old={tuple(sorted(b['months'])):b for b in g['blurbs']}
        new=[]
        for e in blurbs:
            if isinstance(e,tuple): new.append(old[tuple(sorted(e[1]))])
            else: new.append(e)
        cov=sorted(m for b in new for m in b['months']); assert cov==list(range(1,13)),(name,cov)
        g['blurbs']=sorted(new,key=lambda b:min(b['months']))
        if g.get('depth')=='year': g['depth']='groups'; g['depth_why']='The look of the place changes with the seasons: storms, dust, haze, snow or closures lower some stretches.'
    else:
        # Bhutan: split June from July and August
        bl=g['blurbs']; i=[k for k,b in enumerate(bl) if sorted(b['months'])==[6,7,8]][0]; o=bl[i]
        bl[i:i+1]=[dict(months=[6],level='fair',text="The first monsoon rains bring cloud and humidity, and the high peaks are often hidden."),dict(months=[7,8],level='poor',text=o['text'])]
        for b in bl:
            if sorted(b['months'])==[3,4,5]: b['text']="Spring is a prime time for mountain views ahead of the monsoon. The valleys are green and the high passes are free of winter snow, though humidity and cloud build late in the season."
            if b['months']==[9]: pass
    if note: N[x['id']]['why']=(N[x['id']]['why']+" Flatness check (21 Nov): "+note).strip()
sv=by['Svalbard']['gemini']; assert "hides the landscape entirely in winter" in sv['overview']
sv['overview']=sv['overview'].replace("while the polar night hides the landscape entirely in winter","while the polar night leaves almost no light to see the landscape in winter")
json.dump(R,open(D+'scenic-full-200-results-nov16.json','w'),ensure_ascii=False); json.dump(N,open(D+'scenic-full-notes-nov16.json','w'),ensure_ascii=False)
print('rebuilt',len(S),'places')
