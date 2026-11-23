# 21 Nov 2026: Scenic changes after the owner confirmed the 20 place scopes. Scores and text for places whose confirmed scope is wider than the area the ratings were written for.
import json,re
D='scripts/data/'
R=json.load(open(D+'scenic-full-200-results-nov16.json')); N=json.load(open(D+'scenic-full-notes-nov16.json'))
by={x['id']:x for x in R}
def setscores(p,new):
    g=by[p]['gemini']; g['monthly_scores']=new
    if 'gemini_scores' in by[p]: by[p]['gemini_scores']=new
def add(a,b):
    return [round(x+y,1) for x,y in zip(a,b)]
def blurb(p,months,old,new):
    for b in by[p]['gemini']['blurbs']:
        if b['months']==months:
            assert old in b['text'],(p,months); b['text']=b['text'].replace(old,new); return
    raise Exception((p,months))
def ov(p,old,new):
    g=by[p]['gemini']; assert old in g['overview'],p; g['overview']=g['overview'].replace(old,new)
res={}
# Dominican Republic: +0.8 every month
g=by['p0058']['gemini']; setscores('p0058',[round(x+0.8,1) for x in g['monthly_scores']])
blurb('p0058',[12,1,2,3,4],"on drives across the country.","on drives across the country. The Cordillera Central, which holds the Caribbean's highest peak, is at its clearest.")
res['p0058']="Scope check (21 Nov): the confirmed scope is the whole country (Punta Cana, the Samana Peninsula, Santo Domingo, the north coast and the Cordillera Central). The recorded ratings had mountains at 0 and cities at 0, which was wrong for the whole country (Pico Duarte is the Caribbean's highest peak). Every month raised by 0.8, so the curve keeps its shape and the peak goes from 6.8 to 7.6. Peak blurb now names the Cordillera Central. Your overview wording is unchanged."
# Laos: +0.4 Oct-Feb, +0.2 Mar-Sep
setscores('p0093',add(by['p0093']['gemini']['monthly_scores'],[.4,.4,.2,.2,.2,.2,.2,.2,.2,.4,.4,.4]))
blurb('p0093',[11,12,1,2],"the waterfalls have strong flow.","the waterfalls have strong flow. The limestone peaks around Vang Vieng and Nong Khiaw stand out sharply against clear skies.")
res['p0093']="Scope check (21 Nov): the confirmed scope is the whole country (Luang Prabang, Vang Vieng, Nong Khiaw, the Plain of Jars, the Bolaven Plateau and the 4,000 Islands). The ratings and signature views covered Luang Prabang, Kuang Si and the Mekong only. Raised 0.4 in the clear months (October to February) and 0.2 in the smoky and rainy months, so the peak goes from 7.9 to 8.3. The clear-season blurb now names the Vang Vieng and Nong Khiaw limestone peaks. Overview unchanged."
# Assam & Northeast India: +0.5 Oct-May, +0.4 Jun-Sep
setscores('p0011',add(by['p0011']['gemini']['monthly_scores'],[.5,.5,.5,.5,.5,.4,.4,.4,.4,.5,.5,.5]))
ov('p0011',"that offer quiet, remote vistas.","that offer quiet, remote vistas. In the hills of Meghalaya, waterfalls drop from the plateau edge and living root bridges cross forest streams.")
blurb('p0011',[6,7,8],"block access to many remote viewpoints.","block access to many remote viewpoints. The waterfalls of the Meghalaya hills run at their fullest.")
res['p0011']="Scope check (21 Nov): the confirmed scope is Assam plus Meghalaya, Nagaland and Manipur. The ratings and signature view covered only the Kaziranga grasslands and the river. Raised 0.5 in most months and 0.4 in the monsoon, because Meghalaya's waterfalls and root bridges are the main addition and the waterfalls are at their fullest in the monsoon, though cloud hides the views. Peak goes from 7.9 to 8.4. Overview and the monsoon blurb now name Meghalaya's waterfalls and root bridges."
# Napa & Sonoma: +0.5, +0.3 in the summer fog months
setscores('p0115',add(by['p0115']['gemini']['monthly_scores'],[.5,.5,.5,.5,.5,.3,.3,.3,.5,.5,.5,.5]))
ov('p0115',"hillside viewpoints.","hillside viewpoints. To the west, the Sonoma Coast adds sea cliffs and coves, and coast redwoods grow along the Russian River.")
blurb('p0115',[6,7],"contrasting with the irrigated vines.","contrasting with the irrigated vines. Fog often covers the Sonoma Coast in the mornings and evenings.")
blurb('p0115',[8],"the surrounding hills are summer gold.","the surrounding hills are summer gold. Fog often covers the Sonoma Coast in the mornings and evenings.")
blurb('p0115',[9,10],"deep red across the vineyards.","deep red across the vineyards. Fog is less persistent on the Sonoma Coast.")
res['p0115']="Scope check (21 Nov): the confirmed scope is Napa Valley, Sonoma Valley, the Russian River Valley and the Sonoma Coast. The ratings covered the vine-covered valleys only (coasts 0, forests 3). Raised 0.5, or 0.3 in June to August when fog often covers the Sonoma Coast, so the peak goes from 7.3 to 7.8. Overview names the Sonoma Coast and the Russian River redwoods; the summer and autumn blurbs say how fog affects the coast."
# Kruger & Sabi Sands: +0.5 Oct-Mar, +1.0 Apr-Sep (clear winter air at the escarpment)
setscores('p0089',add(by['p0089']['gemini']['monthly_scores'],[.5,.5,.5,1,1,1,1,1,1,.5,.5,.5]))
ov('p0089',"soft light","soft light") if False else None
g=by['p0089']['gemini']; assert g['overview'].endswith("softens the harsh plains."); g['overview']+=" The Blyde River Canyon and the Panorama Route, on the escarpment west of the park, add cliffs that drop more than 2,000 feet."
blurb('p0089',[12,1,2,3],"the rivers running full.","the rivers running full. Mist and storm cloud often hide the viewpoints at Blyde River Canyon.")
blurb('p0089',[5,6,7,8,9],"when low light warms the grass.","when low light warms the grass. Clear air gives long views from the Blyde River Canyon viewpoints.")
res['p0089']="Scope check (21 Nov): the confirmed scope is Kruger, Sabi Sands and Timbavati plus the Blyde River Canyon and Panorama Route. The ratings had canyons at 0. Raised 0.5 from October to March, when mist and storm cloud often hide the canyon viewpoints, and 1.0 from April to September, when the air is clear, so the peak goes from 6.3 to 6.8 and the dry months are no longer the weakest by as much. Overview and the two affected blurbs name the canyon."
# Komodo & Flores: text only
ov('p0088',"when the skies are clear and the seas are calm.","when the skies are clear and the seas are calm. On Flores, the three crater lakes of Kelimutu change color over time.")
res['p0088']="Scope check (21 Nov): the confirmed scope is Komodo National Park and the boat trips from Labuan Bajo, plus Flores overland (Bajawa and the Kelimutu crater lakes). The score is already 9.8, so it stays. Overview now names Kelimutu, which was missing."
# Northern Ireland: text only
ov('p0123',"quiet forests, including the tunnel of beech trees known as the Dark Hedges.","quiet forests, including the tunnel of beech trees known as the Dark Hedges. In the south-east, the granite Mourne Mountains rise above the Irish Sea, with Slieve Donard at about 2,800 feet.")
res['p0123']="Scope check (21 Nov): the confirmed scope is all six counties (Belfast, the Causeway Coast and Antrim Glens, the Mournes, the Fermanagh lakes, Derry and Strangford Lough). The score of 8.2 already sits above Wales and Ireland's neighbours in the batch, so it stays. Overview now names the Mourne Mountains. Fermanagh's lakes are not named because I did not check them."
# Cambodia and Wales: scores (their texts already cover the whole country)
setscores('p0034',[round(x+0.6,1) for x in by['p0034']['gemini']['monthly_scores']])
res['p0034']="Scope check (21 Nov): the confirmed scope is the whole country (Angkor, Tonle Sap, Phnom Penh, Kampot, Kep, Koh Rong and the Cardamom Mountains). The text already covers the country in your wording, so it is unchanged. The ratings were drafted for Angkor Wat and Siem Reap alone (mountains 0, coasts 0, lakes 2), so every month is raised 0.6 and the peak goes from 6.5 to 7.1."
setscores('p0196',[round(x+0.6,1) for x in by['p0196']['gemini']['monthly_scores']])
ov('p0196',"coastal villages like Portmeirion.","coastal villages like Portmeirion. In the south, the Brecon Beacons rise above the valleys, and the Pembrokeshire coast runs along sea cliffs.")
res['p0196']="Scope check (21 Nov): the confirmed scope is the whole country (Eryri, the Brecon Beacons, the Pembrokeshire and Gower coasts, Anglesey, Cardigan Bay and Cardiff). The ratings and signature views covered Snowdon, the Glyderau and Portmeirion. Every month raised 0.6, so the peak goes from 7.6 to 8.2, level with Northern Ireland. Overview now names the Brecon Beacons and the Pembrokeshire coast."
# the rest: confirmed, checked, no change
same={'p0010':'Aspen, Snowmass Village, the Maroon Bells, Independence Pass and the Roaring Fork Valley','p0018':'Banff, Lake Louise, Moraine Lake, the Icefields Parkway and Jasper','p0052':'the whole island','p0063':'El Chaltén, Fitz Roy, El Calafate and the Perito Moreno Glacier','p0070':'the Society Islands and the Tuamotu atolls','p0113':'the whole country','p0124':'the northern safari circuit, Kilimanjaro and Zanzibar (coasts are not rated here, by your note)','p0134':'the Coachella Valley, Palm Springs and Joshua Tree','p0141':'Phuket, Phang Nga Bay, Krabi, Railay, Koh Phi Phi and Khao Sok','p0147':'Quebec City and Montreal (Scenic stays focused on Quebec City, by your decision)','p0189':'Vancouver, the Sea to Sky Highway and Whistler'}
for p,t in same.items(): res[p]=f"Scope check (21 Nov): the confirmed scope is {t}. Checked the text and score against it; no change."
for p,s in res.items():
    w=N[p]['why']; w2=re.sub(r'\s*Scope check \(20 Nov\).*$','',w); N[p]['why']=(w2+' '+s).strip()
# recompute rank sentences for every batch (peak, then name; the same order as the earlier rank sentences)
pat=re.compile(r'Rank among the (\d+) ([a-z &,]+?) in this batch: (\d+) at ([\d.]+)(?:; next above (.+?) \(([\d.]+)\))?(?:; next below (.+?) \(([\d.]+)\))?\.')
groups={}
for x in R:
    m=pat.search(N.get(x['id'],{}).get('why',''))
    if m: groups.setdefault(m.group(2),[]).append((x['id'],x['name'],max(x['gemini']['monthly_scores'])))
chg=0
fmt=lambda v:('%g'%v)
for t,L in groups.items():
    L.sort(key=lambda r:(-r[2],r[1]))
    for i,(pid,name,pk) in enumerate(L):
        up=L[i-1] if i>0 else None; dn=L[i+1] if i+1<len(L) else None
        s_=f"Rank among the {len(L)} {t} in this batch: {i+1} at {fmt(pk)}"
        if up: s_+=f"; next above {up[1]} ({fmt(up[2])})"
        if dn: s_+=f"; next below {dn[1]} ({fmt(dn[2])})"
        s_+="."
        w=N[pid]['why']; m=pat.search(w)
        if m.group(0)!=s_: chg+=1; N[pid]['why']=w.replace(m.group(0),s_)
print('rank sentences changed:',chg)
json.dump(R,open(D+'scenic-full-200-results-nov16.json','w'),ensure_ascii=False)
json.dump(N,open(D+'scenic-full-notes-nov16.json','w'),ensure_ascii=False)
for p in ['p0058','p0093','p0011','p0115','p0089','p0034','p0196']: print(by[p]['name'],max(by[p]['gemini']['monthly_scores']),by[p]['gemini']['monthly_scores'])
