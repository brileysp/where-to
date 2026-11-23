# 21 Nov 2026: builds scripts/data/scenic-facts-21-proposal-nov21.json and the review page .cache/scenic-facts-21.html
# for the Scenic ratings / ways to reach views / signature views of the 21 places whose scope was widened (20 on 21 Nov + Piedmont widened 20 Nov, Quebec included).
import json, html
K = ['m','d','c','f','t','w','i','o','g','p']
LAB = {'m':'Mountains','d':'Deserts and canyons','c':'Coasts','f':'Forests','t':'Cities and villages','w':'Lakes, rivers and waterfalls','i':'Polar, glaciers and ice','o':'Iconic draw','g':'Beyond the icons','p':'Landscape photography'}
VA = {'roadside':'From the road or a viewpoint','short':'Short walks to lookouts','halfDay':'Half-day walks','longHike':'Long hikes','backcountry':'Backcountry trips with camping','airBoat':'From the air or a boat'}
FIELD = {'m':'mountainsRating','d':'desertsRating','c':'coastsRating','f':'forestsRating','t':'citiesRating','w':'lakesRating','i':'iceRating','o':'iconicRating','g':'hiddenGemsRating','p':'landscapePhotography'}
old = json.load(open('/tmp/f20.json'))
oldby = {p['key']: p for p in old}
oldby['p0147'] = {'key':'p0147','label':'Quebec City & Montreal','facts':{'mountainsRating':0,'desertsRating':0,'coastsRating':0,'forestsRating':8,'citiesRating':8,'lakesRating':3,'iceRating':0,'iconicRating':7,'hiddenGemsRating':6,'landscapePhotography':5,'viewAccess':['roadside','short','halfDay','longHike'],'signatureViews':'Old Quebec above the St. Lawrence and fall color (cities and forests)'}}
def L(t,u): return {'t':t,'u':u}
P = {}
def place(key, scope, new, why, va, sig, sources, gaps, verdict=''):
    P[key] = dict(scope=scope, new=dict(zip(K,new)), why=why, va=va, sig=sig, sources=sources, gaps=gaps, verdict=verdict)

place('p0010','Aspen, Snowmass Village, the Maroon Bells and Elk Mountains, Independence Pass and the Roaring Fork Valley.',
 [9,0,0,7,3,6,1,8,6,8], {},
 ['roadside','short','halfDay','longHike','backcountry'], 'The Maroon Bells and Maroon Lake (mountains and lakes); Independence Pass; the aspen groves in fall (forests)',
 [L('Aspen Chamber: leaf-peeping spots','https://aspenchamber.org/blog/aspens-favorite-leaf-peeping-spots'),L('Aspen Snowmass: leaf-peeping guide','https://www.aspensnowmass.com/discover/experiences/guides/leaf-peeping-in-aspen-snowmass'),L('AAA TripCanvas: Maroon Bells','https://ww2.aaa.com/tripcanvas/attraction/maroon-bells-VA102112')],
 'Independence Pass height not confirmed in the results (not used in any rating). The ice rating of 1 rests on my own knowledge (tiny glaciers only).',
 'Good as is. The old ratings were written for this same area, and the search backs them: the Maroon Bells are described as among the most photographed mountains in North America, 14,000-foot twins in the Elk Mountains, with the lake and the gold aspens as the draw. Only the signature wording gains the aspens.')

place('p0011','The Brahmaputra valley of Assam plus the hill states beside it (Meghalaya, Nagaland, Manipur). Excludes Sikkim, Arunachal Pradesh and Darjeeling.',
 [5,0,0,7,2,8,0,5,8,6], {'m':'Dzukou Valley and the Meghalaya and Naga hills are pleasant, high hills but not a major range, and the old rating was written for Kaziranga alone.','w':'The Brahmaputra and Majuli, Nohkalikai Falls (about 340 m, the tallest plunge waterfall in India), the clear Dawki river and Loktak Lake with its floating phumdis make water the strongest landscape here.','t':'Majuli and Naga villages, no large scenic town.','p':'Dzukou in the mist, root bridges, Loktak and the Brahmaputra at sunrise.'},
 ['roadside','short','halfDay','longHike','backcountry','airBoat'], 'Kaziranga’s grasslands at dawn (plains and rivers); Meghalaya’s living root bridges and Nohkalikai Falls (forests and waterfalls); the Brahmaputra and Loktak Lake (rivers and lakes)',
 [L('Culture Trip: 7 natural wonders of the North East','https://www.theculturetrip.com/asia/india/articles/7-natural-wonders-of-indias-north-east'),L('Incredible India: Nohkalikai Falls','https://www.incredibleindia.gov.in/en/meghalaya/cherrapunjee/nohkalikai-falls'),L('Holidify: places to visit in North East India','https://www.holidify.com/blog/places-to-visit-in-north-east-india/')],
 'Sources disagree on the Dzukou Valley height (2,138 to 2,452 m) and on whether Loktak is India’s or only the North East’s largest freshwater lake; neither is used in a rating. I found nothing on the Dawki river or on Kaziranga’s status. The forest rating of 7 and the iconic rating of 5 are my judgement.')

place('p0018','Banff and Jasper National Parks and the Icefields Parkway between them. Excludes Kananaskis, Kootenay and Yoho except where the Parkway passes them.',
 [10,0,0,6,3,10,7,10,6,9], {'w':'Moraine Lake is the example we give for a 10 in this column, and Peyto, Louise and Maligne (Spirit Island) sit beside it.','i':'Now includes the Columbia Icefield and the Athabasca Glacier, one of the world’s most accessible glaciers (Parks Canada): 6 to 7. It is not a 10 next to Patagonia’s ice fields.','p':'Moraine Lake at sunrise, Peyto Lake, Mount Edith Cavell and the Parkway.'},
 ['roadside','short','halfDay','longHike','backcountry','airBoat'], 'Moraine Lake and Lake Louise (lakes); the Icefields Parkway to the Athabasca Glacier (mountains and ice); Maligne Lake and Spirit Island (lakes)',
 [L('Parks Canada: glaciers and icefields','https://www.parks.canada.ca/pn-np/ab/jasper/nature/environment/ecosys/glaciers'),L('Britannica: Columbia Icefield','https://www.britannica.com/place/Columbia-Icefield'),L('National Geographic: Jasper to Banff and the Icefields Parkway','https://www.nationalgeographic.com/travel/article/jasper-to-banff-and-the-icefields-parkway-alberta')],
 'Sources disagree on the Columbia Icefield’s size (about 233 to over 300 km2) and on Maligne Lake’s “second largest glacially fed lake” claim; neither is used. Boat access is the Maligne cruise to Spirit Island (Parks Canada). Whether the park rules limit drones and tripods was not rechecked.')

place('p0034','The whole country: the Angkor temples, Tonlé Sap lake, the Mekong at Phnom Penh, the southern coast and islands, and the Cardamom and Elephant mountains.',
 [3,0,6,7,8,6,0,10,7,8], {'m':'Cardamom, Elephant and Bokor hills are low.','c':'Koh Rong, Kep and Kampot are now in scope.','f':'Cardamom rainforest and the jungle-wrapped Ta Prohm.','t':'Angkor is a temple landscape rather than a town, so the cities rating no longer rests on it alone; floating villages, Kampot and Kep hold it a notch lower.','w':'Tonlé Sap is the largest freshwater lake in Southeast Asia and swells to several times its size in the rains, with floating villages.','g':'Cardamoms, Kampot country and the quiet far north east.'},
 ['roadside','short','halfDay','backcountry','airBoat'], 'Angkor Wat and Ta Prohm at sunrise (temple ruins in jungle); the floating villages on Tonlé Sap (lake and villages); Koh Rong’s beaches (coast)',
 [L('Conservation International: Tonlé Sap','https://www.conservation.org/tonle-sap'),L('Traveller: floating villages of the Great Lake','https://www.traveller.com.au/floating-villages-of-cambodias-great-lake-gj3a2o'),L('The Star: Tonlé Sap, an unusual water landscape','https://www.thestar.com.my/lifestyle/travel/2026/06/05/tonle-sap-an-unusual-water-landscape')],
 'The search only covered Tonlé Sap. The Cardamom Mountains, Kampot, Kep, Koh Rong, Bokor and Angkor’s UNESCO status came back with nothing, so the mountain, forest and coast ratings are my judgement from general knowledge.')

place('p0052','The whole island: Havana and the colonial cities, Viñales, the beaches (Varadero and the northern cays), the Sierra Maestra and Baracoa.',
 [6,0,7,5,10,2,0,9,5,6], {'w':'Zapata wetlands, the Hanabanilla lake and rivers around Baracoa: small, nothing like the coasts or towns.','m':'Viñales’ limestone mogotes (UNESCO 1999), the Sierra Maestra (Pico Turquino about 1,975 m) and Baracoa’s hills.','c':'Varadero and the northern cays.','f':'Alejandro de Humboldt park has the best-conserved mountain forest in the Caribbean (Lonely Planet).','o':'Old Havana is a view on many bucket lists.','p':'Viñales and Trinidad give landscape photographers real subjects; Havana is street photography, not landscape.'},
 ['roadside','short','halfDay'], 'Old Havana and the Malecón (city); the Viñales valley and its mogotes (karst); Trinidad and the Valle de los Ingenios (town and valley)',
 [L('Lonely Planet: Cuba’s national parks','https://www.lonelyplanet.com/articles/best-national-parks-cuba'),L('Frommer’s: best natural attractions in Cuba','https://www.frommers.com/destinations/cuba/the-best-natural-attractions/'),L('Culture Trip: beautiful natural attractions in Cuba','https://theculturetrip.com/caribbean/cuba/articles/11-beautiful-natural-attractions-in-cuba-that-will-take-your-breath-away')],
 'Pico Turquino height varies by source (1,972 to 1,975 m). Varadero beach length, Cayo Santa María and Humboldt’s UNESCO status were not confirmed. The state of the east after Hurricane Melissa is already on your to-do list and is not in these ratings.')

place('p0058','The whole country: east coast beaches, the Samaná Peninsula, Santo Domingo, the north coast and the Cordillera Central mountains.',
 [6,3,8,6,5,6,0,6,6,5], {'m':'Pico Duarte is the highest peak in the Caribbean (about 3,100 m) in the Cordillera Central with Jarabacoa and Valle Nuevo.','d':'Dry Pedernales and Bahía de las Águilas, only a pleasant dry landscape.','f':'Los Haitises mangroves and the pine and cloud forests around Jarabacoa and Valle Nuevo.','t':'The Colonial Zone of Santo Domingo.','w':'Lago Enriquillo (below sea level, with crocodiles), Jimenoa and Salto El Limón.','o':'The beaches are well known but no single view is a bucket-list icon.','g':'Pedernales, Samaná and the mountains are quiet.','p':'Samaná, Los Haitises and the mountain valleys give some real subjects, but few single set-piece views.'},
 ['roadside','short','halfDay','backcountry','airBoat'], 'Samaná’s palm-lined beaches and Salto El Limón (coast and waterfalls); Los Haitises’ limestone islets in the mangroves (coast); the Cordillera Central around Jarabacoa (mountains)',
 [L('Wikipedia: Pico Duarte','https://Www.Wikipedia.org/wiki/Pico_Duarte'),L('Explore: national parks of the Dominican Republic','https://explore-mag.com/6-of-the-best-national-parks-in-the-dominican-republic/'),L('Rough Guides: Jarabacoa','https://www.roughguides.com/destinations/central-america-and-the-caribbean/dominican-republic/cibao/jarabacoa'),L('Afar: most underrated landscapes','https://www.afar.com/magazine/the-dominican-republics-most-underrated-landscapes')],
 'Pico Duarte height differs by source (3,087 to 3,101 m); not used in a rating. Santo Domingo’s UNESCO status and Salto de Jimenoa Uno details were not confirmed. This was the stalest row of all: the old ratings described beaches only.')

place('p0063','Argentine Patagonia in Los Glaciares National Park: El Chaltén and the Fitz Roy range in the north, El Calafate and the Perito Moreno Glacier in the south. Excludes Torres del Paine and Ushuaia.',
 [10,0,0,5,1,7,10,10,7,10], {'w':'Lago Argentino, Laguna de los Tres and the ice-blue lakes below the glaciers.','i':'Now includes Perito Moreno, a calving wall about 5 km wide and 60 to 70 m high, fed by the Southern Patagonian Ice Field. Our own example for a 10 here is Patagonia’s ice fields.','o':'Fitz Roy and Perito Moreno are both on bucket lists.'},
 ['roadside','short','halfDay','longHike','backcountry','airBoat'], 'Fitz Roy and Cerro Torre from Laguna de los Tres (mountains); Perito Moreno Glacier (ice); Lago Argentino’s ice-blue shores (lakes)',
 [L('Argentina national parks: Los Glaciares brochure 2024','https://argentina.gob.ar/sites/default/files/2019/06/folleto_informacion_gral_pnlg_ingles_2024.pdf'),L('Wikipedia: Perito Moreno Glacier','https://EN.wikipedia.com/wiki/Perito_Moreno_Glacier'),L('Responsible Travel: Los Glaciares','https://www.responsibletravel.com/holidays/patagonia/travel-guide/los-glaciares-national-park')],
 'Sources give different heights and widths for Perito Moreno’s front (50 to 70 m); I used a range. “Second largest ice field outside the poles” and the park’s UNESCO status were not confirmed by an official source.')

place('p0070','The Society Islands (Tahiti, Moorea, Bora Bora, Huahine) plus the Tuamotu atolls of Rangiroa and Tikehau. Excludes the Marquesas and Austral islands.',
 [7,0,10,3,1,3,0,10,6,8], {'m':'Moorea’s jagged peaks, Otemanu (727 m) and Tahiti’s Orohena (about 2,240 m).','f':'Interior valleys of Tahiti and Moorea.','t':'Small villages, nothing scenic as a town.','w':'Waterfalls and valleys on Tahiti (Faarumai could not be confirmed).','g':'The Tuamotu and Huahine are quiet.','p':'Moorea’s peaks over the bays and Bora Bora’s lagoon from the air.'},
 ['roadside','short','halfDay','backcountry','airBoat'], 'Bora Bora’s lagoon below Mount Otemanu (coast and volcano); Moorea’s jagged peaks above the bays (mountains); Rangiroa’s lagoon (atoll)',
 [L('Rough Guides: French Polynesia','https://www.roughguides.com/article/an-introduction-to-french-polynesia'),L('Wikipedia: Bora Bora','https://en.wikipedia.com/wiki/Bora_Bora'),L('Culture Trip: most beautiful places in Tahiti','https://theculturetrip.com/pacific/french-polynesia/articles/the-10-most-beautiful-places-in-tahiti'),L('Traveller: 20 reasons to visit','https://www.traveller.com.au/20-reasons-to-visit-french-polynesia-ghs6ax')],
 'Mount Orohena’s height differs by source (about 2,240 to 2,240+ m, or 7,352 ft in one); not used. Cook’s Bay, the Belvedere and the Faarumai waterfalls did not appear in the results.')

place('p0088','Komodo National Park and its boat trips from Labuan Bajo, plus Flores overland (Bajawa and the Kelimutu crater lakes). Excludes Bali and Lombok.',
 [6,0,10,5,3,6,0,8,6,8], {'m':'Kelimutu and the Bajawa volcanoes plus Padar’s ridges.','f':'Highland rainforest on Flores.','t':'Traditional villages around Bajawa.','w':'Kelimutu’s three crater lakes of changing colour.','p':'Padar at sunrise and Kelimutu at dawn.'},
 ['short','halfDay','backcountry','airBoat'], 'Padar Island’s viewpoint over three differently coloured coves (coast); Kelimutu’s crater lakes (lakes and volcano); the pink beach (coast)',
 [L('National Geographic: Padar Island','https://www.nationalgeographic.com/travel/article/adventures-komodo-national-park-unesco-world-heritage'),L('The Travel: Padar pink sand beach','https://www.thetravel.com/pink-sand-beach-padar-island-komodo/'),L('Time Out: Komodo National Park guide','https://www.timeout.com/asia/travel/komodo-national-park-guide-indonesia')],
 'Kelimutu, Wae Rebo and the Bajawa area did not come back in the results; the mountain, lake and village ratings for Flores are my judgement. Sources disagree about whether Padar’s pink beach is called Long Beach or Pink Beach.')

place('p0089','Kruger National Park and the private reserves on its western edge (Sabi Sands, Timbavati), plus the Blyde River Canyon and Panorama Route.',
 [6,5,0,3,0,5,0,6,5,5], {'m':'The escarpment above the lowveld drops about 1,000 m at the canyon.','d':'The Blyde River Canyon, 25 to 33 km long, one of the largest green canyons in the world.','f':'Thin: bushveld, not forest.','w':'Blyde waterfalls and the Blyde river.','o':'God’s Window and the Three Rondavels are national icons.','p':'Canyon and escarpment views add to the savanna light.'},
 ['roadside','short','halfDay'], 'Blyde River Canyon and the Three Rondavels (canyon); God’s Window on the Panorama Route (escarpment); open bushveld at golden hour (plains)',
 [L('Travel Local: world’s most breathtaking landscapes (Blyde River Canyon)','https://www.travellocal.com/articles/the-world-s-most-breathtaking-landscapes'),L('Rough Guides: the Escarpment','https://www.roughguides.com/destinations/africa/south-africa/mpumalanga/the-escarpment'),L('Go2Africa: where to go in Kruger','https://go2africa.com/destinations/kruger/where-to-go')],
 'Sources disagree on the canyon’s length (25 to 33 km). The “third largest canyon” claim has no source and is not used. A scenic flight or boat on the Blyde dam is not confirmed here; I left “from the air or a boat” out.')

place('p0093','The whole country: the Mekong at Luang Prabang, the karst of Vang Vieng and Nong Khiaw, the Plain of Jars, the Bolaven Plateau and the 4,000 Islands.',
 [7,0,0,6,7,8,0,7,8,6], {'m':'Vang Vieng and Nong Khiaw’s limestone towers over the river, the Bolaven highlands.','g':'Quiet almost everywhere outside Luang Prabang and Vang Vieng.','p':'Vang Vieng at sunrise, the Nam Ou river and Kuang Si.'},
 ['roadside','short','halfDay','backcountry','airBoat'], 'Kuang Si’s turquoise falls (waterfalls); the limestone karst over the river at Vang Vieng and Nong Khiaw (mountains); the Four Thousand Islands on the Mekong (rivers)',
 [L('World Travel Guide: things to do in Laos','https://www.worldtravelguide.net/guides/asia/laos/things-to-do'),L('Lonely Planet: best places to visit in Laos','https://www.lonelyplanet.com/articles/best-places-to-visit-in-laos'),L('On The Go Tours: top 10 destinations in Laos','https://www.onthegotours.com/Laos/Guides/Best-Places-To-Visit')],
 'Little came back on Nong Khiaw and the Nam Ou. Khone Phapheng’s details and Luang Prabang’s UNESCO status were not in the results. The lakes, forests and cities ratings stay because nothing contradicts them.')

place('p0113','The whole country: Bagan, Inle Lake, Mandalay and the Irrawaddy, Yangon, the Hpa-An karst, the Rakhine coast (Ngapali) and the Shan hills.',
 [6,4,6,4,9,8,0,9,6,9], {'m':'Hpa-An’s limestone peaks (Zwegabin about 725 m), the Shan and Chin hills.','c':'Ngapali and the Rakhine coast.','f':'Hill forest in the Kayin and Shan hills.','w':'Inle Lake, 35 km long, with Intha leg-rowing fishermen and floating gardens.'},
 ['roadside','short','halfDay','airBoat'], 'Bagan’s temple plain at sunrise (temples and villages); Inle Lake’s leg-rowing fishermen (lake); Hpa-An’s limestone peaks over the rice fields (karst)',
 [L('UNESCO: Bagan','https://whc.unesco.org/en/list/1588'),L('Rough Guides: Inle Lake','https://www.roughguides.com/destinations/asia/myanmar-burma/inle-lake-east/inle-lake/'),L('Responsible Travel: Myanmar highlights','https://www.responsibletravel.com/holidays/burma/travel-guide/burma-highlights')],
 'Bagan is counted as 2,229 to 3,595 monuments depending on source; not used. Ngapali had no detail in the results. Balloon access and the security situation are already on your to-do list; one guide says to check the situation before you go.')

place('p0115','Napa Valley, Sonoma Valley and the Russian River Valley, plus the Sonoma Coast to the west. Excludes San Francisco and the Mendocino coast.',
 [4,0,6,6,6,2,0,7,6,5], {'m':'The Mayacamas range along the Napa and Sonoma border, Mount St. Helena.','c':'The Sonoma Coast at Jenner and Bodega Bay.','f':'Armstrong Redwoods (a tree over 1,400 years old) and the Petrified Forest.','w':'The Russian River.','g':'Back roads, coast and redwoods are quiet.','p':'Mustard-season hillsides, vineyards in morning fog and the coast.'},
 ['roadside','short','halfDay'], 'Vine-covered valleys at sunset (vineyards); the Sonoma Coast at Jenner and Bodega Bay (coast); Armstrong Redwoods (giant trees)',
 [L('National Geographic: Sonoma wine country guide','https://www.nationalgeographic.com/travel/article/the-ultimate-guide-to-sonoma-wine-country-california'),L('Lonely Planet: Napa and Sonoma','https://media.lonelyplanet.com/ebookmaps/California/napa-sonoma-ch.pdf'),L('PeakVisor: Mayacamas Mountains','https://peakvisor.com/range/mayacamas-mountains.html')],
 'Nothing came back on the timing of the mustard bloom. The cities rating stays at 6 because nothing contradicts it.')

place('p0123','All six counties: Belfast, the Causeway Coast and the Antrim Glens, the Mournes, the Fermanagh lakes, Derry~Londonderry and Strangford Lough.',
 [5,0,8,3,4,6,0,8,7,7], {'m':'The Mournes (Slieve Donard about 850 m) and the Sperrins.','f':'Dark Hedges tunnel of beeches and the woods.','t':'Derry’s walls and Belfast.','w':'Lough Erne (borders five of the six counties), Marble Arch Caves, Glenariff.'},
 ['roadside','short','halfDay','longHike','airBoat'], 'The Giant’s Causeway’s basalt columns (coast); the Causeway Coast and Antrim Glens (coast); the Mourne Mountains above the sea (mountains); Lough Erne (lakes)',
 [L('National Geographic: Giant’s Causeway','https://www.nationalgeographic.com/travel/article/giants-causeway-northern-ireland'),L('Ireland.com: Causeway Coastal Route','https://www.ireland.com/en-fi/plan-your-trip/trip-ideas/causeway-coastal-route/'),L('Komoot: natural monuments in Northern Ireland','https://blog.komoot.de/guide/356350/natural-monuments-in-northern-ireland')],
 'Nothing came back on the Sperrins, and the Dark Hedges only appeared in passing. The Causeway’s age differs by source (50 to 60 million years); not used.')

place('p0124','The northern safari circuit (Serengeti, Ngorongoro, Tarangire, Lake Manyara), Kilimanjaro, and Zanzibar for the coast. Excludes the southern parks and the Western lakes.',
 [8,2,7,4,5,4,4,9,5,7], {'m':'Kilimanjaro, Meru and the Rift escarpment (the Manyara wall rises about 600 m).','d':'Dry savanna only.','c':'Zanzibar’s white beaches.','f':'Kilimanjaro’s montane forest and Zanzibar’s Jozani.','t':'Stone Town.','w':'Lake Manyara and the Momela lakes.'},
 ['roadside','short','halfDay','longHike','backcountry','airBoat'], 'Ngorongoro Crater’s rim (crater and plains); the Serengeti’s endless plains (savanna); Kilimanjaro above the plains (mountain)',
 [L('PlanetWare: tourist attractions in Tanzania','https://planetware.com/tourist-attractions/tanzania-tza.htm'),L('Lonely Planet: best places to visit in Tanzania','https://www.lonelyplanet.com/articles/best-places-to-visit-in-tanzania'),L('Study on Kilimanjaro’s glacier loss (PMC)','https://pmc.ncbi.nlm.nih.gov/articles/PMC2771743')],
 'Kilimanjaro’s height was not confirmed in the results (one source gives 19,563 ft, which conflicts with 5,895 m). The glacier data is from 2007 to 2009, so the ice rating of 4 is my judgement. Stone Town’s status was not in the results. Savanna plains have no column here, so the Serengeti’s plains are carried by the signature view, not a rating.')

place('p0134','The Coachella Valley around Palm Springs and Joshua Tree National Park, with Mount San Jacinto above Palm Springs. Excludes Death Valley and the Mojave Preserve.',
 [5,9,0,2,2,2,0,7,6,8], {'m':'Mount San Jacinto rises from the desert floor above Palm Springs (tram to about 8,500 ft).','f':'San Jacinto pine forest and the palm oases of the Indian Canyons.','t':'Palm Springs’ setting beneath the mountain.','w':'The Salton Sea, 275 ft below sea level with 375+ bird species.','p':'Joshua Tree is an International Dark Sky Park with boulders and the two deserts meeting.'},
 ['roadside','short','halfDay','longHike'], 'Joshua trees among the boulders at sunset (desert); Mount San Jacinto above Palm Springs (mountain); the Indian Canyons’ palm oases (canyons)',
 [L('PlanetWare: California desert attractions','https://www.planetware.com/california/california-desert-us-ca-11.htm'),L('Visit Greater Palm Springs: desert photography','https://www.visitgreaterpalmsprings.com/blog/post/best-places-nature-photography-california-desert-death-valley-joshua-tree/'),L('Wikipedia: Colorado Desert','https://EN.wikipedia.com/wiki/Colorado_Desert')],
 'The tramway’s height and the Indian Canyons details were not in the results; the San Jacinto mountain rating is my judgement. Anza-Borrego’s bloom timing was not found.')

place('p0141','Phuket and the Andaman Sea coast to the east and south: Phang Nga Bay, Krabi, Railay, the Phi Phi and Lanta islands and Khao Sok National Park.',
 [6,0,9,7,3,6,0,8,5,7], {'m':'The limestone towers of Phang Nga Bay, Railay and the 150+ Krabi islands count as karst mountains.','f':'Khao Sok’s rainforest.','w':'Cheow Lan Lake among the Khao Sok limestone.'},
 ['roadside','short','halfDay','airBoat'], 'Phang Nga Bay’s limestone islands (coast and karst); Railay’s cliffs and beaches (coast); the Hong island lagoons (coast)',
 [L('Lonely Planet: Andaman coast','https://www.lonelyplanet.com/articles/thailands-andaman-coast-where-sleeping-giants-lie'),L('Rough Guides: Ao Phang Nga','https://www.roughguides.com/destinations/asia/thailand/southern-thailand-andaman-coast/ao-phang-nga'),L('Audley: Krabi','https://www.audleytravel.com/us/thailand/places-to-go/krabi')],
 'Nothing came back on Khao Sok or Cheow Lan Lake, Phi Phi and Maya Bay; the forest and lake ratings are my judgement from general knowledge.')

place('p0142','Widened 20 Nov 2026 by you from Alba only to the whole region: Turin, the Langhe, Roero and Monferrato hills, the Po rice plain, the western and northern Alps (Gran Paradiso, Monviso, Monte Rosa), Lake Maggiore and Lake Orta.',
 [8,0,0,4,8,6,3,6,7,6], {'m':'The Alps are now in scope.','f':'Alpine woods.','w':'Lake Maggiore and Lake Orta.','i':'Alpine glaciers on Monte Rosa and Gran Paradiso.','g':'Quiet Alpine valleys and hill villages.','p':'Langhe fog and Monviso.'},
 ['roadside','short','halfDay','longHike','backcountry','airBoat'], 'The Langhe’s vine-striped hills with the Alps beyond (vineyards); Monviso and the western Alps (mountains); Lake Orta and Lake Maggiore (lakes)',
 [L('UNESCO: Langhe-Roero and Monferrato','https://whc.unesco.org/en/list/1390'),L('Decanter: Barolo vineyards get UNESCO status','https://www.decanter.com/wine-news/barolo-vineyards-get-unesco-world-heritage-status-9090'),L('Italia.it: Langhe, Roero and Monferrato','https://www.italia.it/en/piedmont/things-to-do/langhe-roero-and-monferrato')],
 'The search only covered the UNESCO vineyard landscape. Monviso, Monte Rosa, Gran Paradiso and the lakes had no results, so the mountain, ice and lake ratings are my judgement from general knowledge and the scope you set.')

place('p0147','Quebec City and Montreal, the Laurentians and Eastern Townships around them, Charlevoix and the Saguenay Fjord downriver.',
 [4,0,5,8,8,5,0,7,6,6], {'m':'The Laurentians, Charlevoix and the Jacques-Cartier valley are hills, not a major range.','c':'The Saguenay Fjord (about 100 km long, walls about 300 m) and the St. Lawrence at Tadoussac with belugas.','w':'The St. Lawrence and Montmorency Falls.','p':'Fall colour over Charlevoix and the fjord.'},
 ['roadside','short','halfDay','longHike','airBoat'], 'Old Quebec above the St. Lawrence (old town); fall colour in the Laurentians and Charlevoix (forests); the Saguenay Fjord (fjord)',
 [L('Audley: Charlevoix and Saguenay-Lac-Saint-Jean','https://www.audleytravel.com/us/canada/places-to-go/quebec/charlevoix-and-saguenay-lac-st-jean'),L('Wikipedia: Charlevoix Biosphere Reserve','https://en.wikipedia.com/wiki/Charlevoix_Biosphere_Reserve'),L('Wikipedia: Saguenay Fjord','https://en.wikipedia.com/wiki/Saguenay_Fjord')],
 'This place was not on my list of stale rows because its scope version is current, but its mountains and coasts were both 0 while Charlevoix and the fjord are in scope, so I added it. Nothing came back on Montmorency Falls, Jacques-Cartier or Old Quebec’s UNESCO status; the forest and cities ratings stay because nothing contradicts them. Whether Charlevoix is a biosphere reserve from 1988 or 1989 differs by source.')

place('p0189','Vancouver, the Sea to Sky Highway and Whistler, with Squamish and Garibaldi Provincial Park along the way. Excludes Vancouver Island and the Okanagan.',
 [9,0,6,8,6,7,5,7,6,7], {'c':'Howe Sound is a fjord seen from the highway.','t':'Vancouver’s skyline against the North Shore mountains.'},
 ['roadside','short','halfDay','longHike','airBoat'], 'The Stawamus Chief above Howe Sound (mountains and fjord); Garibaldi Lake and Black Tusk (mountains and lakes); Whistler’s peaks (mountains)',
 [L('HelloBC: Sea to Sky Highway','https://hellobc.com/road-trips/sea-to-sky-highway-route'),L('Whistler.com: highlights of the Sea to Sky Highway','https://www.whistler.com/blog/post/highlights-of-the-sea-to-sky-highway/'),L('Destination Canada: Vancouver to Whistler','https://travel.destinationcanada.com/things-to-do/vancouver-to-whistler-itinerary')],
 'Nothing came back on the North Shore mountains or Stanley Park. “From the air or a boat” (Howe Sound cruises and floatplanes) is from general knowledge, not the results; tell me to remove it if you prefer.')

place('p0196','The whole country: Eryri, the Brecon Beacons, the Pembrokeshire and Gower coasts, Anglesey, Cardigan Bay and Cardiff.',
 [7,0,7,4,5,7,0,6,7,7], {'c':'The Pembrokeshire Coast Path (186 miles; the only British national park defined by its coastline), Gower and Anglesey.','t':'Portmeirion, Conwy and Cardiff.'},
 ['roadside','short','halfDay','longHike','airBoat'], 'Snowdon and the Glyderau (mountains); the Pembrokeshire coast (cliffs and sea); Portmeirion (village)',
 [L('Wanderlust: Wales national parks and nature reserves','https://www.wanderlustmagazine.com/inspiration/wales-national-parks-and-nature-reserves/'),L('Rough Guides: 11 breathtaking Welsh views','https://www.roughguides.com/articles/11-breathtaking-welsh-views/'),L('Lonely Planet: first time in Wales','https://www.lonelyplanet.com/articles/first-time-wales-discover')],
 'The claim that Gower was Britain’s first AONB was not found and is not used. Boat trips from St Davids to the islands are from general knowledge.')

import sys
out = {}
for key, p in P.items():
    o = oldby[key]; f = o['facts']
    oldr = {k: f.get(FIELD[k]) for k in K}
    out[key] = dict(label=o['label'], scope=p['scope'], old=oldr, new=p['new'], why=p['why'], vaOld=f.get('viewAccess') or [], vaNew=p['va'], sigOld=f.get('signatureViews') or '', sigNew=p['sig'], sources=p['sources'], gaps=p['gaps'], verdict=p['verdict'])
json.dump(out, open('scripts/data/scenic-facts-21-proposal-nov21.json','w'), indent=1, ensure_ascii=False)
tot = sum(1 for v in out.values() for k in K if v['old'][k] != v['new'][k])
print(len(out), 'places;', tot, 'changed ratings')
for v in out.values():
    print(v['label'], sum(1 for k in K if v['old'][k] != v['new'][k]), 'changed')
