import json
D='scripts/data/'
R=json.load(open(D+'scenic-full-200-results-nov16.json')); N=json.load(open(D+'scenic-full-notes-nov16.json')); by={x['name']:x for x in R}
L=json.load(open(D+'scenic-factcheck-edits-nov21.json'))
for b in by['Ladakh']['gemini']['blurbs']:
    if sorted(b['months'])==[3,4]:
        old="the major mountain passes remain blocked by deep drifts, keeping the wider region inaccessible by road."
        assert old in b['text']; b['text']=b['text'].replace(old,"the highest passes are often blocked by drifts, and the road into the region from Manali is still shut."); L.append(dict(place='Ladakh',where='months [3,4]',was=old,now='highest passes often blocked; Manali road still shut'))
notes={
'Denali & the Interior':"Fact check (21 Nov): the Denali Park Road past East Fork (mile 43) has been closed since the Pretty Rocks landslide; the new bridge is done, buses go no farther than East Fork in 2026 and the Park Service plans full service in 2027, so Wonder Lake is no longer named as a sure view (NPS release on the Pretty Rocks bridge). The score of 9 is unchanged and assumes the 2027 reopening.",
'Dolomites':"Fact check (21 Nov): the Tre Cime toll road needs an online reservation (official Dolomiti notice) and the Seceda lifts use timed entry, with two thirds of seats bookable ahead, so 'both need advance booking' was reworded. Lifts and toll road are closed for most of November (the regional lift season ends 8 November).",
'Grand Canyon':"Fact check (21 Nov): NPS puts the North Rim's full season at 15 May to 15 October and a day-use shoulder season to 30 November with no services, and the road closes by 1 December or earlier with snow, so November no longer says the North Rim is closed.",
'Death Valley National Park':"Fact check (21 Nov): NWS 1991 to 2020 normals at Furnace Creek give April 91, May 100.7 (both already right); June to August averages are above 105, so 'often above 110' now says above 105 on most days.",
'Iceland':"Fact check (21 Nov): the road authority's opening dates put the Landmannalaugar road (F208) at early June on average and Sprengisandur (F26) at late June to early July, so June is now its own blurb and scores 9.4 (was 10, peak) because many interior routes are still closed. July and August stay 10.",
'Ladakh':"Fact check (21 Nov): winter sources say the Nubra (Khardung La) and Pangong roads are usually open with temporary snow closures, Zanskar stays shut and the Manali to Leh road is not reliable, so the winter blurbs no longer say the passes close for the season. Scores are unchanged (cold and limited services still hold them down).",
'Torres del Paine':"Fact check (21 Nov): sources disagree on whether a guide is required on the W Trek in winter, so the blurb now says trails are restricted or closed. Daylight worked out from the latitude is 7.7 to 9.6 hours from June to August, so 'about eight hours' became 'eight to ten'.",
'Tierra del Fuego':"Fact check (21 Nov): daylight worked out from the latitude is 7.0 to 9.3 hours from June to August, so 'about seven hours' became 'seven to nine'.",
'Yosemite National Park':"Fact check (21 Nov): NPS says Tioga Road typically opens late May or June and Glacier Point Road from May (April in some years), so June says 'usually open' and March and April no longer say both roads are blocked.",
'Maldives':"Fact check (21 Nov): the Maldives has 1,192 islands, so 'thousands of islands' became 'more than a thousand'.",
'Mongolia':"Fact check (21 Nov): winter 'roads are impassable' reworded to 'snow blocks many roads'.",
'North Cascades':"Fact check (21 Nov): WSDOT records show the highway closing between 18 November and 4 December in recent years, so November and December now say it is usually shut by mid-November.",
'Great Smoky Mountains National Park':"Fact check (21 Nov): the Park Service now calls Clingmans Dome Kuwohi; its seasonal road schedule has the road closed in winter (2026 season 1 April to 29 November). Text now says Kuwohi, formerly Clingmans Dome.",
'Banff & Jasper National Parks':"Fact check (21 Nov): Parks Canada has closed Moraine Lake Road to personal vehicles all year since 2023; the shuttle runs 1 June to 12 October, so October now says the shuttle stops running.",
'Milford Sound & Fiordland':"Fact check (21 Nov): the Department of Conservation says the Milford Track stays open from May to October with reduced facilities (14 bridges removed, no avalanche management), so winter no longer says it is shut to independent hikers.",
'Zion & Bryce Canyon':"Fact check (21 Nov): the Narrows close when the river is above 150 cubic feet per second and after flash flood warnings, so the summer blurb now says closures happen after flash flood warnings.",
'Dubai':"Fact check (21 Nov): average highs run about 76 in January to 87 in November, so 'upper 70s to mid 80s' became 'mid 70s to upper 80s'.",
'Samarkand & Bukhara':"Fact check (21 Nov): July highs average about 95 in Samarkand and about 100 in Bukhara, so 'heat above 100' became 'heat near 100'.",
'Red Sea & Nile':"Fact check (21 Nov): Cairo averages about 95 in summer and Luxor and Aswan above 105, so 'often above 105' became 'often 100 or more'.",
'Mongolia ':"",
}
for p,t in notes.items():
    if not t: continue
    pid=by[p]['id']; N[pid]['why']=(N[pid]['why']+' '+t).strip()
json.dump(R,open(D+'scenic-full-200-results-nov16.json','w'),ensure_ascii=False); json.dump(N,open(D+'scenic-full-notes-nov16.json','w'),ensure_ascii=False); json.dump(L,open(D+'scenic-factcheck-edits-nov21.json','w'),ensure_ascii=False,indent=1)
print(len(L),'edits logged', len([t for t in notes.values() if t]),'notes')
