/* =================== sample data (invented for the mockup) =================== */
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const APT=[
 ['Atlanta','ATL','Georgia, US','JFK',1.5,1],['Austin','AUS','Texas, US','ORD',.2,0],['Boston','BOS','Massachusetts, US','JFK',.1,1],['Charlotte','CLT','North Carolina, US','JFK',.8,0],['Chicago','ORD','Illinois, US (O\'Hare)','ORD',0,1],['Chicago','MDW','Illinois, US (Midway)','ORD',.1,0],['Dallas','DFW','Texas, US','ORD',.4,1],['Denver','DEN','Colorado, US','ORD',-.6,1],['Detroit','DTW','Michigan, US','ORD',.3,0],['Honolulu','HNL','Hawaii, US',null,0,0],['Houston','IAH','Texas, US','ORD',.5,1],['Las Vegas','LAS','Nevada, US','LAX',.7,0],['Los Angeles','LAX','California, US','LAX',0,1],['Miami','MIA','Florida, US','JFK',1.4,1],['Minneapolis','MSP','Minnesota, US','ORD',-.2,0],['Nashville','BNA','Tennessee, US','ORD',.6,0],['New Orleans','MSY','Louisiana, US','ORD',.8,0],['New York','JFK','New York, US (Kennedy)','JFK',0,1],['New York','LGA','New York, US (LaGuardia)','JFK',0,0],['Newark','EWR','New Jersey, US','JFK',0,1],['Oakland','OAK','California, US','SFO',.1,0],['Orlando','MCO','Florida, US','JFK',1.3,0],['Philadelphia','PHL','Pennsylvania, US','JFK',.1,0],['Phoenix','PHX','Arizona, US','LAX',.8,0],['Portland','PDX','Oregon, US','SFO',1.4,0],['Raleigh','RDU','North Carolina, US','JFK',.6,0],['Sacramento','SMF','California, US','SFO',.2,0],['Salt Lake City','SLC','Utah, US','SFO',1.1,0],['San Diego','SAN','California, US','LAX',.2,0],['San Francisco','SFO','California, US','SFO',0,1],['San Jose','SJC','California, US','SFO',.2,0],['Seattle','SEA','Washington, US','SFO',1.8,1],['St. Louis','STL','Missouri, US','ORD',.4,0],['Tampa','TPA','Florida, US','JFK',1.3,0],['Washington','DCA','DC, US (Reagan)','JFK',.1,0],['Washington','IAD','Virginia, US (Dulles)','JFK',.1,1],
 ['Toronto','YYZ','Ontario, Canada','JFK',.2,1],['Vancouver','YVR','British Columbia, Canada','SFO',1.5,1],['Montreal','YUL','Quebec, Canada','JFK',.2,0],['Mexico City','MEX','Mexico',null,0,0],['London','LHR','England (Heathrow)',null,0,0],['London','LGW','England (Gatwick)',null,0,0],['Paris','CDG','France',null,0,0],['Amsterdam','AMS','Netherlands',null,0,0],['Frankfurt','FRA','Germany',null,0,0],['Madrid','MAD','Spain',null,0,0],['Dublin','DUB','Ireland',null,0,0],['Sydney','SYD','Australia',null,0,0],['Tokyo','HND','Japan (Haneda)',null,0,0],['Tokyo','NRT','Japan (Narita)',null,0,0],['Singapore','SIN','Singapore',null,0,0],['Dubai','DXB','UAE',null,0,0],['Sao Paulo','GRU','Brazil',null,0,0],['Mumbai','BOM','India',null,0,0],['Cape Town','CPT','South Africa',null,0,0],['Auckland','AKL','New Zealand',null,0,0],['Seoul','ICN','South Korea',null,0,0],['Hong Kong','HKG','Hong Kong',null,0,0]];
const APTM=Object.fromEntries(APT.map(a=>[a[1],{city:a[0],code:a[1],reg:a[2],proxy:a[3],off:a[4],big:a[5]}]));
/* Flight times in this mockup are invented for four hub cities. Any other airport borrows the nearest hub plus a little; overseas airports have no numbers, so flight limits do nothing for them. */
function hrsOf(d,s){const a=APTM[s.origin];if(!a||!a.proxy||d.hrs[a.proxy]==null)return null;return Math.max(1,Math.round((d.hrs[a.proxy]+a.off)*2)/2)}
function nonstopOf(d,s){const a=APTM[s.origin];if(!a)return false;if(d.direct.includes(s.origin))return true;return !!(a.proxy&&a.big&&d.direct.includes(a.proxy)&&a.off<=1.5)}
function hpRes(){const q=st.hq.trim().toLowerCase();if(q.length<2)return '<div class="fine" style="margin:0">Start typing a city, like “San”, or an airport code like “JFK”.</div>';
 const rk=a=>a[0].toLowerCase().startsWith(q)?0:a[1].toLowerCase().startsWith(q)?1:a[0].toLowerCase().split(/[^a-z]+/).some(w=>w.startsWith(q))?2:a[2].toLowerCase().includes(q)&&q.length>2?3:9;
 const hits=APT.filter(a=>rk(a)<9).sort((a,b)=>rk(a)-rk(b)).slice(0,6);
 return hits.length?`<div class="hpl">${hits.map(a=>`<button class="hpo" data-a="hpick" data-k="${a[1]}"><span><b>${esc(a[0])}</b><small>${esc(a[2])}</small></span><em>${a[1]}</em></button>`).join('')}</div>`:`<div class="fine" style="margin:0">No airport found for “${esc(st.hq.trim())}”. Try the nearest big city.</div>`}
function homePick(){if(st.originSet){const a=APTM[st.origin];return `<div class="hpset"><span class="hpc">📍 <b>${esc(a.city)}</b> <em>${a.code}</em></span><button class="link" data-a="hclear">Change</button></div>`}
 return `<div class="hp"><input class="hpin" type="search" placeholder="Type a city or airport code" value="${esc(st.hq)}" autocomplete="off" aria-label="Home city or airport"><div class="hpres">${hpRes()}</div></div>`}
const ATTR={beach:'Beach days',food:'Food scene',hotels:'Great hotels',adventure:'Adventure',culture:'History and culture',night:'Nightlife',quiet:'Peace and quiet',nature:'Wild nature'};
const DATA={"SL": [["wildlifeViewing", "Wildlife Viewing", "\ud83e\udd81", "Nature & Wildlife", "popular"], ["birding", "Birding", "\ud83e\udd9c", "Nature & Wildlife", "specialist"], ["safari", "Safari", "\ud83d\udc18", "Nature & Wildlife", "enthusiast"], ["whaleWatching", "Whale Watching", "\ud83d\udc0b", "Nature & Wildlife", "enthusiast"], ["scenicLandscapes", "Scenic Landscapes", "\ud83c\udfde\ufe0f", "Nature & Wildlife", "iconic"], ["landscapePhotography", "Landscape Photography", "\ud83d\udcf8", "Nature & Wildlife", "specialist"], ["campingBackcountry", "Camping & Backcountry", "\ud83c\udfd5\ufe0f", "Nature & Wildlife", "enthusiast"], ["stargazing", "Stargazing", "\u2728", "Nature & Wildlife", "enthusiast"], ["auroraChasing", "Northern Lights / Aurora", "\ud83c\udf0c", "Nature & Wildlife", "enthusiast"], ["geologyVolcanoes", "Geology & Volcanoes", "\ud83c\udf0b", "Nature & Wildlife", "enthusiast"], ["wildflowerBlooms", "Wildflowers & Seasonal Blooms", "\ud83c\udf38", "Nature & Wildlife", "specialist"], ["hiking", "Hiking & Trekking", "\ud83e\udd7e", "Sports & Recreation", "popular"], ["mountaineering", "Mountaineering & Rock Climbing", "\ud83e\uddd7", "Sports & Recreation", "specialist"], ["cyclingRoad", "Cycling - Road & Gravel Biking", "\ud83d\udeb4", "Sports & Recreation", "enthusiast"], ["mountainBiking", "Mountain Biking", "\ud83d\udeb5", "Sports & Recreation", "enthusiast"], ["skiingSnowboarding", "Skiing & Snowboarding", "\u26f7\ufe0f", "Sports & Recreation", "popular"], ["surfing", "Surfing", "\ud83c\udfc4", "Sports & Recreation", "enthusiast"], ["diving", "Snorkeling & Diving", "\ud83e\udd3f", "Sports & Recreation", "enthusiast"], ["windSports", "Windsurfing & Kitesurfing", "\ud83e\ude81", "Sports & Recreation", "enthusiast"], ["sailing", "Sailing & Boating", "\u26f5", "Sports & Recreation", "specialist"], ["kayakingRafting", "Kayaking & Rafting", "\ud83d\udef6", "Sports & Recreation", "enthusiast"], ["adventureSports", "Adventure Sports", "\ud83e\ude82", "Sports & Recreation", "enthusiast"], ["golf", "Golf", "\u26f3", "Sports & Recreation", "enthusiast"], ["fishing", "Fishing", "\ud83c\udfa3", "Sports & Recreation", "enthusiast"], ["horsebackRiding", "Horseback Riding", "\ud83d\udc34", "Sports & Recreation", "specialist"], ["trailRunning", "Trail Running", "\ud83c\udfc3", "Sports & Recreation", "specialist"], ["historyArchaeology", "History & Archaeology", "\ud83c\udffa", "Culture & Discovery", "iconic"], ["museumsArt", "Museums & Art", "\ud83d\uddbc\ufe0f", "Culture & Discovery", "popular"], ["architecture", "Architecture", "\ud83c\udfdb\ufe0f", "Culture & Discovery", "iconic"], ["cityExploration", "Local Culture & City Exploration", "\ud83d\udeb6", "Culture & Discovery", "iconic"], ["indigenousCultures", "Indigenous Cultures", "\ud83e\udeb6", "Culture & Discovery", "specialist"], ["religiousSites", "Religious & Spiritual Sites", "\ud83d\udd4c", "Culture & Discovery", "popular"], ["festivals", "Festivals & Live Events", "\ud83c\udf89", "Culture & Discovery", "enthusiast"], ["traditionalCrafts", "Traditional Arts & Crafts", "\ud83e\uddf5", "Culture & Discovery", "specialist"], ["streetFood", "Street Food & Markets", "\ud83e\udd58", "Culture & Discovery", "iconic"], ["fineDining", "Fine Dining", "\ud83c\udf7d\ufe0f", "Culture & Discovery", "popular"], ["wineSpirits", "Wine & Spirits Tasting", "\ud83c\udf77", "Culture & Discovery", "enthusiast"], ["coffeeTea", "Specialty Coffee & Tea", "\u2615", "Culture & Discovery", "specialist"], ["beachesSwimming", "Beaches & Swimming", "\ud83c\udfd6\ufe0f", "Relaxation & Leisure", "iconic"], ["sunbathing", "Sunbathing", "\u2600\ufe0f", "Relaxation & Leisure", "popular"], ["luxuryHotels", "Luxury Hotels", "\ud83c\udfe8", "Relaxation & Leisure", "popular"], ["allInclusive", "All-inclusive Resorts", "\ud83c\udfdd\ufe0f", "Relaxation & Leisure", "popular"], ["spaWellness", "Spa & Wellness", "\ud83d\udc86", "Relaxation & Leisure", "enthusiast"], ["hotSprings", "Hot Springs", "\u2668\ufe0f", "Relaxation & Leisure", "enthusiast"], ["yogaRetreats", "Yoga & Wellness Retreats", "\ud83e\uddd8", "Relaxation & Leisure", "specialist"], ["themeParks", "Theme Parks & Attractions", "\ud83c\udfa2", "Relaxation & Leisure", "popular"], ["nightlife", "Nightlife", "\ud83c\udf78", "Relaxation & Leisure", "popular"], ["shopping", "Shopping", "\ud83d\udecd\ufe0f", "Relaxation & Leisure", "popular"], ["deals", "Low-Season Deals", "\ud83d\udcb8", "Value", "specialist"], ["crowds", "Avoiding Crowds", "\ud83e\uddd8", "Value", "specialist"], ["roadtrip", "Road-Tripping", "\ud83d\ude97", "Value", "enthusiast"]], "REL": {"wildlifeViewing": ["whaleWatching", "safari", "wildflowerBlooms", "landscapePhotography"], "birding": [], "safari": ["whaleWatching", "wildlifeViewing", "wildflowerBlooms", "geologyVolcanoes", "scenicLandscapes"], "whaleWatching": ["safari", "wildlifeViewing", "wildflowerBlooms", "geologyVolcanoes", "scenicLandscapes"], "scenicLandscapes": ["geologyVolcanoes", "landscapePhotography", "roadtrip", "wildflowerBlooms", "stargazing"], "landscapePhotography": ["scenicLandscapes", "wildflowerBlooms", "roadtrip", "geologyVolcanoes", "stargazing"], "campingBackcountry": ["horsebackRiding", "kayakingRafting", "adventureSports", "mountaineering", "geologyVolcanoes"], "stargazing": ["auroraChasing", "geologyVolcanoes", "wildflowerBlooms", "scenicLandscapes", "campingBackcountry"], "auroraChasing": ["stargazing", "geologyVolcanoes", "scenicLandscapes", "wildflowerBlooms", "campingBackcountry"], "geologyVolcanoes": ["wildflowerBlooms", "scenicLandscapes", "stargazing", "campingBackcountry", "auroraChasing"], "wildflowerBlooms": ["geologyVolcanoes", "scenicLandscapes", "stargazing", "landscapePhotography", "hiking"], "hiking": ["trailRunning", "mountaineering", "campingBackcountry", "wildflowerBlooms", "geologyVolcanoes"], "mountaineering": ["trailRunning", "adventureSports", "hiking", "campingBackcountry", "mountainBiking"], "cyclingRoad": ["mountainBiking"], "mountainBiking": ["adventureSports", "mountaineering", "kayakingRafting", "trailRunning", "campingBackcountry"], "skiingSnowboarding": ["adventureSports", "mountaineering", "trailRunning", "mountainBiking", "kayakingRafting"], "surfing": ["beachesSwimming", "kayakingRafting"], "diving": [], "sailing": ["luxuryHotels", "allInclusive", "beachesSwimming"], "kayakingRafting": ["adventureSports", "horsebackRiding", "campingBackcountry", "mountainBiking", "roadtrip"], "adventureSports": ["mountainBiking", "kayakingRafting", "mountaineering", "trailRunning", "campingBackcountry"], "golf": ["allInclusive", "luxuryHotels", "hotSprings", "yogaRetreats", "crowds"], "fishing": [], "horsebackRiding": ["campingBackcountry", "kayakingRafting", "adventureSports", "hotSprings", "allInclusive"], "trailRunning": ["mountaineering", "hiking", "adventureSports", "campingBackcountry", "mountainBiking"], "historyArchaeology": ["museumsArt", "religiousSites", "indigenousCultures", "traditionalCrafts", "festivals"], "museumsArt": ["historyArchaeology", "religiousSites", "indigenousCultures", "traditionalCrafts", "architecture"], "architecture": ["religiousSites", "historyArchaeology", "museumsArt", "cityExploration", "indigenousCultures"], "cityExploration": ["indigenousCultures", "traditionalCrafts", "religiousSites", "historyArchaeology", "festivals"], "indigenousCultures": ["traditionalCrafts", "religiousSites", "historyArchaeology", "festivals", "coffeeTea"], "religiousSites": ["historyArchaeology", "indigenousCultures", "traditionalCrafts", "museumsArt", "architecture"], "festivals": ["indigenousCultures", "traditionalCrafts", "religiousSites", "historyArchaeology", "coffeeTea"], "traditionalCrafts": ["indigenousCultures", "religiousSites", "historyArchaeology", "festivals", "coffeeTea"], "streetFood": ["coffeeTea", "fineDining", "indigenousCultures", "traditionalCrafts", "historyArchaeology"], "fineDining": ["coffeeTea", "luxuryHotels", "streetFood", "allInclusive"], "wineSpirits": [], "coffeeTea": ["streetFood", "fineDining", "indigenousCultures", "traditionalCrafts", "religiousSites"], "beachesSwimming": ["kayakingRafting", "sailing", "surfing"], "sunbathing": ["allInclusive", "hotSprings", "yogaRetreats"], "luxuryHotels": ["allInclusive", "fineDining", "golf", "spaWellness", "sailing"], "allInclusive": ["luxuryHotels", "sunbathing", "hotSprings", "golf", "yogaRetreats"], "spaWellness": ["yogaRetreats", "hotSprings", "allInclusive", "luxuryHotels", "golf"], "hotSprings": ["yogaRetreats", "spaWellness", "allInclusive", "horsebackRiding", "golf"], "yogaRetreats": ["hotSprings", "spaWellness", "allInclusive", "golf", "horsebackRiding"], "themeParks": ["allInclusive", "kayakingRafting", "adventureSports"], "nightlife": ["cityExploration"], "shopping": ["traditionalCrafts", "cityExploration"], "deals": [], "crowds": ["golf"], "roadtrip": ["scenicLandscapes", "landscapePhotography", "kayakingRafting", "geologyVolcanoes", "campingBackcountry"]}};
/* The 51 interests, groups and audience tiers come straight from the app (scoring/constants.ts). Old prototype ids are kept for the ten that already had follow-up questions. */
const OLD={wineSpirits:'wine',landscapePhotography:'photo',wildlifeViewing:'wildlife',spaWellness:'spa'};
const NEWK=Object.fromEntries(Object.entries(OLD).map(([a,b])=>[b,a]));
const SHORT={cyclingRoad:'Road and gravel cycling',mountaineering:'Climbing and mountaineering',wildflowerBlooms:'Wildflowers',cityExploration:'City and local culture',auroraChasing:'Northern lights',religiousSites:'Spiritual sites',diving:'Diving and snorkeling',windSports:'Wind and kite surfing',kayakingRafting:'Kayaking and rafting',historyArchaeology:'History and archaeology',museumsArt:'Museums and art',wineSpirits:'Wine and spirits',spaWellness:'Spa and wellness',skiingSnowboarding:'Skiing and snowboarding',beachesSwimming:'Beaches and swimming',streetFood:'Street food and markets',coffeeTea:'Coffee and tea',traditionalCrafts:'Traditional crafts',geologyVolcanoes:'Geology and volcanoes',campingBackcountry:'Camping and backcountry',landscapePhotography:'Landscape photography',allInclusive:'All-inclusive resorts',themeParks:'Theme parks',indigenousCultures:'Indigenous cultures',festivals:'Festivals and live events',yogaRetreats:'Yoga retreats',hotSprings:'Hot springs',deals:'Low-season deals',crowds:'Avoiding crowds',roadtrip:'Road trips',horsebackRiding:'Horseback riding',trailRunning:'Trail running',mountainBiking:'Mountain biking',adventureSports:'Adventure sports',sailing:'Sailing and boating',luxuryHotels:'Luxury hotels',fineDining:'Fine dining'};
const MAXSTAR=5;
const SUBCH={
 scenicLandscapes:['Mountains and glaciers','Coast and cliffs','Deserts and canyons','Lakes and waterfalls'],wildlife:['Big animals','Small animals','Marine life','Rare sightings'],birding:['Endemic species','Seabirds','Raptors','Casual birding'],safari:['Big Five parks','Migrations','Walking safaris','Luxury lodges'],whaleWatching:['Humpbacks','Orcas','Blue whales','Dolphins'],photo:['Golden hour','Dramatic weather','Long exposures','Wide vistas'],campingBackcountry:['Car camping','Backpacking','Glamping','Remote wilderness'],stargazing:['Dark-sky parks','Observatories','Milky Way','Meteor showers'],auroraChasing:['Aurora viewing','Winter landscapes','Dark skies'],geologyVolcanoes:['Active volcanoes','Lava fields','Caves','Geysers and hot springs'],wildflowerBlooms:['Alpine meadows','Desert blooms','Spring blossoms'],
 hiking:['Easy walks','Day hikes','Multi-day treks','Hut-to-hut'],mountaineering:['Rock climbing','Alpine climbing','Via ferrata','Bouldering'],cyclingRoad:['Road riding','Gravel','Big climbs','Easy rides'],mountainBiking:['Cross-country','Downhill parks','Bikepacking'],skiingSnowboarding:['Downhill','Cross-country','Off-piste','Resort villages'],surfing:['Beginner waves','Intermediate waves','Advanced waves','Surf lessons'],diving:['Colorful reefs','Wrecks','Caves and cenotes','Big animals'],windSports:['Windsurfing','Kitesurfing','Wing foiling','Lessons'],sailing:['Day sails','Bareboat charter','Crewed yacht','Racing'],kayakingRafting:['Sea kayaking','Whitewater rafting','Calm rivers','Multi-day trips'],adventureSports:['Ziplining','Paragliding','Canyoning','Bungee'],golf:['Resort courses','Links golf','Bucket-list courses'],fishing:['Offshore big game','Fly fishing','Inshore and flats'],horsebackRiding:['Trail rides','Beach rides','Multi-day treks'],trailRunning:['Mountain races','Ultra distances','Easy trails'],
 historyArchaeology:['Ancient ruins','Medieval sites','Battlefields','Archaeological digs'],museumsArt:['Fine art','Modern art','History museums','Small galleries'],architecture:['Modern architecture','Ancient ruins','Castles and palaces','Religious buildings'],cityExploration:['Old towns','Neighborhood walks','Markets','Local hangouts'],indigenousCultures:['Living traditions','Guided visits','Craft villages'],religiousSites:['Temples and shrines','Cathedrals','Pilgrimage routes','Mosques'],festivals:['Music festivals','Food festivals','Cultural celebrations','Sporting events'],traditionalCrafts:['Pottery','Textiles','Woodcarving','Workshops'],streetFood:['Night markets','Food tours','Cooking classes','Local specialties'],fineDining:['Tasting menus','Michelin-starred','Chef experiences','Wine pairings'],wine:['Wine regions','Whisky and spirits','Craft beer','Tastings'],coffeeTea:['Coffee farms','Tea ceremonies','Specialty cafes'],
 beachesSwimming:['Calm swimming beaches','Surf beaches','Remote beaches','Resort beaches'],sunbathing:['Quiet shores','Beach clubs','Pool days'],luxuryHotels:['Boutique hotels','Grand resorts','Villas','Overwater stays'],allInclusive:['Family resorts','Adults-only','Active resorts'],spa:['Massages','Thermal baths','Day spas','Wellness resorts'],hotSprings:['Natural pools','Onsen','Geothermal spas'],yogaRetreats:['Yoga','Meditation','Detox retreats','Surf and yoga'],themeParks:['Big theme parks','Water parks','Zoos and aquariums'],nightlife:['Bars','Clubs','Live music','Rooftops'],shopping:['Markets','Luxury shopping','Local crafts','Outlets']};
/* chips that map onto the prototype's follow-up flavors, so a chip can stand in for the expert-lane question */
const CHIPSUB={fishing:{'Offshore big game':'offshore','Fly fishing':'fly','Inshore and flats':'inshore'},golf:{'Resort courses':'resort','Links golf':'links'},surfing:{'Beginner waves':'beginner','Intermediate waves':'mid','Advanced waves':'advanced'},diving:{'Colorful reefs':'reef','Caves and cenotes':'cave','Big animals':'big'}};
const LEVELS=[['off','Off',0],['cur','Curious',1],['like','Like',2],['love','Love',2.5],['top','Top',3]];
const lvlOf=w=>!w?'off':w>=3?'top':w>=2.5?'love':w>=2?'like':'cur';
const TIERN={iconic:0,popular:1,enthusiast:2,specialist:3};
const LBL={yogaRetreats:'Yoga & Wellness',wildflowerBlooms:'Seasonal Blooms',mountaineering:'Climbing & Mountaineering'};
const SL=DATA.SL.filter(r=>r[3]!=='Value').map(([k,l,e,g,t],ix)=>({id:OLD[k]||k,key:k,label:LBL[k]||l,emoji:e,group:g,tier:t,ix}));
const SLM={};SL.forEach(s=>SLM[s.id]=s);
const INT={};SL.forEach(s=>INT[s.id]=[s.label,s.emoji]);
const GROUPS=[['Nature & Wildlife','🌿','Animals, landscapes and the night sky'],['Sports & Recreation','🥾','Things you do with your body'],['Culture & Discovery','🏛️','History, art, food and local life'],['Relaxation & Leisure','🏖️','Beaches, spas and a good time']];
const PRIM={'Nature & Wildlife':['scenicLandscapes','wildlife','safari','whaleWatching','campingBackcountry','stargazing','birding','photo'],
 'Sports & Recreation':['hiking','skiingSnowboarding','cyclingRoad','surfing','diving','golf','fishing','sailing'],
 'Culture & Discovery':['historyArchaeology','architecture','cityExploration','streetFood','museumsArt','fineDining','festivals','wine'],
 'Relaxation & Leisure':['beachesSwimming','sunbathing','luxuryHotels','nightlife','shopping','spa','hotSprings','yogaRetreats']};
const byGroup=g=>{const all=SL.filter(s=>s.group===g);const pr=PRIM[g].map(id=>SLM[id]);const rest=all.filter(s=>!pr.includes(s)).sort((a,b)=>TIERN[a.tier]-TIERN[b.tier]||a.ix-b.ix);return [...pr,...rest]};
/* "People who pick X often add Y": similarity of the app's own Travel DNA attribute weights, with a few hand fixes where the weights have no signal. */
const REL={};Object.entries(DATA.REL).forEach(([k,v])=>REL[OLD[k]||k]=v.map(x=>OLD[x]||x));
Object.assign(REL,{birding:['wildlife','safari','photo'],windSports:['surfing','sailing','kayakingRafting','beachesSwimming'],golf:['luxuryHotels','allInclusive','fineDining','spa'],spa:['yogaRetreats','hotSprings','luxuryHotels','beachesSwimming']});
const SYN={scuba:'diving',snorkel:'diving',snorkeling:'diving',dive:'diving',ski:'skiingSnowboarding',snowboard:'skiingSnowboarding',kite:'windSports',windsurf:'windSports',pottery:'traditionalCrafts',weaving:'traditionalCrafts',coffee:'coffeeTea',tea:'coffeeTea',beer:'wine',whisky:'wine',cocktails:'nightlife',club:'nightlife',bars:'nightlife',lions:'safari',elephants:'safari',bears:'wildlife',whales:'whaleWatching',stars:'stargazing',aurora:'auroraChasing',volcano:'geologyVolcanoes',climb:'mountaineering',bike:'cyclingRoad',cycling:'cyclingRoad',run:'trailRunning',horse:'horsebackRiding',kayak:'kayakingRafting',raft:'kayakingRafting',boat:'sailing',yoga:'yogaRetreats',temple:'religiousSites',church:'religiousSites',mosque:'religiousSites',ruins:'historyArchaeology',castle:'architecture',tapas:'streetFood',markets:'streetFood',spa:'spa',massage:'spa',pool:'beachesSwimming',swim:'beachesSwimming',tan:'sunbathing',camp:'campingBackcountry',trek:'hiking',walk:'hiking',photo:'photo',photography:'photo',bird:'birding',flowers:'wildflowerBlooms',bungee:'adventureSports',zipline:'adventureSports',rollercoaster:'themeParks',disney:'themeParks',mall:'shopping',deal:'deals',cheap:'deals',quiet:'crowds',drive:'roadtrip',car:'roadtrip'};
const SUBL={fishing:{offshore:'offshore big game',fly:'fly fishing',inshore:'inshore and flats'},golf:{resort:'resort courses',links:'links golf'},surfing:{beginner:'learner-friendly waves',advanced:'serious waves',mid:'waves for your level'},diving:{reef:'colorful reefs',cave:'caves and cenotes',big:'big animals'}};
const WEIGHT=['','A nice extra','A big part','The reason for the trip'];
const BUDGETS=[['$','Basic'],['$$','Comfortable'],['$$$','High-end'],['$$$$','Luxury']];
const WHO={solo:{n:'Solo',a:{culture:.5,adventure:.5}},friends:{n:'With friends',a:{night:.8,adventure:.5}},partner:{n:'With a spouse or partner',a:{hotels:.5,quiet:.5}},kids:{n:'With my kids',a:{beach:.8,nature:.5,night:-.6}}};
const MONF=['January','February','March','April','May','June','July','August','September','October','November','December'];
let SV='v2';
const VIBES={
 beach:{n:'Toes in the sand',e:'🏖️',g:'linear-gradient(135deg,#1c7c8a,#e9a95b)',a:{beach:1.5,quiet:.5}},
 food:{n:'Long lunches and market crawls',e:'🍜',g:'linear-gradient(135deg,#a8452c,#e0a24a)',a:{food:1.5}},
 hotel:{n:'A hotel you never want to leave',e:'🛎️',g:'linear-gradient(135deg,#3b3f6e,#b58fc4)',a:{hotels:1.5,quiet:.5}},
 trail:{n:'Trail dust and big views',e:'🏔️',g:'linear-gradient(135deg,#2f5d44,#8aa6b8)',a:{adventure:1,nature:1}},
 old:{n:'Old streets and big museums',e:'🏛️',g:'linear-gradient(135deg,#6b4a2f,#c9a77a)',a:{culture:1.5}},
 night:{n:'Rooftops and late nights',e:'🍸',g:'linear-gradient(135deg,#271a4d,#c0407a)',a:{night:1.5}},
 wild:{n:'Wild animals up close',e:'🐆',g:'linear-gradient(135deg,#3d5a24,#c9a23a)',a:{nature:1.5,adventure:.5}},
 quiet:{n:'Total quiet',e:'🌿',g:'linear-gradient(135deg,#1f4a4a,#7fb59a)',a:{quiet:1.5,nature:.5}}
};
const CARDS=[
 {e:'🌋',t:'Sunrise hike to a volcano crater',a:{adventure:1,nature:1}},
 {e:'🍽️',t:'A three-hour tasting menu, no phones',a:{food:1.4,hotels:.4}},
 {e:'🌴',t:'A whole day with nothing planned',a:{quiet:1.2,beach:.6}},
 {e:'🏮',t:'Night market food crawl',a:{food:1,night:.8,culture:.4}},
 {e:'⛵',t:'A private boat day, no itinerary',a:{beach:1,adventure:.4,hotels:.6}}
];
/* i = interest strengths, sub = flavors, m = how good each month is, direct = nonstop from, hrs = flying hours from each origin */
const TEMP={hot:[85,200],warm:[75,85],mild:[60,75],cool:[0,60]};
const FOODL={veg:'Vegetarian',vegan:'Vegan',gf:'Gluten-free',halal:'Halal',kosher:'Kosher'};
const D=[
{id:'maui',n:'Maui',c:'Hawaii',e:'🌺',cost:3,tag:'Beach days, big waves and volcano sunrises',
 a:{beach:9,food:7,hotels:8,adventure:7,culture:4,night:4,quiet:6,nature:8},i:{surfing:8,diving:7,golf:8,fishing:7,hiking:7,spa:7,wildlife:7,photo:8,birding:5,wine:3},
 sub:{fishing:{offshore:7,inshore:5,fly:1},surfing:{beginner:8,advanced:8},golf:{resort:9,links:3},diving:{reef:8,cave:2,big:6}},
 m:[8,8,8,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8,8],direct:['SFO','LAX','ORD'],hrs:{SFO:5.5,LAX:5.5,ORD:8.5,JFK:11}},
{id:'kona',n:'Kona Coast',c:'Big Island, Hawaii',e:'🎣',cost:3,tag:'Blue marlin water and manta rays at night',
 a:{beach:7,food:6,hotels:7,adventure:8,culture:4,night:2,quiet:8,nature:9},i:{fishing:10,diving:9,hiking:8,wildlife:7,photo:8,golf:6,surfing:4,spa:5,birding:6,wine:2},
 sub:{fishing:{offshore:10,inshore:5,fly:1},diving:{reef:8,cave:2,big:9},golf:{resort:8,links:2},surfing:{beginner:3,advanced:4}},
 m:[7.5,7.5,7.5,8,8.5,9,9,9,8.5,8.5,8,7.5],direct:['SFO','LAX'],hrs:{SFO:6,LAX:6,ORD:9,JFK:12}},
{id:'lisbon',n:'Lisbon and the Algarve',c:'Portugal',e:'🏖️',cost:2,tag:'Seafood, tiled hill towns and cliff-top golf',
 a:{beach:7,food:9,hotels:7,adventure:6,culture:9,night:8,quiet:4,nature:6},i:{golf:10,surfing:8,hiking:7,wine:9,photo:8,fishing:5,diving:4,birding:6,wildlife:3,spa:5},
 sub:{golf:{resort:10,links:5},surfing:{beginner:9,advanced:8},fishing:{offshore:5,inshore:6,fly:1},diving:{reef:4,cave:1,big:3}},
 m:[4,4.5,6,7,8,8.5,9,9,8.5,7.5,5,4],direct:['SFO','JFK','ORD'],hrs:{SFO:11,JFK:6.5,ORD:8.5,LAX:12}},
{id:'rivieramaya',n:'Riviera Maya',c:'Mexico',e:'🌴',cost:2,tag:'Turquoise water, cenotes and Maya ruins',
 a:{beach:10,food:7,hotels:9,adventure:7,culture:7,night:7,quiet:4,nature:6},i:{diving:9,fishing:8,golf:7,birding:7,wildlife:6,spa:7,photo:7,hiking:3,surfing:2,wine:2},
 sub:{diving:{reef:8,cave:10,big:5},fishing:{offshore:6,inshore:8,fly:9},golf:{resort:8,links:2},surfing:{beginner:2,advanced:1}},
 m:[8,8.5,9,9,7.5,6,6,6,5,5.5,8,8.5],direct:['SFO','LAX','JFK','ORD'],hrs:{SFO:4.5,LAX:4,JFK:4,ORD:3.5}},
{id:'bali',n:'Bali',c:'Indonesia',e:'🛕',cost:1,tag:'Rice terraces, temples, surf breaks and spas',
 a:{beach:7,food:8,hotels:8,adventure:7,culture:9,night:7,quiet:6,nature:8},i:{spa:10,surfing:9,diving:7,hiking:8,photo:9,birding:6,wildlife:4,golf:6,fishing:4,wine:3},
 sub:{surfing:{beginner:9,advanced:9},diving:{reef:7,cave:1,big:6},fishing:{offshore:5,inshore:5,fly:0},golf:{resort:7,links:2}},
 m:[5,5,5.5,7,8,8.5,8.5,8.5,8.5,8,6.5,5.5],direct:[],hrs:{SFO:20,LAX:19,JFK:24,ORD:23}},
{id:'maldives',n:'The Maldives',c:'Indian Ocean',e:'🏝️',cost:4,tag:'Overwater villas and world-class reef diving',
 a:{beach:10,food:6,hotels:10,adventure:5,culture:2,night:2,quiet:10,nature:8},i:{diving:10,surfing:7,fishing:6,spa:9,photo:8,wildlife:6,hiking:0,golf:2,birding:2,wine:2},
 sub:{diving:{reef:10,cave:1,big:9},surfing:{beginner:2,advanced:9},fishing:{offshore:6,inshore:8,fly:3},golf:{resort:2,links:0}},
 m:[9,9.5,9.5,9,6,5,5,5.5,5,5.5,7,8.5],direct:[],hrs:{SFO:22,LAX:22,JFK:18,ORD:20}},
{id:'costarica',n:'Costa Rica',c:'Pacific and Caribbean coasts',e:'🦜',cost:2,tag:'Cloud forest, sloths, surf and sailfish',
 a:{beach:7,food:6,hotels:6,adventure:10,culture:4,night:4,quiet:6,nature:10},i:{birding:10,wildlife:9,surfing:9,hiking:8,fishing:9,diving:5,photo:9,spa:6,golf:4,wine:2},
 sub:{fishing:{offshore:9,inshore:7,fly:2},surfing:{beginner:9,advanced:8},diving:{reef:5,cave:0,big:7},golf:{resort:5,links:0}},
 m:[9,9.5,9.5,9,6,5.5,6,5.5,4.5,4.5,6,8.5],direct:['LAX','JFK','ORD'],hrs:{SFO:6.5,LAX:5,JFK:5.5,ORD:5}},
{id:'tofino',n:'Tofino',c:'Vancouver Island, Canada',e:'🌊',cost:2,tag:'Cold-water surf and old-growth rainforest',
 a:{beach:5,food:7,hotels:6,adventure:8,culture:3,night:2,quiet:9,nature:10},i:{surfing:9,hiking:8,wildlife:8,photo:9,fishing:8,spa:6,birding:7,diving:3,golf:2,wine:3},
 sub:{surfing:{beginner:8,advanced:7},fishing:{offshore:7,inshore:8,fly:4},diving:{reef:2,cave:0,big:3},golf:{resort:2,links:1}},
 m:[2.5,3,3.5,5,6.5,7.5,9,9,8,5.5,3,2.5],direct:[],hrs:{SFO:5,LAX:6,JFK:8,ORD:7.5}},
{id:'amalfi',n:'Amalfi Coast and Naples',c:'Italy',e:'🍋',cost:3,tag:'Cliffside hotels, pasta and ancient ruins',
 a:{beach:5,food:10,hotels:9,adventure:4,culture:9,night:5,quiet:4,nature:6},i:{wine:8,hiking:7,photo:9,spa:6,golf:2,fishing:3,diving:4,birding:3,wildlife:1,surfing:0},
 sub:{golf:{resort:2,links:0},diving:{reef:4,cave:2,big:1},fishing:{offshore:3,inshore:4,fly:2},surfing:{beginner:0,advanced:0}},
 m:[3,3.5,5,7,8.5,9,8.5,8.5,9,8,5,3.5],direct:['JFK'],hrs:{SFO:14,LAX:15,JFK:9,ORD:11}},
{id:'tokyo',n:'Tokyo and Kyoto',c:'Japan',e:'🍜',cost:3,tag:'The best meals of your life and quiet temples',
 a:{beach:1,food:10,hotels:8,adventure:4,culture:10,night:9,quiet:3,nature:4},i:{photo:9,wine:5,golf:6,hiking:6,spa:8,birding:5,wildlife:2,fishing:4,diving:2,surfing:1},
 sub:{golf:{resort:6,links:3},fishing:{offshore:3,inshore:4,fly:2},surfing:{beginner:1,advanced:1},diving:{reef:2,cave:0,big:1}},
 m:[5,5,7.5,9,8.5,6,5.5,5,6.5,9,9,6],direct:['SFO','LAX','JFK','ORD'],hrs:{SFO:11,LAX:11.5,JFK:14,ORD:13}},
{id:'cabo',n:'Los Cabos',c:'Baja, Mexico',e:'🐟',cost:3,tag:'Marlin charters, desert golf and big resorts',
 a:{beach:8,food:7,hotels:9,adventure:6,culture:3,night:8,quiet:4,nature:6},i:{fishing:10,golf:9,diving:6,wildlife:7,spa:8,surfing:5,photo:6,wine:4,hiking:3,birding:4},
 sub:{fishing:{offshore:10,inshore:6,fly:1},golf:{resort:10,links:3},diving:{reef:6,cave:1,big:7},surfing:{beginner:6,advanced:5}},
 m:[8,8.5,8.5,8.5,8.5,7.5,6.5,6,6,8,9,8.5],direct:['SFO','LAX','ORD'],hrs:{SFO:3,LAX:2.5,JFK:6,ORD:4.5}},
{id:'iceland',n:'Iceland',c:'North Atlantic',e:'🌋',cost:3,tag:'Waterfalls, glaciers and midnight sun',
 a:{beach:1,food:6,hotels:6,adventure:8,culture:5,night:4,quiet:8,nature:10},i:{photo:10,hiking:9,wildlife:6,spa:8,fishing:8,birding:7,golf:4,wine:1,diving:5,surfing:3},
 sub:{fishing:{offshore:3,inshore:4,fly:8},diving:{reef:1,cave:8,big:2},golf:{resort:3,links:4},surfing:{beginner:2,advanced:3}},
 m:[5,6.5,6.5,5.5,6.5,9,9.5,9,7,5,4,4],direct:['SFO','JFK','ORD'],hrs:{SFO:8,LAX:9,JFK:5.5,ORD:7.5}},
{id:'capetown',n:'Cape Town and Winelands',c:'South Africa',e:'🍷',cost:2,tag:'Mountain trails, penguins and long wine lunches',
 a:{beach:6,food:9,hotels:8,adventure:8,culture:7,night:7,quiet:5,nature:9},i:{wine:10,hiking:9,wildlife:8,photo:9,golf:7,surfing:6,diving:6,fishing:6,birding:8,spa:6},
 sub:{fishing:{offshore:7,inshore:6,fly:3},golf:{resort:7,links:6},surfing:{beginner:6,advanced:7},diving:{reef:5,cave:1,big:8}},
 m:[9,9,8.5,7.5,6,5,5,5.5,6.5,7.5,8.5,9],direct:[],hrs:{SFO:24,LAX:23,JFK:16,ORD:18}},
{id:'scotland',n:'Scottish Highlands and Skye',c:'Scotland',e:'🏰',cost:2,tag:'Big glens, salmon rivers and single-track roads',
 a:{beach:2,food:6,hotels:7,adventure:6,culture:8,night:5,quiet:8,nature:9},i:{golf:10,fishing:9,hiking:9,wine:6,photo:9,birding:8,wildlife:6,spa:5,surfing:3,diving:2},
 sub:{golf:{resort:5,links:10},fishing:{offshore:3,inshore:4,fly:10},surfing:{beginner:2,advanced:3},diving:{reef:1,cave:0,big:1}},
 m:[2.5,3,4,5.5,7.5,8.5,8.5,8.5,8,6,3.5,2.5],direct:['JFK','ORD'],hrs:{JFK:7,ORD:8,SFO:11,LAX:12}}
];
const DX={
 maui:{kids:9,acc:8,crowd:7,en:10,langs:[],diet:{veg:8,vegan:7,gf:8,halal:3,kosher:3},fmt:{road:7,tour:5,cruise:7,base:9},t:[80,80,81,82,84,85,86,87,87,86,83,81]},
 kona:{kids:7,acc:6,crowd:4,en:10,langs:[],diet:{veg:6,vegan:5,gf:6,halal:2,kosher:2},fmt:{road:7,tour:5,cruise:5,base:8},t:[82,82,83,84,85,86,87,88,88,87,85,83]},
 lisbon:{kids:8,acc:6,crowd:7,en:7,langs:['pt'],diet:{veg:7,vegan:6,gf:6,halal:6,kosher:4},fmt:{road:8,tour:7,cruise:6,base:7},t:[58,60,64,67,72,77,82,83,79,72,64,59]},
 rivieramaya:{kids:8,acc:7,crowd:7,en:7,langs:['es'],diet:{veg:6,vegan:5,gf:5,halal:3,kosher:3},fmt:{road:6,tour:7,cruise:6,base:10},t:[83,84,86,88,90,91,92,92,90,88,85,83]},
 bali:{kids:7,acc:4,crowd:6,en:6,langs:['id'],diet:{veg:9,vegan:9,gf:7,halal:7,kosher:2},fmt:{road:5,tour:8,cruise:4,base:9},t:[86,86,87,88,88,87,86,87,87,88,88,87]},
 maldives:{kids:7,acc:7,crowd:2,en:8,langs:[],diet:{veg:6,vegan:5,gf:6,halal:9,kosher:2},fmt:{road:0,tour:2,cruise:7,base:10},t:[87,88,89,90,89,88,88,88,88,88,88,87]},
 costarica:{kids:7,acc:4,crowd:4,en:5,langs:['es'],diet:{veg:7,vegan:6,gf:6,halal:2,kosher:2},fmt:{road:8,tour:8,cruise:3,base:6},t:[85,86,87,87,85,84,84,85,84,83,83,84]},
 tofino:{kids:7,acc:5,crowd:4,en:10,langs:[],diet:{veg:7,vegan:7,gf:7,halal:2,kosher:2},fmt:{road:8,tour:3,cruise:2,base:7},t:[47,48,50,54,59,63,67,68,65,57,50,47]},
 amalfi:{kids:6,acc:3,crowd:9,en:6,langs:['it'],diet:{veg:7,vegan:5,gf:7,halal:3,kosher:3},fmt:{road:5,tour:8,cruise:9,base:6},t:[55,56,60,66,73,80,85,85,79,71,62,57]},
 tokyo:{kids:8,acc:8,crowd:8,en:4,langs:['ja'],diet:{veg:5,vegan:4,gf:4,halal:4,kosher:3},fmt:{road:2,tour:9,cruise:4,base:7},t:[50,52,57,67,75,80,87,89,82,71,60,53]},
 cabo:{kids:7,acc:7,crowd:6,en:7,langs:['es'],diet:{veg:6,vegan:5,gf:5,halal:3,kosher:3},fmt:{road:6,tour:6,cruise:8,base:9},t:[77,78,80,83,85,88,91,92,91,89,84,79]},
 iceland:{kids:7,acc:5,crowd:6,en:9,langs:[],diet:{veg:6,vegan:6,gf:7,halal:3,kosher:2},fmt:{road:10,tour:8,cruise:4,base:5},t:[37,38,41,45,52,57,60,59,54,46,41,38]},
 capetown:{kids:8,acc:6,crowd:6,en:9,langs:[],diet:{veg:7,vegan:7,gf:7,halal:7,kosher:6},fmt:{road:9,tour:8,cruise:4,base:7},t:[78,79,76,72,68,65,64,65,67,71,74,77]},
 scotland:{kids:6,acc:4,crowd:4,en:10,langs:[],diet:{veg:7,vegan:7,gf:7,halal:4,kosher:3},fmt:{road:10,tour:8,cruise:5,base:5},t:[43,44,47,52,58,62,64,64,60,54,47,44]}
};
/* Specialist places: left out of every list unless one of the gate interests is Love or Top (weight 7 or more). Numbers are invented. */
const GATED=[
 {id:'standrews',n:'St Andrews and Fife',c:'Scotland',e:'⛳',cost:3,tag:'The home of golf, with a medieval town and links on the sea',gate:['golf'],
  a:{beach:3,food:6,hotels:6,adventure:3,culture:7,night:4,quiet:7,nature:6},i:{golf:10,hiking:5,wildlife:4,fishing:5,photo:6,birding:5,surfing:1,diving:0,wine:2,spa:3},sub:{golf:{resort:5,links:10}},
  m:[3.5,3.5,4,5.5,7,8.5,9,8.5,8,6,4,3.5],direct:['JFK'],hrs:{JFK:7,ORD:8.5,SFO:11,LAX:12},kids:5,acc:5,crowd:5,en:10,langs:[],diet:{veg:7,vegan:6,gf:7,halal:4,kosher:3},fmt:{road:9,tour:6,cruise:2,base:9},t:[43,44,47,52,58,62,64,64,60,54,47,44]},
 {id:'palau',n:'Palau',c:'Western Pacific',e:'🪼',cost:4,tag:'Walls of sharks, jellyfish lake and almost no one else',gate:['diving'],
  a:{beach:6,food:5,hotels:6,adventure:8,culture:3,night:2,quiet:9,nature:9},i:{diving:10,fishing:7,wildlife:8,photo:8,birding:5,hiking:3,surfing:3,golf:0,wine:0,spa:3},sub:{diving:{reef:9,cave:6,big:10},fishing:{offshore:7,inshore:7,fly:3}},
  m:[8.5,9,9,8.5,7,6,6,6,6.5,7.5,8,8.5],direct:[],hrs:{SFO:17,LAX:17,JFK:22,ORD:21},kids:5,acc:5,crowd:1,en:7,langs:[],diet:{veg:5,vegan:4,gf:5,halal:4,kosher:2},fmt:{road:1,tour:5,cruise:6,base:9},t:[87,87,88,89,89,89,88,88,88,88,88,87]},
 {id:'churchill',n:'Churchill',c:'Manitoba, Canada',e:'🐻‍❄️',cost:3,tag:'Polar bears in autumn, belugas in summer, aurora all winter',gate:['wildlife'],
  a:{beach:0,food:3,hotels:3,adventure:7,culture:2,night:1,quiet:9,nature:10},i:{wildlife:10,photo:9,birding:6,hiking:3,fishing:3,golf:0,surfing:0,diving:0,wine:0,spa:0},sub:{},
  m:[3,3,3.5,3.5,4.5,7,8,7,6,9.5,8.5,3.5],direct:[],hrs:{SFO:9,LAX:9,JFK:8,ORD:6},kids:4,acc:4,crowd:1,en:10,langs:[],diet:{veg:4,vegan:3,gf:4,halal:2,kosher:2},fmt:{road:2,tour:10,cruise:2,base:6},t:[-8,-3,12,28,42,58,68,65,52,37,17,-1]}
];
D.forEach(d=>Object.assign(d,DX[d.id]||{}));D.push(...GATED);
const REG={maui:'Hawaii',kona:'Hawaii',lisbon:'Portugal',rivieramaya:'Mexico',bali:'Southeast Asia',maldives:'South Asia',costarica:'Central America',tofino:'Canada',amalfi:'Italy',tokyo:'East Asia',cabo:'Mexico',iceland:'Northern Europe',capetown:'Southern Africa',scotland:'Scotland',standrews:'Scotland',palau:'Micronesia',churchill:'Canada'};D.forEach(d=>d.reg=REG[d.id]||d.c);

/* sharpen questions. a = shifts the profile, sub = picks a flavor of an interest, none = saved to your profile only */
const GQ=[
 {id:'pace',t:'How do you like your days?',o:[['Slow and lazy',{quiet:1.2,beach:.6}],['A bit of both',{}],['Packed from morning',{adventure:1,culture:.8}]]},
 {id:'spend',t:'Where should the money go?',o:[['The hotel',{hotels:1.4}],['The food',{food:1.4}],['Experiences',{adventure:1.2,culture:.6}]]},
 {id:'eve',t:'Evenings?',o:[['Early nights',{quiet:1,night:-.8}],['A cocktail or two',{night:.7}],['Out late',{night:1.6}]]},
 {id:'crowd',t:'Famous spots or hidden ones?',o:[['Famous is fine',{culture:.3,night:.3}],['Off the beaten track',{quiet:1.2,nature:.8}]]},
 {id:'cult',t:'Ruins and museums?',o:[['Love them',{culture:1.6}],['Some',{culture:.5}],['Skip them',{culture:-.8}]]},
 {id:'wild',t:'How wild do you like nature?',o:[['Remote and rugged',{nature:1.4,adventure:.6,quiet:.6}],['Pretty and easy',{nature:.5,hotels:.5}]]},
 {id:'eat',t:'Street food or white tablecloth?',o:[['Street food',{food:1.2,culture:.4}],['White tablecloth',{food:1,hotels:.6}]]}
];
const EQ=[
 {id:'f1',int:'fishing',first:1,t:'What kind of fishing?',o:[['Offshore big game',{},['fishing','offshore']],['Fly fishing',{},['fishing','fly']],['Inshore and flats',{},['fishing','inshore']]]},
 {id:'f2',int:'fishing',t:'How do you fish on holiday?',o:[['Guided charter',{},null,1],['On my own',{},null,1],['Both']]},
 {id:'g1',int:'golf',first:1,t:'Resort golf or links golf?',o:[['Resort courses',{},['golf','resort']],['Links and traditional',{},['golf','links']]]},
 {id:'g2',int:'golf',t:'Rounds on a trip?',o:[['One or two',{},null,1],['Three or four',{},null,1],['Every day',{},null,1]]},
 {id:'s1',int:'surfing',first:1,t:'What is your level?',o:[['Learning',{},['surfing','beginner']],['Comfortable',{},['surfing','mid']],['Advanced',{},['surfing','advanced']]]},
 {id:'s2',int:'surfing',t:'Do you travel with your board?',o:[['Yes',{},null,1],['I rent',{},null,1]]},
 {id:'d1',int:'diving',first:1,t:'Reef, caves or big animals?',o:[['Colorful reefs',{},['diving','reef']],['Caves and cenotes',{},['diving','cave']],['Big animals',{},['diving','big']]]},
 {id:'d2',int:'diving',t:'Are you certified?',o:[['Yes',{},null,1],['No, snorkeling',{},null,1]]},
 {id:'h1',int:'hiking',first:1,t:'Day hikes or multi-day treks?',o:[['Day hikes',{nature:.3}],['Multi-day',{adventure:.8,nature:.8}]]},
 {id:'b1',int:'birding',first:1,t:'Target species or just enjoy?',o:[['Target species',{nature:.6}],['Just enjoy',{nature:.2}]]},
 {id:'w1',int:'wine',first:1,t:'Tasting rooms or a stay among the vines?',o:[['Tasting rooms',{food:.4}],['Stay at a vineyard',{hotels:.6,quiet:.4}]]},
 {id:'p1',int:'photo',first:1,t:'Landscapes or streets?',o:[['Landscapes',{nature:1}],['Streets',{culture:1,night:.3}]]},
 {id:'wl1',int:'wildlife',first:1,t:'Big animals or small?',o:[['Big animals',{nature:.8,adventure:.3}],['Birds and small things',{nature:.5}]]},
 {id:'sp1',int:'spa',first:1,t:'Treatments or thermal waters?',o:[['Treatments',{hotels:.6}],['Thermal waters',{nature:.5,quiet:.4}]]}
];
const QMAP={};[...GQ,...EQ].forEach(q=>QMAP[q.id]=q);

/* For the prototype, interests beyond the original ten get an illustrative strength per destination, derived from its attributes. The real app has authored scores for all of them. */
const clamp=v=>Math.max(0,Math.min(10,v));
const DER={beachesSwimming:a=>a.beach,sunbathing:a=>a.beach*.9,luxuryHotels:a=>a.hotels,allInclusive:a=>Math.min(a.hotels,a.beach)*.9,hotSprings:a=>a.nature*.35+a.quiet*.3,yogaRetreats:(a,i)=>a.quiet*.6+(i.spa||0)*.4,themeParks:()=>2,nightlife:a=>a.night,shopping:a=>a.culture*.4+a.night*.3,safari:(a,i)=>(i.wildlife||0)*.7+(a.nature>9?1:0),whaleWatching:(a,i)=>(i.wildlife||0)*.5+a.beach*.1,scenicLandscapes:a=>a.nature*.9+a.adventure*.1,campingBackcountry:a=>a.adventure*.6+a.nature*.4,stargazing:a=>a.quiet*.5+a.nature*.4,auroraChasing:()=>0,geologyVolcanoes:a=>a.nature*.6,wildflowerBlooms:a=>a.nature*.5,mountaineering:(a,i)=>(i.hiking||0)*.6,cyclingRoad:a=>a.culture*.3+a.quiet*.3,mountainBiking:a=>a.adventure*.7,skiingSnowboarding:()=>1,windSports:(a,i)=>(i.surfing||0)*.6+a.beach*.3,sailing:a=>a.beach*.7,kayakingRafting:a=>a.adventure*.6+a.nature*.3,adventureSports:a=>a.adventure,horsebackRiding:a=>a.nature*.5,trailRunning:(a,i)=>(i.hiking||0)*.7,historyArchaeology:a=>a.culture*.9,museumsArt:a=>a.culture*.7,architecture:a=>a.culture*.8,cityExploration:a=>a.culture*.5+a.food*.3+a.night*.2,indigenousCultures:a=>a.culture*.4+a.nature*.3,religiousSites:a=>a.culture*.6,festivals:a=>a.night*.5+a.culture*.4,traditionalCrafts:a=>a.culture*.5,streetFood:a=>a.food*.95,fineDining:a=>a.food*.6+a.hotels*.4,coffeeTea:a=>a.food*.6,deals:(a,i,d)=>(4-d.cost)*2.5,crowds:a=>a.quiet,roadtrip:a=>a.adventure*.5+a.nature*.4};
function STR(d,id){if(d.i[id]!=null)return d.i[id];const k=NEWK[id]||id;const f=DER[k];return f?clamp(f(d.a,d.i,d)):2}

/* =================== Open to: the app's own four bands (BAND_DIMENSIONS). Everything selected = no preference. =================== */
const BANDS=[
 {k:'budget',n:'Budget & Comfort',e:'💳',b:[['basic','Basic / Budget'],['comfortable','Comfortable'],['highend','High-End'],['luxury','Luxury']]},
 {k:'weather',n:'Weather',e:'🌡️',hint:'Daily highs: Cold under 50°F · Cool 50 to 69 · Warm 70 to 84 · Hot 85 and up',b:[['cold','Cold'],['cool','Cool'],['warm','Warm'],['hot','Hot']]},
 {k:'vibe',n:'Social Vibe',e:'🎭',b:[['secluded','Secluded & Quiet'],['easygoing','Easygoing & Low-Key'],['lively','Lively & Social'],['highenergy','High-Energy & Nightlife']]},
 {k:'physical',n:'Physical Demand',e:'💪',b:[['easy','Easy for Anyone'],['moderate','Moderate'],['active','Active'],['challenging','Challenging']]}];
const BK=Object.fromEntries(BANDS.map(b=>[b.k,b.b.map(x=>x[0])]));
const fullBands=()=>Object.fromEntries(BANDS.map(b=>[b.k,[...BK[b.k]]]));
const narrowed=k=>st.bands[k].length<4;
function placeBand(d,k,m){
 if(k==='budget')return BK.budget[d.cost-1];
 if(k==='weather'){const t=d.t[m];return t<50?'cold':t<70?'cool':t<85?'warm':'hot'}
 if(k==='vibe'){const v=d.a.night*.55+(10-d.a.quiet)*.45;return v<3.5?'secluded':v<5.3?'easygoing':v<7?'lively':'highenergy'}
 const v=d.a.adventure;return v<4.5?'easy':v<6.8?'moderate':v<8.6?'active':'challenging'}
function bandMiss(d,s,k){const set=s.bands[k];if(set.length>=4)return 0;const arr=BK[k];
 const dist=band=>Math.min(...set.map(x=>Math.abs(arr.indexOf(x)-arr.indexOf(band))));
 if(k==='weather'&&s.month==null){const fit=d.t.filter((_,m)=>dist(placeBand(d,k,m))===0).length/12;return fit>=.34?0:1}
 return Math.min(2,dist(placeBand(d,k,s.month==null?0:s.month)))}
const MISSL={budget:'Outside your budget',weather:'Not the weather you chose',vibe:'Outside your social vibe',physical:'Outside your physical demand'};
function bandContribs(d,s){const out=[];BANDS.forEach(b=>{const m=bandMiss(d,s,b.k);if(m>0)out.push({l:MISSL[b.k],v:-1.25*m,band:b.k})});return out}
function bandSummary(){return BANDS.filter(b=>narrowed(b.k)).map(b=>b.n+': '+st.bands[b.k].map(x=>b.b.find(y=>y[0]===x)[1]).join(', '))}
function budgetLabel(){return narrowed('budget')?st.bands.budget.map(x=>BANDS[0].b.find(y=>y[0]===x)[1]).join(' / '):'Any budget'}
function weatherLabel(){return narrowed('weather')?st.bands.weather.map(x=>BANDS[1].b.find(y=>y[0]===x)[1]).join(' / '):'Any weather'}

/* =================== state =================== */
const fresh=()=>({seen:{},hq:'',dxo:{},dsc:{},dorder:null,dall:false,anchor:null,subs:{},removed:[],topMsg:false,editDna:false,dnaFrom:null,bands:fullBands(),saved:[],lens:null,lsearch:false,showSaved:false,pl:null,care:{},careOpen:false,careTiles:[],allTab:'rank',sort:'match',ps:'',mode:'trip',more:{},grp:'Nature & Wildlife',q:'',screen:'door',doors:{love:false,window:false,open:false,flex:false},who:[],month:null,flex:false,week:0,budget:null,vibes:[],interests:{},origin:'SFO',originSet:false,direct:false,maxH:0,ans:{},swipes:[],sharp:0,sheet:null,open:null,swipeI:0,keep:{},returning:false,showHid:false,name:null});
let st=fresh(),savedDNA=null,prevOrder=[],noteOverride=null;

/* =================== what matters when you choose =================== */
const CARE=[
 {k:'vibe',e:'🎭',n:'Social vibe',d:'Quiet to nightlife',band:true,trip:true},
 {k:'physical',e:'💪',n:'Physical demand',d:'Easy to challenging',band:true,trip:true},
 {k:'kids',e:'👶',n:'Kid-friendly',d:'Easy with children',q:'Ages',opts:[['u5','Under 5'],['k','5 to 12'],['t','Teens']],multi:true,firm:'Must be geared to families',trip:true},
 {k:'food',e:'🥗',n:'Food needs',d:'Vegetarian, halal, gluten-free',q:'Needs',opts:[['veg','Vegetarian'],['vegan','Vegan'],['gf','Gluten-free'],['halal','Halal'],['kosher','Kosher']],multi:true,firm:'Rule out places with few options',lasting:true},
 {k:'lang',e:'🗣️',n:'Language',d:'How easy it is to get by',q:'I need',opts:[['en','English to work'],['es','Spanish'],['pt','Portuguese'],['it','Italian'],['ja','Japanese']],multi:true,firm:'Rule out places where English is hard',lasting:true},
 {k:'how',e:'🧭',n:'How you travel',d:'Road trip, tour, cruise',q:'I like',opts:[['road','Road trip'],['tour','Guided tour'],['cruise','Cruise'],['base','One base, day trips']],multi:true,lasting:true},
 {k:'deals',e:'💸',n:'Deals',d:'Cheaper off-peak travel',q:'',opts:[['off','Show me the low-season value']],multi:false,trip:true},
 {k:'crowds',e:'🧘',n:'Avoiding crowds',d:'Quieter places and seasons',q:'',opts:[['quiet','Favor quieter places']],multi:false,trip:true},
 {k:'access',e:'♿',n:'Step-free access',d:'Little walking, no stairs',q:'',opts:[['easy','Step-free and little walking']],multi:false,firm:'Rule out places that are hard',lasting:true},
];
const HOWL={road:'Great for a road trip',tour:'Great for a guided tour',cruise:'Great for a cruise',base:'Great from one base'};
function careContribs(d,s){const cs=Object.fromEntries(Object.entries(s.care||{}).filter(([,v])=>v.o&&v.o.length)),out=[];const add=(l,v,k)=>out.push({l,v,care:k});
 if(cs.kids)add('Easy with kids',(d.kids-5)/5*(cs.kids.firm?2.4:1.6),'kids');
 if(cs.food)cs.food.o.forEach(o=>add(FOODL[o]+' options',(d.diet[o]-5)/5*(cs.food.firm?1.6:1.2),'food'));
 if(cs.lang)cs.lang.o.forEach(o=>{if(o==='en')add('English works',(d.en-6)/4*1.3,'lang');else if(d.langs.includes(o))add('You speak the language',1,'lang')});
 if(cs.how)cs.how.o.forEach(o=>add(HOWL[o],(d.fmt[o]-5)/5*1.5,'how'));
 if(cs.deals)add('Better value',s.month!=null?Math.max(0,6.8-d.m[s.month])*.45+(4-d.cost)*.35:(4-d.cost)*.5,'deals');
 if(cs.crowds)add('Quieter than most',(5-d.crowd)/5*1.6,'crowds');
 if(cs.access)add('Easy to get around',(d.acc-5)/5*(cs.access.firm?2.2:1.6),'access');
 return out}
function careFit(d,s){const cs=Object.fromEntries(Object.entries(s.care||{}).filter(([,v])=>v.o&&v.o.length));
 if(cs.kids&&cs.kids.firm&&d.kids<6)return 'Not geared to families with kids';
 if(cs.food&&cs.food.firm)for(const o of cs.food.o)if(d.diet[o]<5)return 'Few '+FOODL[o].toLowerCase()+' options';
 if(cs.lang&&cs.lang.firm&&cs.lang.o.includes('en')&&d.en<6)return 'English is not widely spoken';
 if(cs.access&&cs.access.firm&&d.acc<5)return 'Limited step-free access';return null}
function careCount(){return CARE.filter(c=>!c.sheet&&careHas(c)).length}
function careSummary(){const out=[];CARE.forEach(c=>{if(c.sheet)return;if(c.band){if(narrowed(c.k)){const b=BANDS.find(x=>x.k===c.k);out.push(c.n+': '+st.bands[c.k].map(o=>b.b.find(y=>y[0]===o)[1]).join(', '))}return}const v=st.care[c.k];if(!v||!v.o.length)return;out.push(c.n+': '+v.o.map(o=>(c.opts.find(x=>x[0]===o)||[0,o])[1]).join(', ')+(v.firm?' (must)':''))});return out}
/* =================== scoring =================== */
function attrW(s){const W={};const add=(o,m=1)=>{for(const k in o)W[k]=(W[k]||0)+o[k]*m};
 s.vibes.forEach(v=>add(VIBES[v].a));(s.who||[]).forEach(k=>add(WHO[k].a,1/Math.sqrt(s.who.length)));
 for(const q in s.ans){const o=QMAP[q]&&QMAP[q].o[s.ans[q]];if(o&&o[1])add(o[1])}
 s.swipes.forEach(x=>add(CARDS[x.i].a,x.r));return W}
function subsOf(s){const r={};for(const q in s.ans){const o=QMAP[q]&&QMAP[q].o[s.ans[q]];if(o&&o[2])r[o[2][0]]=o[2][1]}for(const k in (s.subs||{})){const m=CHIPSUB[k];if(m&&s.interests[k])for(const lab of s.subs[k])if(m[lab]){r[k]=m[lab];break}}return r}
function scoreOne(d,s,W,subs){let t=0;const c=[];const NF=1/Math.sqrt(Math.max(1,Object.keys(s.interests).length/3));careContribs(d,s).forEach(x=>{t+=x.v;c.push(x)});bandContribs(d,s).forEach(x=>{t+=x.v;c.push(x)});
 for(const k in W){const v=W[k]*d.a[k]/10*2.2;t+=v;c.push({l:ATTR[k],v,attr:k})}
 for(const i in s.interests){const w=s.interests[i];const v=w*STR(d,i)/10*3.2*NF;t+=v;c.push({l:INT[i][0],v,int:i});
  if(subs[i]){const ds=d.sub[i]||{};const sv=subs[i]==='mid'?((ds.beginner||0)+(ds.advanced||0))/2:(ds[subs[i]]||0);const v2=w*sv/10*2.4;t+=v2;c.push({l:INT[i][0]+': '+(SUBL[i][subs[i]]||''),v:v2,int:i,sub:1})}}
 if(s.month!=null){const v=(d.m[s.month]-6.5)*.55;t+=v;c.push({l:'Season in '+MON[s.month],v,month:1})}
 return {t,c}}
function fit(d,s){const cf=careFit(d,s);if(s.originSet&&s.direct&&APTM[s.origin]&&APTM[s.origin].proxy&&!nonstopOf(d,s))return 'No nonstop flight from '+s.origin;
 const h=s.originSet?hrsOf(d,s):null;if(s.maxH&&h!=null&&h>s.maxH)return 'About '+h+' hours from '+s.origin+', over your '+s.maxH+'-hour limit';return cf}
function gateOf(d,s){if(!d.gate)return null;const by=d.gate.find(g=>(s.interests[g]||0)>=2.5);return {open:!!by,by}}
function rank(s){const W=attrW(s),subs=subsOf(s);const ok=[],hid=[],locked=[];
 D.forEach(d=>{const g=gateOf(d,s);if(g&&!g.open){locked.push(d);return}const why=fit(d,s);if(why){hid.push({d,why});return}const r=scoreOne(d,s,W,subs);ok.push({d,t:r.t,c:r.c,by:g&&g.by})});
 ok.sort((a,b)=>b.t-a.t);const mn=Math.min(...ok.map(x=>x.t)),mx=Math.max(...ok.map(x=>x.t));
 ok.forEach(x=>{const nm=(x.t-mn)/((mx-mn)||1);x.pc=Math.round(54+42*nm);x.sc=(5.4+2.9*nm).toFixed(1)});return {ok,hid,locked}}
function teaserFor(s){const r=rank(s);const pickedNotStarred=r.locked.filter(d=>d.gate.some(g=>s.interests[g]!=null&&s.interests[g]<2.5));if(!pickedNotStarred.length)return null;const g=pickedNotStarred[0].gate.find(x=>s.interests[x]!=null&&s.interests[x]<2.5);const n=pickedNotStarred.filter(d=>d.gate.includes(g)).length;return {g,n,names:pickedNotStarred.filter(d=>d.gate.includes(g)).map(d=>d.n)}}
function top5(s){return rank(s).ok.slice(0,5).map(x=>x.d.id)}

/* =================== sharpen engine: ask what would change the list most =================== */
function candidates(s){const out=[];
 EQ.forEach(q=>{if(!s.interests[q.int]||s.ans[q.id]!=null)return;const chipAns=!!(CHIPSUB[q.int]&&(s.subs[q.int]||[]).some(l=>CHIPSUB[q.int][l]));if(q.first&&chipAns)return;
  if(!q.first&&!chipAns&&s.ans[EQ.find(x=>x.int===q.int&&x.first).id]==null)return;out.push(q)});
 GQ.forEach(q=>{if(s.ans[q.id]==null)out.push(q)});return out}
function impact(q,s){const base=top5(s);let tot=0;
 q.o.forEach((o,i)=>{const s2=Object.assign({},s,{ans:Object.assign({},s.ans,{[q.id]:i})});const n=top5(s2);tot+=n.filter((id,j)=>id!==base[j]).length});
 return tot/q.o.length}
function nextQ(s){const c=candidates(s);if(!c.length)return null;
 const scored=c.map(q=>{const im=impact(q,s);let sc;
  if(q.int){const w=s.interests[q.int];sc=(w>=3?60:40)+(q.first?5:0)}else sc=im*3;return {q,im,sc}});
 scored.sort((a,b)=>b.sc-a.sc);return scored[0]}

/* =================== helpers =================== */
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function path(){if(st.mode==='dna')return['love','rank','dnabasics','cards','dnasum'];const p=['door'];if(st.doors.window)p.push('when','logistics');else if(st.doors.flex)p.push('when');if(st.doors.love)p.push('love','rank');p.push('essentials');if(!st.doors.love)p.push('vibes');return p}
function modeBanner(){return st.mode==='dna'?'<div class="mb">Building your Travel DNA · no trip needed · about a minute</div>':''}
function whenLabel(){if(st.month==null)return 'Any month';return MON[st.month]+(st.week?' · week '+st.week:'')}
function budgetLabel(){return st.budget?BUDGETS[st.budget-1][1]:'Any budget'}
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;$('#phone').appendChild(t);setTimeout(()=>t.remove(),2500)}
function shutQ(){st.qopen=false;const w=$('#qwrap'),pf=$('.prof');if(w)w.classList.add('shut');if(pf){pf.classList.remove('open');pf.classList.add('closed');pf.setAttribute('aria-expanded','false')}}
function go(s){if(s==='results')st.qopen=true;if(s==='dnasum'&&st.screen!=='dnasum'){st.dorder=null;st.dall=false;st.dxo={}}st.screen=s;st.sheet=null;render();const sc=$('.scr');if(sc)sc.scrollTop=0}
function hasAnswers(){return Object.keys(st.ans).length>0||st.swipes.length>0}

/* =================== screens =================== */
function topbar(backTo,step,n){return `<div class="top">${backTo?`<button class="back" data-a="back" aria-label="Back">‹</button>`:''}<div class="prog"><i style="width:${Math.round(step/n*100)}%"></i></div></div>`}
function sDoor(){const d=st.doors;
 const Q=(h,opts)=>`<div class="qb"><h3>${h}</h3><div class="tiles">${opts.map(([k,e,a,b])=>`<button class="tile ${d[k]?'on':''}" data-a="door" data-k="${k}"><span class="ic">${e}</span><span><b>${a}</b><span>${b}</span></span><span class="chk">${d[k]?'✓':''}</span></button>`).join('')}</div></div>`;
 return topbar(false,1,4)+`<div class="scr"><div class="brand">Where To?</div><h2>Let us plan a trip</h2><p class="sub">Two quick choices. They only decide which questions come next.</p>
 ${Q('What should the trip be built around?',[['love','🎯','Something I love to do','Specific interests like hiking, diving, birding, golf…'],['open','✨','Just give me a great trip','Surprise me']])}
 ${Q('How fixed is your timing?',[['window','🗓️','A specific time window','Exact weeks, or flight logistics'],['flex','🌤️','My timing is flexible','Just pick a month']])}
 </div><div class="foot"><button class="btn" data-a="next" ${(d.love||d.open)&&(d.window||d.flex)?'':'disabled'}>Continue</button><button class="link dnal" data-a="dnafirst">Not planning a trip yet? Build my Travel DNA instead</button></div>`}
function chipHTML(s){return `<button class="ib ${st.interests[s.id]?'on':''}" data-a="int" data-k="${s.id}"><span class="ie">${s.emoji}</span><span class="lb">${esc(s.label)}</span></button>`}
function searchHits(){const q=st.q.trim().toLowerCase();if(q.length<2)return [];const seen={},out=[];
 SL.forEach(s=>{if(s.label.toLowerCase().split(/[^a-z]+/).some(w=>w.startsWith(q))||s.label.toLowerCase().includes(q)&&q.length>3){seen[s.id]=1;out.push(s)}});
 Object.entries(SYN).forEach(([w,id])=>{if(w.startsWith(q)||q.startsWith(w)){const s=SLM[OLD[id]||id]||SLM[id];if(s&&!seen[s.id]){seen[s.id]=1;out.push(s)}}});return out.slice(0,6)}
function searchRes(){const q=st.q.trim();if(q.length<2)return '';const h=searchHits();
 return h.length?`<div class="chips sres">${h.map(s=>`<button class="chip ${st.interests[s.id]?'on':''}" data-a="int" data-k="${s.id}">${s.emoji} ${esc(s.label)} <small>${esc(s.group)}</small></button>`).join('')}</div>`:`<div class="fine">Nothing matches “${esc(q)}”. Try a broader word.</div>`}
function relatedFor(){const sc={};Object.keys(st.interests).forEach(k=>(REL[k]||[]).forEach((o,ix)=>{if(!st.interests[o]&&SLM[o])sc[o]=(sc[o]||0)+(6-ix)}));
 return Object.entries(sc).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([o])=>SLM[o])}
function nextGrp(){const order=GROUPS.map(g=>g[0]),i=order.indexOf(st.grp);const g=[...order.slice(i+1),...order.slice(0,i)].find(x=>!st.seen[x]);if(!g)return '';const e=GROUPS.find(x=>x[0]===g)[1];return `<button class="btn ghost contg" data-a="contgrp" data-k="${esc(g)}"><span>${e} Continue to ${esc(g)}</span><i>›</i></button>`}
function sLove(){const p=path(),i=p.indexOf('love');const sel=Object.keys(st.interests),n=sel.length;st.seen[st.grp]=1;
 const cnt=g=>sel.filter(k=>SLM[k]&&SLM[k].group===g).length;
 const list=byGroup(st.grp),more=st.more[st.grp],shown=more?list:list.slice(0,8),rel=relatedFor();
 return topbar(true,i+1,p.length)+`<div class="scr">${modeBanner()}<h2>What do you love to do?</h2>
 <div class="lbl" style="margin:0 0 -4px">Browse interests in 4 categories</div><div class="gtabs" role="tablist">${GROUPS.map(([g,e])=>`<button class="gt ${g===st.grp?'on':''} ${cnt(g)&&g!==st.grp?'col':''}" role="tab" data-a="grp" data-k="${g}" data-fw="${esc(g)}" aria-label="${esc(g)}${cnt(g)?', '+cnt(g)+' picked':''}"><span class="gi">${e}</span>${cnt(g)&&g!==st.grp?'':`<span class="gl">${esc(g)}</span>`}${cnt(g)?`<i>${cnt(g)}</i>`:''}</button>`).join('')}</div>
 <div class="gname">${esc(st.grp)}</div>
 <div class="ig">${shown.map(chipHTML).join('')}</div>
 ${list.length>8?`<button class="link" data-a="more" data-k="${esc(st.grp)}">${more?'Show fewer':'Show '+(list.length-8)+' more'}</button>`:''}
 ${rel.length?`<div class="lbl">People who pick these often add</div><div class="chips">${rel.map(s=>`<button class="chip sug" data-a="int" data-k="${s.id}">+ ${s.emoji} ${esc(s.label)}</button>`).join('')}</div>`:''}
 ${nextGrp()}
 </div><div class="foot">${n?`<div class="tray"><b>${n} picked</b><span>${sel.slice(0,7).map(k=>INT[k][1]).join(' ')}${n>7?' +'+(n-7):''}</span></div>`:''}<button class="btn" data-a="next" ${n?'':'disabled'}>${n?'Continue':'Pick at least one'}</button>${st.mode==='dna'?'':`<button class="link" data-a="skipint">Skip, I have no favorites</button>`}</div>`}
function sRank(){const p=path(),i=p.indexOf('rank');const sel=Object.keys(st.interests).sort((a,b)=>st.interests[b]-st.interests[a]);
 const row=k=>{const on=st.interests[k]>=3,ch=SUBCH[k]||[],pick=st.subs[k]||[];
  return `<div class="rk2 ${on?'on top':''}" data-flip="${k}"><button class="rkh" data-a="star" data-k="${k}" aria-pressed="${on}"><span class="e">${INT[k][1]}</span><b>${esc(INT[k][0])}</b><span class="st">${on?'★ Top interest':'☆'}</span></button>${on&&ch.length?`<div class="rks"><div class="rkl">What kind?</div><div class="chips">${ch.map(l=>`<button class="chip sc ${pick.includes(l)?'on':''}" data-a="sub" data-k="${k}" data-o="${esc(l)}">${esc(l)}</button>`).join('')}</div></div>`:''}</div>`};
 return topbar(true,i+1,p.length)+`<div class="scr">${modeBanner()}<h2>Top interests</h2><p class="sub">Which are most important for picking where you go?</p>
 <div class="rows">${sel.map(row).join('')}</div>

 </div><div class="foot"><button class="btn" data-a="next">Continue</button><button class="link" data-a="back">Back to add more</button></div>`}
function sCards(){const p=path(),i=p.indexOf('cards');const done=st.swipeI>=CARDS.length;
 const body=done?`<div class="sw-card"><div class="em">✓</div><b>Taste captured</b></div>`:`<div class="sw-card"><div class="em">${CARDS[st.swipeI].e}</div><b>${CARDS[st.swipeI].t}</b></div><div class="sw-btns"><button data-a="csw" data-r="no">No</button><button data-a="csw" data-r="yes">Yes</button><button class="love" data-a="csw" data-r="love">Love ♥</button></div>`;
 return topbar(true,i+1,p.length)+`<div class="scr">${modeBanner()}<h2>${done?'Five cards in.':'Which sounds like your kind of day?'}</h2><p class="sub">${done?'That is enough for a first read.':'Card '+(st.swipeI+1)+' of '+CARDS.length+'. Go with your gut.'}</p>${body}</div><div class="foot"><button class="btn" data-a="next" ${done?'':'style="display:none"'}>Continue</button>${done?'':'<button class="link" data-a="next">Skip the cards</button>'}</div>`}
function sDnaBasics(){const p=path(),i=p.indexOf('dnabasics');
 return topbar(true,i+1,p.length)+`<div class="scr">${modeBanner()}${whoCard('Who do you usually travel with?','Select all that apply.')}
 ${openTo(['budget','weather','vibe','physical'])}
 <div class="card2"><h3>Home city or airport</h3><p class="sub">Optional. Type a city or airport code. Used to warn you about long flights and to show nonstop options.</p>${homePick()}</div>
 ${careAcc('dna')}
 </div><div class="foot"><button class="btn" data-a="next">Start swiping</button></div>`}
function keepOn(k,def){return st.keep[k]===undefined?def:st.keep[k]}
function dnaRows(){const R=[];const dna=st.mode==='dna';const lab=(b,set)=>set.map(x=>b.b.find(y=>y[0]===x)[1]).join(', ');
 BANDS.forEach(b=>R.push({sec:'open',k:'b_'+b.k,def:b.k==='weather'?dna:true,e:b.e,title:b.n,sum:narrowed(b.k)?lab(b,st.bands[b.k]):'No preference'}));
 CARE.filter(c=>!c.band&&!c.sheet).forEach(c=>{const v=st.care[c.k];if(v)R.push({sec:'care',k:'c_'+c.k,def:!!c.lasting,e:c.e,title:c.n,sum:v.o.length?v.o.map(o=>(c.opts.find(x=>x[0]===o)||[0,o])[1]).join(', ')+(v.firm?' · must':''):'Nothing picked yet'})});
 R.push({sec:'who',k:'who',def:dna,e:'👥',title:dna?'Who you usually travel with':'Who is going this time',sum:st.who.length?st.who.map(k=>WHO[k].n).join(', '):'Not set'});
 R.push({sec:'who',k:'origin',def:true,e:'🏠',title:'Home airport',sum:st.originSet?st.origin:'Not set'});
 if(st.vibes.length||st.dxo.vibes)R.push({sec:'taste',k:'vibes',def:true,e:'🖼️',title:'Photo picks',sum:st.vibes.length?st.vibes.map(v=>VIBES[v].n).join(', '):'Nothing picked yet'});
 const na=Object.keys(st.ans).length+st.swipes.length;if(na)R.push({sec:'taste',k:'ans',def:true,e:'🎚️',title:'Your answers and swipes',sum:na+' answers saved'});
 if(st.month!=null)R.push({sec:'trip',k:'when',def:false,e:'🗓️',title:'Dates',sum:whenLabel()});
 if(st.direct||st.maxH)R.push({sec:'trip',k:'limits',def:false,e:'✈️',title:'Flight limits',sum:'From '+st.origin+(st.direct?' · nonstop only':'')+(st.maxH?' · under '+st.maxH+'h':'')});
 return R}
function careOpts(c){const v=st.care[c.k]||{o:[],firm:false};return `<div class="chips">${c.opts.map(([o,l])=>`<button class="chip ${v.o.includes(o)?'on':''}" data-a="careopt" data-k="${c.k}" data-o="${o}">${l}</button>`).join('')}</div>${c.firm&&v.o.length?`<div class="seg2"><button class="${!v.firm?'on':''}" data-a="carefirm" data-k="${c.k}" data-f="0">Nice to have</button><button class="${v.firm?'on':''}" data-a="carefirm" data-k="${c.k}" data-f="1">${c.firm}</button></div>`:''}`}
function dedit(r){const k=r.k;
 if(k.startsWith('b_')){const b=BANDS.find(x=>x.k===k.slice(2));return `<div class="otp">${b.b.map(([o,l])=>`<button class="opill ${st.bands[b.k].includes(o)?'on':''}" data-a="band" data-k="${b.k}" data-o="${o}">${l}</button>`).join('')}</div><div class="fine" style="margin:0">Everything selected means no preference.</div>`}
 if(k.startsWith('c_'))return careOpts(CARE.find(x=>x.k===k.slice(2)));
 if(k==='who')return `<div class="otp">${Object.entries(WHO).map(([id,v])=>`<button class="opill ${st.who.includes(id)?'on':''}" data-a="who" data-k="${id}">${v.n}</button>`).join('')}</div>`;
 if(k==='origin')return homePick();
 if(k==='vibes')return `<div class="otp">${Object.entries(VIBES).map(([id,v])=>`<button class="opill ${st.vibes.includes(id)?'on':''}" data-a="vibe" data-k="${id}">${v.n}</button>`).join('')}</div>`;
 if(k==='when')return `<div class="otp">${MON.map((m,j)=>`<button class="opill ${st.month===j?'on':''}" data-a="month" data-k="${j}">${m}</button>`).join('')}</div>`;
 if(k==='limits')return `${homePick()}<div class="sw"><div><b>Nonstop flights only</b></div><button class="tg ${st.direct?'on':''}" data-a="direct" aria-label="Nonstop only"></button></div><div class="otp">${[[0,'No limit'],[4,'4 hours'],[8,'8 hours'],[12,'12 hours']].map(([h,l])=>`<button class="opill ${st.maxH===h?'on':''}" data-a="maxh" data-k="${h}">${l}</button>`).join('')}</div>`;
 return ''}
function dHas(k){if(k.startsWith('i:'))return (st.subs[k.slice(2)]||[]).length>0;if(k.startsWith('b_'))return narrowed(k.slice(2));if(k.startsWith('c_')){const v=st.care[k.slice(2)];return !!(v&&v.o.length)}
 if(k==='who')return st.who.length>0;if(k==='origin')return st.originSet;if(k==='vibes')return st.vibes.length>0;if(k==='when')return st.month!=null;if(k==='limits')return !!(st.direct||st.maxH);return false}
function dOpen(k){return st.dxo[k]!==undefined?st.dxo[k]:dHas(k)}
function dcard(r){const on=keepOn(r.k,r.def),ed=r.k!=='ans',open=ed&&dOpen(r.k);
 const head=ed?`<div class="dhd" role="button" tabindex="0" data-a="dx" data-k="${r.k}" aria-expanded="${open}"><div class="t"><b>${r.title}</b><small>${esc(r.sum)}</small></div><span class="xpi" aria-hidden="true">${open?'▴':'▾'}</span></div>`:`<div class="dhd"><div class="t"><b>${r.title}</b><small>${esc(r.sum)}</small></div></div>`;
 return `<div class="dc ${on?'':'off'}"><div class="dch"><span class="e">${r.e}</span>${head}<button class="tg ${on?'on':''}" data-a="keep" data-k="${r.k}" aria-label="${on?'Keep':'Do not keep'} ${esc(r.title)} in my Travel DNA" aria-pressed="${on}"></button></div>${open?`<div class="ded">${dedit(r)}</div>`:''}</div>`}
function icard(k){const w=st.interests[k]||0,lv=lvlOf(w),on=lv!=='off',ch=SUBCH[k]||[],pick=st.subs[k]||[],can=on&&ch.length>0,open=can&&dOpen('i:'+k);
 const head=can?`<div class="dhd" role="button" tabindex="0" data-a="dx" data-k="i:${k}" aria-expanded="${open}"><div class="t"><b>${esc(INT[k][0])}</b>${pick.length&&!open?`<small>${esc(pick.join(', '))}</small>`:''}</div><span class="xpi" aria-hidden="true">${open?'▴':'▾'}</span></div>`:`<div class="dhd"><div class="t"><b>${esc(INT[k][0])}</b></div></div>`;
 return `<div class="dc ic ${on?'':'off'}"><div class="dch"><span class="e">${INT[k][1]}</span>${head}</div><div class="lvl" role="group" aria-label="${esc(INT[k][0])} level">${LEVELS.map(([id,l])=>`<button class="${lv===id?'on':''}" data-a="lvl" data-k="${k}" data-l="${id}">${id==='top'?'★ ':''}${l}</button>`).join('')}</div>${open?`<div class="rks"><div class="rkl">What kind?</div><div class="chips">${ch.map(l=>`<button class="chip sc ${pick.includes(l)?'on':''}" data-a="sub" data-k="${k}" data-o="${esc(l)}">${esc(l)}</button>`).join('')}</div></div>`:''}</div>`}
function dnaSharpness(){return dnaPct()}
function sDnaSum(){const sh=dnaSharpness();st.sharp=sh;const dna=st.mode==='dna',R=dnaRows();
 if(!st.dorder)st.dorder=Object.keys(st.interests).sort((a,b)=>st.interests[b]-st.interests[a]);
 const ints=st.dorder,inSet=new Set(ints),offAll=SL.filter(s=>!inSet.has(s.id));
 const blk=(key,title,n,sub,body)=>`<div class="dsec"><button class="dsh" data-a="dsec" data-k="${key}" aria-expanded="${!st.dsc[key]}"><h3>${title}${n!=null?` <small>· ${n}</small>`:''}</h3><span class="xpi" aria-hidden="true">${st.dsc[key]?'▾':'▴'}</span></button>${st.dsc[key]?'':`${sub?`<p class="fine" style="margin:0">${sub}</p>`:''}${body}`}</div>`;
 const rowsBlk=(key,title,sub,rows)=>rows.length?blk(key,title,rows.length,sub,rows.join('')):'';
 const yes=sec=>R.filter(r=>r.sec===sec&&r.def);
 const tripOnly=R.filter(r=>!r.def);
 const nTop=Object.values(st.interests).filter(w=>w>=3).length;
 const rest=st.dall?GROUPS.map(([g,e])=>{const items=offAll.filter(s=>s.group===g);return items.length?`<div class="dgrp"><h4>${e} ${esc(g)}</h4>${items.map(s=>icard(s.id)).join('')}</div>`:''}).join(''):'';
 const intBody=`${ints.map(icard).join('')||'<div class="fine">No interests yet. Tap Show all to add some.</div>'}<div class="fine" style="margin:0">${nTop} of 5 top interests. The order updates the next time you open this page.</div>${rest}<button class="btn" data-a="dall" style="align-self:flex-start">${st.dall?'Hide the rest':`Show all ${offAll.length} more interests`}</button>`;
 return `<div class="top"><button class="back" data-a="back" aria-label="${dna?'Back':'Back to shortlist'}">‹</button><div class="prog"><i style="width:100%"></i></div></div><div class="scr">${modeBanner()}<h2>${dna?'Your Travel DNA, first sketch':'Your Travel DNA'}</h2>
 <div class="dna"><div class="sharp"><span>Calibration</span><div class="m"><i style="width:${sh}%"></i></div><b>${sh}%</b></div><div class="fine">${dna?'A sketch, not a verdict. Every trip you plan sharpens it.':'Changes apply to your list right away. Save to keep them as your defaults for the next trip. Switch off anything you do not want to carry over.'}</div></div>
 ${blk('ints','Interests',`${Object.keys(st.interests).length}/${SL.length} selected · ${Object.keys(st.interests).filter(k=>(st.subs[k]||[]).length).length}/${SL.length} fine-tuned`,'Each interest has a level, and up to five can be Top. Tap a card header for its specifics.',intBody)}
 ${rowsBlk('open','Open to','Your defaults. Tap a card header to edit it.',yes('open').map(dcard))}
 ${blk('care','What matters when you choose',yes('care').length,'Tap a card header to edit it. Add more below.',[...yes('care').map(dcard),`<div class="chips">${CARE.filter(c=>c.lasting&&!c.band&&!c.sheet&&!st.care[c.k]).map(c=>`<button class="chip" data-a="careadd2" data-k="${c.k}">+ ${c.n}</button>`).join('')}</div>`].join(''))}
 ${rowsBlk('who','Who and where from','',yes('who').map(dcard))}
 ${rowsBlk('taste','Tastes we learned','',yes('taste').map(dcard))}
 ${rowsBlk('trip','This trip only','Switch on to keep any of these in your Travel DNA.',tripOnly.map(dcard))}
 </div><div class="foot"><button class="btn" data-a="commit">${dna?'Save my Travel DNA':'Save and go back'}</button>${dna?'<button class="btn ghost" data-a="dnatry">See where it points</button>':'<button class="btn ghost" data-a="back">Back without saving</button>'}</div>`}
function openTo(dims,title){return `<div class="card2"><h3>${title||'Open to'}</h3><p class="sub">What you\'re willing to accept. Pick any combination. Everything selected means “no preference.”</p>${dims.map(k=>{const b=BANDS.find(x=>x.k===k);return `<div class="otg"><div class="otl"><span>${b.e}</span>${b.n}</div>${b.hint?`<div class="oth">${b.hint}</div>`:''}<div class="otp">${b.b.map(([o,l])=>`<button class="opill ${st.bands[k].includes(o)?'on':''}" data-a="band" data-k="${k}" data-o="${o}">${l}</button>`).join('')}</div></div>`}).join('')}</div>`}
function whoCard(title,sub){return `<div class="card2"><h3>${title}</h3><p class="sub">${sub}</p><div class="otp">${Object.entries(WHO).map(([k,v])=>`<button class="opill ${st.who.includes(k)?'on':''}" data-a="who" data-k="${k}">${v.n}</button>`).join('')}</div></div>`}
function careHas(c){if(c.band)return narrowed(c.k);const v=st.care[c.k];return !!(v&&v.o.length)}
function careTile(c){const on=careHas(c),open=st.careTiles.includes(c.k);
 return `<button class="ct ${on?'on':''} ${open?'sel':''}" data-a="caresel" data-k="${c.k}" aria-expanded="${open}"><span class="e">${c.e}</span><span class="t"><b>${c.n}</b><small>${c.d}</small></span>${on?'<i>✓</i>':open?'<i>▾</i>':''}</button>`}
function careEditor1(c){
 if(c.band){const set=narrowed(c.k)?st.bands[c.k]:[];const b=BANDS.find(x=>x.k===c.k);return `<div class="ced"><div class="row"><b>${c.e} ${c.n}</b>${narrowed(c.k)?`<button class="link" data-a="bandreset" data-k="${c.k}">Clear</button>`:''}</div><div class="fine" style="margin:0">Pick any that sound good. Pick none for no preference.</div><div class="chips">${b.b.map(([o,l])=>`<button class="chip ${set.includes(o)?'on':''}" data-a="cband" data-k="${c.k}" data-o="${o}">${l}</button>`).join('')}</div></div>`}
 const v=st.care[c.k];
 return `<div class="ced"><div class="row"><b>${c.e} ${c.n}</b>${v&&v.o.length?`<button class="link" data-a="careclear" data-k="${c.k}">Clear</button>`:''}</div><div class="fine" style="margin:0">Pick any that apply.</div><div class="chips">${c.opts.map(([o,l])=>`<button class="chip ${v&&v.o.includes(o)?'on':''}" data-a="careopt" data-k="${c.k}" data-o="${o}">${l}</button>`).join('')}</div>
 ${c.firm&&v&&v.o.length?`<div class="seg2"><button class="${!v.firm?'on':''}" data-a="carefirm" data-k="${c.k}" data-f="0">Nice to have</button><button class="${v.firm?'on':''}" data-a="carefirm" data-k="${c.k}" data-f="1">${c.firm}</button></div>`:''}</div>`}
function careEditors(scope){return CARE.filter(c=>!c.sheet&&st.careTiles.includes(c.k)&&(scope!=='dna'||c.lasting)).map(careEditor1).join('')}
function carePicks(scope){const out=[];CARE.forEach(c=>{if(scope==='dna'&&!c.lasting)return;
 if(c.band){if(narrowed(c.k)){const b=BANDS.find(x=>x.k===c.k);st.bands[c.k].forEach(o=>out.push([c,o,b.b.find(y=>y[0]===o)[1]]))}return}
 const v=st.care[c.k];if(v)v.o.forEach(o=>out.push([c,o,(c.opts.find(y=>y[0]===o)||[0,o])[1]]))});
 return out.length?`<div class="picks"><div class="lbl" style="margin:0">Your picks · ${out.length}</div><div class="chips">${out.map(([c,o,l])=>`<button class="chip on pk" data-a="pkrm" data-k="${c.k}" data-o="${o}" aria-label="Remove ${esc(l)}">${c.e} ${esc(l)} <i>✕</i></button>`).join('')}</div></div>`:''}
function careBody(scope){const list=CARE.filter(c=>scope==='dna'?c.lasting:true);
 return `<div class="cgrid">${list.map(careTile).join('')}</div>${careEditors(scope)}${carePicks(scope)}<div class="fine">Budget, dates and who is coming are asked separately. Only what you pick here is used.</div>`}
function careSuggest(){const out=[];
 if(st.who.includes('kids')&&!st.care.kids)out.push(['kids','Traveling with kids? Add ages and we will favor family-friendly places.','Add kid-friendly']);
 return out.map(([k,t,b])=>`<div class="sugg"><span>${t}</span><button class="link" data-a="careadd" data-k="${k}">${b}</button></div>`).join('')}
function careAcc(scope){const n=careCount();
 return `${careSuggest()}<div class="care"><button class="carehd" data-a="careopen" aria-expanded="${st.careOpen}"><span><b>What else matters when you choose?</b><small>${n?careSummary().join(' · '):'Optional: kids, food needs, language, travel modes and more.'}</small></span><i>${st.careOpen?'▾':'▸'}</i></button>${st.careOpen?careBody(scope):''}</div>`}
function whenCard(){return `<div class="card2"><h3>When?</h3><div class="otp">${MON.map((m,j)=>`<button class="opill ${st.month===j&&!st.flex?'on':''}" data-a="month" data-k="${j}">${m}</button>`).join('')}</div>${st.month!=null&&!st.flex&&st.doors.window?`<div class="otp" style="margin-top:8px">${['Any week','Week 1','Week 2','Week 3','Week 4'].map((w,j)=>`<button class="opill ${st.week===j?'on':''}" data-a="week" data-k="${j}">${w}</button>`).join('')}</div>`:''}</div>`}
function sWhen(){const p=path(),i=p.indexOf('when');
 return topbar(true,i+1,p.length)+`<div class="scr"><h2>When are you going?</h2><p class="sub">${st.doors.window?'Pick the month, and the week if you know it.':'Just pick a month.'}</p>${whenCard()}</div><div class="foot"><button class="btn" data-a="next" ${st.month!=null?'':'disabled'}>Continue</button></div>`}
function sEss(){const p=path(),i=p.indexOf('essentials');
 return topbar(true,i+1,p.length)+`<div class="scr"><h2>The basics</h2><p class="sub">A few taps. Your shortlist appears right after.</p>
 ${whoCard('Who is going?','Select all that apply.')}
 ${openTo(['budget','weather'])}
 ${careAcc('trip')}
 </div><div class="foot"><button class="btn" data-a="next">Continue</button><button class="link" data-a="next">Skip, I will decide later</button></div>`}
function sLog(){const p=path(),i=p.indexOf('logistics');
 return topbar(true,i+1,p.length)+`<div class="scr"><h2>Getting there</h2><p class="sub">Optional. If flights are not a limit, skip this. When you do set one, it is firm: places that do not fit are set aside, not just ranked lower.</p>
 <div class="card2"><h3>Flying from</h3>${homePick()}</div>
 <div class="sw"><div><b>Nonstop flights only</b><small>Hides anywhere you would have to change planes</small></div><button class="tg ${st.direct?'on':''}" data-a="direct" aria-label="Nonstop only"></button></div>
 <div class="card2"><h3>Longest flight I would take</h3><div class="otp">${[[0,'No limit'],[4,'4 hours'],[8,'8 hours'],[12,'12 hours']].map(([h,l])=>`<button class="opill ${st.maxH===h?'on':''}" data-a="maxh" data-k="${h}">${l}</button>`).join('')}</div></div>
 <div class="callout">Soft tastes (like “I prefer quiet beaches”) never hide a place. Only limits like these do, and you can always see what was set aside.</div>
 </div><div class="foot"><button class="btn" data-a="next">Continue</button><button class="link" data-a="next">Skip, flights are not a limit</button></div>`}
function sVibes(){const p=path(),i=p.indexOf('vibes');const lov=st.doors.love;
 return topbar(true,i+1,p.length)+`<div class="scr"><h2>Which of these feels like you?</h2><p class="sub">Pick any. These are the photos you would normally see.</p><div class="grid2">${Object.entries(VIBES).map(([k,v])=>`<button class="vt ${st.vibes.includes(k)?'on':''}" style="background:${v.g}" data-a="vibe" data-k="${k}"><span class="tick">✓</span><span class="big">${v.e}</span><b>${v.n}</b></button>`).join('')}</div></div>
 <div class="foot"><button class="btn" data-a="results">Show my shortlist</button><button class="link" data-a="results">Skip, surprise me</button></div>`}
function sWelcome(){return topbar(false,1,2)+`<div class="scr"><div class="brand">Where To?</div><h2>Welcome back, ${esc(st.name||'Priya')}. Planning something?</h2>
 <div class="dna"><div class="lbl" style="margin:0">Starting from your Travel DNA</div><div class="why">${dnaTags().map(t=>`<span class="b">${esc(t)}</span>`).join('')}</div><div class="fine">No need to answer all that again. Two questions, then your shortlist.</div></div>
 <div class="card2"><h3>When?</h3><div class="otp">${MON.map((m,j)=>`<button class="opill ${st.month===j&&!st.flex?'on':''}" data-a="month" data-k="${j}">${m}</button>`).join('')}</div></div>
 ${whoCard('Who is going this time?','Select all that apply.')}
 </div><div class="foot"><button class="btn" data-a="results">Show my shortlist</button></div>`}
function dnaTags(){const t=[];BANDS.filter(b=>narrowed(b.k)).forEach(b=>t.push(b.e+' '+st.bands[b.k].map(x=>b.b.find(y=>y[0]===x)[1]).join(' / ')));st.vibes.slice(0,3).forEach(v=>t.push(VIBES[v].n));
 const es=Object.entries(st.interests).sort((a,b)=>b[1]-a[1]);es.slice(0,7).forEach(([k,w])=>{const sb=subsOf(st)[k];t.push(INT[k][1]+' '+INT[k][0]+(sb&&SUBL[k]&&SUBL[k][sb]?' · '+SUBL[k][sb]:'')+(w>=3?' · top interest':''))});
 if(es.length>7)t.push('+'+(es.length-7)+' more interests');
 CARE.filter(c=>c.lasting&&st.care[c.k]).forEach(c=>{const v=st.care[c.k];t.push(c.e+' '+c.n+(v.o&&v.o.length?': '+v.o.map(o=>(c.opts.find(x=>x[0]===o)||[0,o])[1]).join(', '):'')+(v.firm?' · must':''))});return t.length?t:['Open to anything so far']}
function chipsBar(){const c=[];
  c.push(`<button class="chip" data-a="sheet" data-k="when">${whenLabel()}</button>`);
 c.push(`<button class="chip" data-a="sheet" data-k="who">${st.who.length?st.who.map(k=>WHO[k].n).join(' + '):'Who?'}</button>`);
 c.push(`<button class="chip" data-a="sheet" data-k="bands">${budgetLabel()}</button>`);
 c.push(`<button class="chip" data-a="sheet" data-k="bands">${weatherLabel()}</button>`);
 if(st.originSet||st.direct||st.maxH)c.push(`<button class="chip firm" data-a="sheet" data-k="limits">From ${st.origin}${st.direct?' · nonstop only':''}${st.maxH?' · under '+st.maxH+'h':''}</button>`);
 else c.push(`<button class="chip" data-a="sheet" data-k="limits">+ Flying from…</button>`);
 c.push(`<button class="chip" data-a="sheet" data-k="care">${careCount()?'What matters · '+careCount():'+ What matters'}</button>`);
 return `<div class="bar">${c.join('')}</div>`}
function whyChips(x){const d=x.d,out=[];const sc=x.c;
 if(x.by)out.push(['g','Specialist place · unlocked by '+INT[x.by][0]]);
 if(st.originSet&&hrsOf(d,st)!=null){out.push(nonstopOf(d,st)?['g',`Nonstop from ${st.origin} · ${hrsOf(d,st)}h`]:['',`About ${hrsOf(d,st)}h from ${st.origin}`])}
 const ints=sc.filter(z=>z.int&&!z.sub).sort((a,b)=>b.v-a.v)[0];const sub=sc.filter(z=>z.sub).sort((a,b)=>b.v-a.v)[0];
 if(sub&&sub.v>1.2)out.push(['b',sub.l]);else if(ints&&ints.v>2)out.push(['b','Strong for '+INT[ints.int][0].toLowerCase()]);
 if(st.month!=null){const m=d.m[st.month];if(m>=8)out.push(['g','Great in '+MON[st.month]]);else if(m<=5.2)out.push(['w','Weak in '+MON[st.month]+' (off-season)'])}
 const bm=sc.filter(z=>z.band).sort((a,b)=>a.v-b.v)[0];if(bm)out.push(['w',bm.l]);
 const cr=sc.filter(z=>z.care&&z.v>.45).sort((a,b)=>b.v-a.v)[0];if(cr&&out.length<3)out.push(['b',cr.l]);
 const at=sc.filter(z=>z.attr&&z.v>0).sort((a,b)=>b.v-a.v)[0];if(at&&out.length<3)out.push(['',at.l]);
 return out.slice(0,4).map(([k,t])=>`<span class="${k}">${esc(t)}</span>`).join('')}

function ansCount(){return Object.values(st.ans).filter(v=>v>=0).length}
const UNLOCK=10;
/* The Travel DNA percent: each answered question adds 2, each taste swipe adds 1. A returning traveler starts well along. */
function dnaPct(){return st.returning?Math.max(40,ansCount()*2+st.swipes.length):Math.min(96,ansCount()*2+st.swipes.length)}
function locked(){return !st.returning&&dnaPct()<UNLOCK&&!!nextQ(st)}
function sResults(){const r=rank(st);const q=nextQ(st);const lk=locked(),pct=dnaPct();const open=st.qopen!==false;
 const cards0=r.ok.slice(0,5).map((x,i)=>lcard(x,i+1)).join('');
 const cards=`<div class="tz">${cards0}</div>`;
 const meter=lk?`<div class="qmeter"><span>Travel DNA <b>${pct}%</b></span><div class="m"><i style="width:${Math.max(3,pct/UNLOCK*100)}%"></i></div><em>${UNLOCK}% unlocks your full list</em></div>`
   :`<div class="qmeter"><span>Travel DNA <b>${pct}%</b></span><div class="m"><i style="width:${Math.max(3,pct)}%"></i></div><em>Full list unlocked. Keep going to sharpen it.</em></div>`;
 const sq=q?`<div class="sq2"><div class="row"><span class="tag">${q.q.int?INT[q.q.int][1]+' '+INT[q.q.int][0]+' · expert lane':'Quick one'}</span><button class="link" data-a="skipq" data-k="${q.q.id}">Skip</button></div><h3>${esc(q.q.t)}</h3><div class="opts">${q.q.o.map((o,i)=>`<button data-a="ans" data-q="${q.q.id}" data-k="${i}">${esc(o[0])}</button>`).join('')}</div><div class="hint">${q.im>=.5?`Your answer would reshuffle about ${Math.max(1,Math.round(q.im))} of your top 5.`:q.q.int?'Goes into your Travel DNA. Sharpens future trips.':'Small effect on this list, saved for later.'}</div></div>`:`<div class="sq2"><span class="tag">You are well calibrated</span><h3>That is as sharp as it gets for now.</h3><div class="hint">Teach us your taste with a few swipes, or save this to your Travel DNA.</div></div>`;
 const quiz=`<div class="qwrap ${open?'':'shut'}" id="qwrap"><div class="qin"><div class="qwin">${meter}${sq}<button class="qdna" data-a="dna"><span>Open my full Travel DNA</span><i>›</i></button></div></div></div>`;
 const hid=r.hid.length?`<div class="hid"><button class="link" style="padding:0;text-decoration:none;color:var(--fg)" data-a="hid">${st.showHid?'▾':'▸'} ${r.hid.length} place${r.hid.length>1?'s':''} set aside by your limits</button>${st.showHid?`<ul>${r.hid.map(h=>`<li><b>${esc(h.d.n)}</b>: ${esc(h.why)}</li>`).join('')}</ul>`:''}</div>`:'';
 const seeall=lk?`<button class="seeall off" disabled><span class="tx"><b>🔒 See all ${r.ok.length} places</b><span>Build your Travel DNA up to ${UNLOCK}% to unlock the full list. You are at ${pct}%.</span></span></button>`:`<button class="seeall" data-a="all"><span class="tx"><b>See all ${r.ok.length} places that fit your criteria</b><span>${r.hid.length?r.hid.length+' set aside by your limits · ':''}the full results page</span></span><i>›</i></button>`;
 return `<div class="top"><div class="brand">Your top 5</div><button class="prof ${open?'open':'closed'} ${q?'ask':''}" data-a="qtoggle" aria-label="${open?'Collapse':'Expand'} your Travel DNA questions" aria-expanded="${open}"><span>🧬</span><small>${pct}%</small></button></div><div class="scr" id="rscr">${quiz}${chipsBar()}${cards}${seeall}${hid}</div>
 <div class="foot"><button class="btn ghost" data-a="swipe">Teach us your taste (5 swipes)</button><button class="btn" data-a="save">Save to my Travel DNA</button></div>`}

function sortRows(rows){const s=st.sort;const o=[...rows];
 if(s==='month'&&st.month!=null)o.sort((a,b)=>b.d.m[st.month]-a.d.m[st.month]);
 else if(s==='cost')o.sort((a,b)=>a.d.cost-b.d.cost||b.t-a.t);
 else if(s==='flight')o.sort((a,b)=>(hrsOf(a.d,st)||99)-(hrsOf(b.d,st)||99));return o}
function arow(x,i){const d=x.d,open=st.open===d.id;
 return `<button class="ar" data-a="open" data-k="${d.id}"><span class="rk">${i}</span><span class="em">${d.e}</span><span class="nm"><b>${esc(d.n)}</b><span>${esc(d.c)}${x.by?' · specialist':''}</span></span><span class="pc">${x.pc}%</span></button>${open?`<div class="arx"><div class="why">${whyChips(x)}</div><div class="ms">${d.m.map((v,j)=>`<i class="${j===st.month?'cur':''}" style="height:${Math.max(10,v*10)}%"></i>`).join('')}</div><div class="ml">${MON.map(m=>`<span>${m[0]}</span>`).join('')}</div></div>`:''}`}
function bmSvg(on){return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 4h10v16l-5-3.5L7 20z" fill="${on?'currentColor':'none'}" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`}
function lcard(x,i,lens){const d=x.d,sv=st.saved.includes(d.id);const sc=lens?STR(d,lens).toFixed(1):x.sc;
 return `<div class="lc" data-flip="${d.id}" role="button" tabindex="0" data-a="open2" data-k="${d.id}"><div class="l1"><span class="lrk">#${i}</span><b>${esc(d.n)}</b><span class="lsc">${sc}</span></div><div class="l2"><span class="lic">${d.e}</span><span class="lpill">📍 ${esc(d.reg)}</span><button class="lbm ${sv?'on':''}" data-a="bm" data-k="${d.id}" aria-label="${sv?'Remove from saved':'Save'} ${esc(d.n)}">${bmSvg(sv)}</button></div></div>`}
function sAll(){const r=rank(st);const q=st.ps.trim().toLowerCase();let rows=r.ok.slice();
 if(st.lens)rows.sort((a,b)=>STR(b.d,st.lens)-STR(a.d,st.lens));
 if(st.showSaved)rows=rows.filter(x=>st.saved.includes(x.d.id));
 if(q)rows=rows.filter(x=>(x.d.n+' '+x.d.c+' '+x.d.reg).toLowerCase().includes(q));
 const lock=q.length>=2?r.locked.filter(d=>(d.n+' '+d.c).toLowerCase().includes(q)):[];
 const ms=st.month!=null?MONF[st.month]:'any month';
 const lens=Object.entries(st.interests).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k])=>k)
 return `<div class="top"><button class="back" data-a="results" aria-label="Back to shortlist">‹</button><div class="brand" style="font-size:12px;color:var(--faint)">Live results page</div></div><div class="scr lr">
 <div class="lh"><span class="lt">Top places for you for</span><button class="mchip" data-a="sheet" data-k="when">${ms} ▾</button><button class="sb" data-a="lsearch" aria-label="Search">🔍</button><button class="prof" data-a="dna" aria-label="Your Travel DNA"><span>🧬</span></button></div>
 <div class="lsub">Ranked by your current sliders — showing ${rows.length} of 200 destinations</div>
 ${st.lsearch?`<div class="srch"><input id="ps" type="search" placeholder="Search destinations" value="${esc(st.ps)}" autocomplete="off" aria-label="Search destinations"></div>`:''}
 <div class="lchips"><button class="mi ${st.lens?'':'on'}" data-a="lens" data-k="${st.lens||''}"><span>🧬</span>My Interests</button>${lens.map(k=>`<button class="rci ${st.lens===k?'on':''}" data-a="lens" data-k="${k}" aria-label="${esc(INT[k][0])}" title="${esc(INT[k][0])}">${INT[k][1]}</button>`).join('')}</div>
 <div class="lvis"><span class="stamp">0</span><span>places visited ›</span><button data-a="hv">Hide visited</button><button data-a="ss" class="${st.showSaved?'on':''}">Show saved ${bmSvg(st.showSaved)}</button></div>
 ${r.hid.length?`<button class="link asl" data-a="sheet" data-k="aside">${r.hid.length} place${r.hid.length>1?'s':''} set aside by your limits · see why</button>`:''}
 <hr class="lhr">
 ${rows.map((x,i)=>lcard(x,i+1,st.lens)).join('')}
 ${lock.map(d=>`<div class="lockrow"><span class="em">🔒</span><span><b>${esc(d.n)}</b><small>Specialist place. It ranks once ${esc(INT[d.gate[0]][0].toLowerCase())} is a Love or Top interest.</small></span><button class="chip" data-a="unlock" data-k="${d.gate[0]}">Make it a top interest</button></div>`).join('')}
 ${!rows.length&&!lock.length?'<div class="fine">Nothing to show.</div>':''}
 </div>`}
function sSaved(){const tags=dnaTags();
 return topbar(false,1,1)+`<div class="scr"><h2>Saved. Next trip starts here.</h2><div class="dna"><h3>Your Travel DNA, first sketch</h3><div class="why">${tags.map(t=>`<span class="b">${esc(t)}</span>`).join('')}</div><div class="sharp"><span>Calibration</span><div class="m"><i style="width:${Math.min(96,Math.max(st.sharp,25))}%"></i></div><b>${Math.min(96,Math.max(st.sharp,25))}%</b></div><div class="fine">A sketch, not a verdict. Every trip you plan sharpens it.</div></div>
  <div class="callout"><b>Kept just for this trip:</b> ${dnaRows().filter(r=>!keepOn(r.k,r.def)).map(r=>r.title.toLowerCase()).join(', ')||'nothing'}.<br><b>Next time we only ask:</b> when, and who is coming.</div></div>
 <div class="foot"><button class="btn" data-a="asreturn">See it as a returning traveler</button><button class="btn ghost" data-a="results">Back to my shortlist</button></div>`}

/* =================== sheets =================== */
function topModal(){if(!st.topMsg)return '';return `<div class="mbg" data-a="closemsg"><div class="modal" role="alertdialog" aria-labelledby="mt"><div class="mi2">★</div><h3 id="mt">You already have 5 top interests</h3><p>Deselect an interest above to add a new top interest.</p><button class="btn" data-a="closemsg">Got it</button></div></div>`}
function sheetHTML(){const s=st.sheet;if(!s)return '';let body='';
 if(s==='who')body=`<h3>Who is going?</h3><div class="otp">${Object.entries(WHO).map(([k,v])=>`<button class="opill ${st.who.includes(k)?'on':''}" data-a="who" data-k="${k}">${v.n}</button>`).join('')}</div>`;
 if(s==='when')body=`<h3>When?</h3><div class="chips">${MON.map((m,j)=>`<button class="chip ${st.month===j&&!st.flex?'on':''}" data-a="month" data-k="${j}">${m}</button>`).join('')}</div>${st.month!=null&&!st.flex?`<div class="chips">${['Any week','Week 1','Week 2','Week 3','Week 4'].map((w,j)=>`<button class="chip ${st.week===j?'on':''}" data-a="week" data-k="${j}">${w}</button>`).join('')}</div>`:''}`;
 if(s==='care')body=`<h3>What matters when you choose?</h3>${careBody('trip')}`;
 if(s==='bands')body=openTo(['budget','weather','vibe','physical']);
 if(s==='place'){const x=rank(st).ok.find(z=>z.d.id===st.pl);if(x){const d=x.d;body=`<h3>${d.e} ${esc(d.n)}</h3><div class="fine">${esc(d.reg)} · score ${x.sc}</div><p class="sub">${esc(d.tag)}</p><div class="why">${whyChips(x)}</div><div class="ms">${d.m.map((v,j)=>`<i class="${j===st.month?'cur':''}" style="height:${Math.max(10,v*10)}%"></i>`).join('')}</div><div class="ml">${MON.map(m=>`<span>${m[0]}</span>`).join('')}</div><div class="fine">The real app opens its full place page here.</div>`}}
 if(s==='aside'){const r=rank(st);body=`<h3>Set aside by your limits</h3>${r.hid.map(h=>`<div class="aside"><span class="em">${h.d.e}</span><span><b>${esc(h.d.n)}</b><small>${esc(h.why)}</small></span></div>`).join('')}<div class="fine">Change a limit and these come back.</div>`}
 if(s==='limits')body=`<h3>Your limits</h3><div class="lbl">Flying from</div>${homePick()}<div class="sw"><div><b>Nonstop flights only</b><small>Firm limit</small></div><button class="tg ${st.direct?'on':''}" data-a="direct" aria-label="Nonstop only"></button></div><div class="lbl">Longest flight</div><div class="chips">${[[0,'No limit'],[4,'4 hours'],[8,'8 hours'],[12,'12 hours']].map(([h,l])=>`<button class="chip ${st.maxH===h?'on':''}" data-a="maxh" data-k="${h}">${l}</button>`).join('')}</div>`;
 if(s==='save'){const rows=[
  ['when','Dates',whenLabel(),'t'],['who','Who is going',st.who.length?st.who.map(k=>WHO[k].n).join(', '):'Not set','t'],['origin','Flying from',st.originSet?st.origin:'Not set','t'],['direct','Nonstop only',st.direct?'On':'Off','t'],['limit','Flight cap',st.maxH?st.maxH+' hours':'None','t'],
  ['budget','Open to (budget, weather, vibe, physical demand)',bandSummary().map(x=>x.split(':')[0]).join(', ')||'No preference','u'],['vibes','Vibe picks',st.vibes.length?st.vibes.map(v=>VIBES[v].n).join(', '):'None','u'],['ints','Interests and top interests',Object.keys(st.interests).length?Object.entries(st.interests).map(([k,w])=>INT[k][0]+(w>=3?' (top interest)':'')).join(', '):'None','u'],['ans','Your answers to the follow-ups',Object.keys(st.ans).length+' answered','u'],['carel','Food needs, language, getting around, how you travel',CARE.filter(c=>c.lasting&&st.care[c.k]).map(c=>c.n).join(', ')||'None set','u'],['caret','Kids, weather, crowds, deals',CARE.filter(c=>c.trip&&st.care[c.k]).map(c=>c.n).join(', ')||'None set','t']];
  const on=k=>st.keep[k]===undefined?(['budget','vibes','ints','ans','carel'].includes(k)):st.keep[k];
  body=`<h3>Keep any of this?</h3><p class="sub">Tastes are saved to your Travel DNA by default. Trip details stay with this trip unless you say otherwise.</p>`+rows.map(([k,a,b,t])=>`<div class="sr"><div class="t"><b>${a}</b><span>${esc(b)}</span></div><span class="pill ${on(k)?'u':'t'}">${on(k)?'Your DNA':'This trip'}</span><button class="tg ${on(k)?'on':''}" data-a="keep" data-k="${k}" aria-label="Keep ${a} in Travel DNA"></button></div>`).join('')+`<button class="btn" data-a="commit">Save my Travel DNA</button>`}
 if(s==='swipe'){if(st.swipeI>=CARDS.length){st.sheet=null;return ''}const c=CARDS[st.swipeI];body=`<div class="sg">Card ${st.swipeI+1} of ${CARDS.length}</div><div class="sw-card"><div class="em">${c.e}</div><b>${c.t}</b></div><div class="sw-btns"><button data-a="sw" data-r="no">No</button><button data-a="sw" data-r="yes">Yes</button><button class="love" data-a="sw" data-r="love">Love ♥</button></div><button class="link" data-a="closesheet">Stop here</button>`}
 return `<div class="sbg" data-a="bg"><div class="sheet">${body}${['save','swipe'].includes(s)?'':'<button class="btn" data-a="closesheet">Done</button>'}</div></div>`}

/* =================== notes rail =================== */
const NOTES={
 door:['Anchor','Two A or B choices decide the path','Built around something you love, or just a great trip. A specific time window, or flexible timing (flexible people just pick a month). Each pair is mutually exclusive, so nothing is a multi-select and nobody picks a persona. Interests give the interest flow, a time window gives the When and Getting there screens, and the other choices skip them. The small link under the button starts a Travel DNA with no trip attached.'],
 love:['Anchor','All 48 interests, never 48 at once','The picker uses the app\'s own groups (Nature & Wildlife, Sports & Recreation, Culture & Discovery, Relaxation & Leisure). The app\'s three Value items (low-season deals, avoiding crowds, road-tripping) are not interests, so they moved to “What else matters” on the next screens. Each group shows its most popular interests first and expands for the rest, ordered by the audience tier the app already stores. There is no search box: the four category tabs are the whole picker. A person who reaches the bottom of one tab without having opened another sees a button to continue to the next tab they have not visited, which is the same as tapping that tab at the top; once a tab has been opened the button stops appearing for it. Once you pick something, “people who pick these often add” suggests neighbors, using the similarity of the app\'s own Travel DNA attribute weights. Nobody has to open a group they do not care about.'],
 rank:['Anchor','Top interests, with specifics','Browsing and ranking are separate steps. Only the interests you picked appear. Tap one to make it a top interest (up to five): its card doubles in height and shows a row of specifics, the most important columns of that interest, for example Day hikes, Multi-day treks and Easy walks for hiking, or Downhill, Cross-country and Off-piste for skiing. All start unselected. A sixth tap opens a popup asking you to deselect one first.'],
 care:['Essentials','The “what else” list stays closed','Budget, who and when are asked of everyone. Everything else people weigh (kids, weather, food needs, language, how you travel, crowds, deals, getting around, flights) sits behind one collapsed line that says it is optional. Open it and each tile asks one small question, with Nice to have or Must have where a firm rule makes sense. Picking Family with kids or Several generations surfaces the matching tile as a suggestion. The same list is one tap away from the shortlist (“+ What matters”), so it never needs asking up front.'],
 all:['Full list','The live results page','“See all” opens a copy of the live results page: month chip, search, My Interests plus a round chip per top interest, visited and saved row, and the same tight cards. Tapping a round chip re-ranks by that one interest, as in the app. The only addition is one line when your limits set places aside. The shortlist before it uses the same tight cards. The real app lists 200 places; this mockup has 14 plus 3 specialist places.'],
 gate:['Specialist places','Earned, not announced','Nothing in onboarding mentions them. A place like St Andrews (golf) or Palau (diving) stays out of every list unless that interest is set to Love or Top (a weight of 7 or more). When it appears it carries a “Specialist place · unlocked by Golf” chip. Search always finds them. This matches the rule already built (a weight of 7 or higher on the 1 to 10 slider, which a star stands for). The badge is not built yet.'],
 cards:['Taste','Five quick scenarios','Used only in the Travel DNA path, where there is no trip to show results for. Each swipe nudges the same attributes that the photos do. Skippable.'],
 dnabasics:['Basics','This is the app\'s existing Basics screen','Who you usually travel with and all four “Open to” bands, exactly as the live Travel DNA flow asks them, with “Start swiping” as the button. A home city or airport (type a city or code and pick one) and a collapsed “what else matters” line (food needs, language, how you travel, step-free access) are the additions.'],
 dnasum:['Your DNA','A profile you can open any time','The round DNA button at the top right of the shortlist and the full results page opens this page; Back returns to where you were. Edits apply to the list straight away; Save keeps them as your defaults. Every card opens and closes by tapping its header, and cards open by default only where you have already made specific choices. Interests start with the ones you have a level for, highest first; Show all adds the rest, grouped by category, and an interest set to Off cannot expand until you pick Curious or higher. Changing a level does not reorder anything: the order refreshes the next time you open the page, and any change except Off opens the card. The Interests header counts how many you have selected and how many you have fine-tuned with specifics. The four main blocks collapse too. This-trip-only items sit last and start switched off.'],
 essentials:['Essentials','The app\'s own “open to” pills, then one optional line','When, who is going (select all that apply), then Budget & Comfort and Weather as the app\'s multi-select “Open to” pills. Everything selected means no preference, so tapping nothing is a valid answer. Social Vibe and Physical Demand, the other two bands the app already has, sit in the optional line with the new factors. The window-driven traveler gets a heavier “when” and a logistics screen next. The casual traveler goes straight to photos.'],
 logistics:['Window','Getting there is optional, and firm when set','Skippable. A cap on flight time or nonstop-only removes places from the list instead of nudging them down. They show as blue chips and a “set aside” note, so nothing silently disappears. The app does not yet know home airports; this is the one new input this path needs.'],
 vibes:['Essentials','Only for people who skipped interests','Photos instead of dropdowns: beach, food, hotels, a little adventure. Anyone who picked interests has already told us what they like, so this page would repeat them and is skipped. The real app would use photography here.'],
 when:['Window','Date first','Picking “a date or a limit” puts When first, then Getting there, before anything else. A person with a window knows it before they know what they want to do.'],
 welcome:['Returning traveler','Ask only what changed','Dates and who is coming. Everything else comes from the saved Travel DNA. Interest follow-ups already answered are not asked again.'],
 results:['Your top 5','The questions grow out of the Travel DNA icon','The page is called Your top 5 and nothing is blurred. The question box starts open, grown from the round Travel DNA icon at the top right, with the Travel DNA percent bar inside it and a way into the full Travel DNA page. What you chose (when, who, budget, weather, limits, what matters) sits in chips under the box. Scroll down the list and the box shrinks back into the icon; tap the icon to open it again (it scrolls you back up). The full list is locked until the Travel DNA reaches 10%; each answered question adds 2%. Returning travelers skip the lock.'],
 sharpen:['Sharpen','The next question is chosen, not scripted','Enthusiasts get their expert lane first (fishing: offshore, fly or inshore). After that, the app tries each unanswered question against the current top 5 and asks the one that would change it most. The hint on the card is the real number from this prototype. A toast shows who moved.'],
 save:['Save','Trip details and tastes are saved separately','Dates and who is coming stay with this trip by default. Budget, vibes, interests and answers go into the Travel DNA. Each line can be flipped. The saved DNA is labelled a first sketch with a calibration score.'],
 saved:['Save','Next time starts here','Open the returning-traveler view to see the shortened version of the flow.']
};
function railHTML(){let key=st.screen;if(key==='results'){const rr=rank(st);key=st.sheet==='save'?'save':rr.ok.some(x=>x.by)?'gate':hasAnswers()?'sharpen':'results'}
 if(st.sheet==='save')key='save';if(st.screen==='saved')key='saved';if(st.screen==='dnasum')key='dnasum';
 const n=NOTES[key]||NOTES.door;const dna=st.mode==='dna';
 const stages=dna?['Interests','Reasons','Taste','Basics','Your DNA']:['Anchor','Essentials','First results','Sharpen','Save'];
 const idx=dna?({love:0,rank:1,vibes:2,cards:2,dnabasics:3,dnasum:4,results:4,sharpen:4,gate:4,all:4,save:4,saved:4})[key]:({door:0,when:1,love:0,rank:0,essentials:1,logistics:1,vibes:1,welcome:1,results:2,gate:2,all:2,sharpen:3,dnasum:4,save:4,saved:4})[key];
 return `<h1>${dna?'Travel DNA first':'Trip-first onboarding'}</h1><p>${dna?'No trip yet. Learn the traveler, then use it on the first trip.':'Start from the trip. Keep what you learn as Travel DNA. Try it: pick a door, or jump in as one of the travelers below.'}</p>
 <div class="stages">${stages.map((s,i)=>`<div class="stage ${i===idx?'on':i<idx?'done':''}"><i></i>${s}</div>`).join('')}</div>
 <div class="note"><b>${n[1]===undefined?'':n[0]}</b><p><strong>${n[1]}.</strong> ${n[2]}</p></div>
 <div class="presets"><small>Jump in as</small>
 <button class="pre" data-a="preset" data-k="sam">Sam, wants a nice vacation<span>Beach, food, a good hotel. Three screens.</span></button>
 <button class="pre" data-a="preset" data-k="priya">Priya, the angler<span>Fishing is the reason for the trip. Gets the expert lane.</span></button>
 <button class="pre" data-a="preset" data-k="alex">Alex, a long list of niche loves<span>Birding, stargazing, coffee, crafts, trail running, hot springs. Found through the groups and search.</span></button>
 <button class="pre" data-a="preset" data-k="riya">Riya, vegan family of four<span>Kids 5 to 12 and under 5, vegan is a must. Opens the “what else matters” list with both picks showing.</span></button>
 <button class="pre" data-a="preset" data-k="omar">Omar, a golfer<span>Golf is a Top interest, which brings in a specialist place.</span></button>
 <button class="pre" data-a="preset" data-k="jordan">Jordan, one exact week<span>Second week of October, nonstop from SFO.</span></button>
 <button class="pre" data-a="preset" data-k="mina">Mina, no trip yet<span>Starts from the Travel DNA link on the first slide.</span></button>
 <button class="pre" data-a="preset" data-k="back">A returning traveler<span>Opens on two questions.</span></button></div>
 <div class="fine">Sample destinations and scores are invented for this mockup. The 48 interests and 4 groups are the app\'s real ones; interests beyond the original ten get illustrative scores. The photos would be real photography.</div>`}

/* =================== render =================== */
function render(){const ph=$('#phone');const old=ph.querySelector('.scr');const sc0=old?old.scrollTop:0;const prevScr=ph.dataset.scr;
 const rects={},wids={};ph.querySelectorAll('[data-flip]').forEach(e=>rects[e.dataset.flip]=e.getBoundingClientRect().top);ph.querySelectorAll('[data-fw]').forEach(e=>wids[e.dataset.fw]=e.getBoundingClientRect().width);
 const S={when:sWhen,all:sAll,door:sDoor,love:sLove,rank:sRank,cards:sCards,dnabasics:sDnaBasics,dnasum:sDnaSum,essentials:sEss,logistics:sLog,vibes:sVibes,welcome:sWelcome,results:sResults,saved:sSaved}[st.screen];
 ph.innerHTML=S()+sheetHTML()+topModal();ph.dataset.scr=st.screen;
 const sc=ph.querySelector('.scr');if(sc&&prevScr===st.screen)sc.scrollTop=sc0;
 if(st.anchor){const an=st.anchor;st.anchor=null;const ae=ph.querySelector('[data-flip="'+an+'"]');if(sc&&ae&&rects[an]!=null&&prevScr===st.screen){sc.scrollTop+=ae.getBoundingClientRect().top-rects[an]}}
 if(prevScr===st.screen){ph.querySelectorAll('[data-flip]').forEach(e=>{const o=rects[e.dataset.flip];if(o==null)return;const dy=o-e.getBoundingClientRect().top;if(Math.abs(dy)>2){e.animate([{transform:`translateY(${dy}px)`},{transform:'none'}],{duration:480,easing:'cubic-bezier(.2,.8,.2,1)'})}});ph.querySelectorAll('[data-fw]').forEach(e=>{const o=wids[e.dataset.fw];if(o==null)return;const w=e.getBoundingClientRect().width;if(Math.abs(o-w)>2){e.style.overflow='hidden';e.animate([{width:o+'px'},{width:w+'px'}],{duration:280,easing:'cubic-bezier(.2,.8,.2,1)'})}})}
 if(st.screen==='results'){const rs=ph.querySelector('#rscr');if(rs)rs.addEventListener('scroll',()=>{if(st.qopen!==false&&rs.scrollTop>110)shutQ()},{passive:true})}
 $('#rail').innerHTML=railHTML()}

/* =================== events =================== */
document.addEventListener('input',e=>{if(e.target.classList&&e.target.classList.contains('hpin')){st.hq=e.target.value;const r=e.target.parentElement.querySelector('.hpres');if(r)r.innerHTML=hpRes();return}if(e.target.id==='q'){st.q=e.target.value;const r=$('#sres');if(r)r.innerHTML=searchRes()}if(e.target.id==='ps'){st.ps=e.target.value;const sel=e.target.selectionStart;render();const i=$('#ps');if(i){i.focus();i.setSelectionRange(sel,sel)}}});
document.addEventListener('keydown',e=>{const t=e.target;if((e.key==='Enter'||e.key===' ')&&t&&t.getAttribute&&t.getAttribute('role')==='button'&&t.dataset.a){e.preventDefault();t.click()}});
document.addEventListener('click',e=>{const t=e.target.closest('[data-a]');if(!t)return;const a=t.dataset.a,k=t.dataset.k;
 if(a==='bg'){if(e.target===t){st.sheet=null;render()}return}
 switch(a){
 case 'door':{const d=st.doors;if(k==='love'||k==='open'){d.love=k==='love';d.open=k==='open'}else{d.window=k==='window';d.flex=k==='flex'}render();break}
 case 'next':{if(st.editDna&&st.screen==='love'){st.editDna=false;go('dnasum');break}const p=path();const i=p.indexOf(st.screen);if(i<p.length-1)go(p[i+1]);else if(st.mode!=='dna'){st.sharp=Math.max(st.sharp,25);go('results')}break}
 case 'back':{if(st.screen==='dnasum'&&st.dnaFrom){const f=st.dnaFrom;st.dnaFrom=null;go(f);break}if(st.screen==='love'&&st.editDna){st.editDna=false;go('dnasum');break}if(st.screen==='welcome'){go('door');break}const p=path();const i=p.indexOf(st.screen);if(i>0)go(p[i-1]);else if(st.mode==='dna'){st=fresh();go('door')}break}
 case 'int':{if(st.interests[k])delete st.interests[k];else st.interests[k]=2;render();break}
 case 'star':{const on=st.interests[k]>=3;if(on){st.interests[k]=2;st.topMsg=false}else if(Object.values(st.interests).filter(w=>w>=3).length<MAXSTAR){st.interests[k]=3;st.topMsg=false}else st.topMsg=true;render();break}
 case 'sub':{const o=t.dataset.o,a=st.subs[k]||(st.subs[k]=[]),i=a.indexOf(o);if(i>=0)a.splice(i,1);else a.push(o);render();break}
 case 'grp':st.grp=k;render();break;
 case 'contgrp':st.grp=k;render();{const sc=$('.scr');if(sc)sc.scrollTop=0}break;
 case 'careopen':st.careOpen=!st.careOpen;render();break;
 case 'caresel':{const c=CARE.find(x=>x.k===k);if(c.sheet){st.sheet=c.sheet;render();break}const i=st.careTiles.indexOf(k);if(i>=0)st.careTiles.splice(i,1);else st.careTiles.push(k);render();break}
 case 'careclear':delete st.care[k];render();break;
 case 'cband':{const o=t.dataset.o;let set=narrowed(k)?[...st.bands[k]]:[];const i=set.indexOf(o);if(i>=0)set.splice(i,1);else set.push(o);set.sort((x,y)=>BK[k].indexOf(x)-BK[k].indexOf(y));st.bands[k]=set.length?set:[...BK[k]];if(st.screen==='results')refresh();else render();break}
 case 'pkrm':{const c=CARE.find(x=>x.k===k),o=t.dataset.o;if(c.band){let set=st.bands[k].filter(x=>x!==o);st.bands[k]=set.length?set:[...BK[k]]}else{const v=st.care[k];if(v){const i=v.o.indexOf(o);if(i>=0)v.o.splice(i,1);if(!v.o.length)delete st.care[k]}}if(st.screen==='results')refresh();else render();break}
 case 'careopt':{const c=CARE.find(x=>x.k===k),v=st.care[k]||(st.care[k]={o:[],firm:false}),o=t.dataset.o;const ix=v.o.indexOf(o);if(ix>=0)v.o.splice(ix,1);else if(c.multi)v.o.push(o);else v.o=[o];if(!v.o.length&&st.screen!=='dnasum')delete st.care[k];if(st.screen==='results')refresh();else render();break}
 case 'carefirm':st.care[k].firm=t.dataset.f==='1';render();break;
 case 'careadd':st.careOpen=true;if(!st.careTiles.includes(k))st.careTiles.push(k);render();break;
 case 'all':st.ps='';st.lens=null;st.lsearch=false;st.showSaved=false;go('all');break;
 case 'alltab':st.allTab=k;st.open=null;render();break;
 case 'sort':st.sort=k;render();break;
 case 'unlock':{const stars=Object.values(st.interests).filter(w=>w>=3).length;const d=SLM[k];if(st.interests[k]==null)st.interests[k]=3;else if(st.interests[k]<3){if(stars>=MAXSTAR){toast('Deselect a top interest first to add a new one.');break}st.interests[k]=3}
  render();toast('Specialist places for '+INT[k][0].toLowerCase()+' added to your list');break}
 case 'more':st.more[k]=!st.more[k];render();break;
 case 'skipint':st.interests={};go('essentials');break;
 case 'dnafirst':st=fresh();st.mode='dna';go('love');break;
 case 'csw':{const r={no:-.4,yes:.7,love:1.4}[t.dataset.r];st.swipes.push({i:st.swipeI,r});st.swipeI++;render();break}
 case 'dnasum':go('dnasum');break;
 case 'dnatry':st.flex=true;st.month=null;st.sharp=Math.max(st.sharp,dnaSharpness());go('results');break;
 case 'who':{const i=st.who.indexOf(k);if(i>=0)st.who.splice(i,1);else st.who.push(k);if(st.screen==='results')refresh();else render();break}
 case 'band':{const set=st.bands[k],o=t.dataset.o,i=set.indexOf(o);if(i>=0){if(set.length>1)set.splice(i,1)}else{set.push(o);set.sort((a,b)=>BK[k].indexOf(a)-BK[k].indexOf(b))}if(st.screen==='results')refresh();else render();break}
 case 'bandreset':st.bands[k]=[...BK[k]];render();break;
 case 'sv':SV=k;render();break;
 case 'bm':{const i=st.saved.indexOf(k);if(i>=0)st.saved.splice(i,1);else st.saved.push(k);render();break}
 case 'open2':st.pl=k;st.sheet='place';render();break;
 case 'lens':st.lens=st.lens===k?null:k;render();break;
 case 'lsearch':st.lsearch=!st.lsearch;if(!st.lsearch)st.ps='';render();if(st.lsearch){const i=$('#ps');if(i)i.focus()}break;
 case 'ss':st.showSaved=!st.showSaved;render();break;
 case 'hv':toast('No places marked visited yet');break;
 case 'month':st.month=+k;st.flex=false;if(st.screen==='results')refresh();else render();break;
 case 'flex':st.flex=true;st.month=null;st.week=0;if(st.screen==='results')refresh();else render();break;
 case 'week':st.week=+k;render();break;
 case 'budget':st.budget=+k;if(st.screen==='results')refresh();else render();break;
 case 'hpick':st.origin=k;st.originSet=true;st.hq='';if(st.screen==='results')refresh();else render();break;
 case 'hclear':st.originSet=false;st.direct=false;st.maxH=0;st.hq='';if(st.screen==='results')refresh();else render();break;
 case 'direct':if(!st.originSet){toast('Choose your home airport first');break}st.direct=!st.direct;if(st.screen==='results')refresh();else render();break;
 case 'maxh':if(!st.originSet){toast('Choose your home airport first');break}st.maxH=+k;if(st.screen==='results')refresh();else render();break;
 case 'vibe':{const i=st.vibes.indexOf(k);if(i>=0)st.vibes.splice(i,1);else st.vibes.push(k);render();break}
 case 'results':st.sharp=Math.max(st.sharp,25);go('results');break;
 case 'qtoggle':{const sc=$('.scr');const w=$('#qwrap'),pf=$('.prof');if(st.qopen===false){st.qopen=true;if(w)w.classList.remove('shut');if(pf){pf.classList.add('open');pf.classList.remove('closed');pf.setAttribute('aria-expanded','true')}if(sc&&sc.scrollTop>4){const y0=sc.scrollTop,t0=performance.now();const step=()=>{const p=Math.min(1,(performance.now()-t0)/380);sc.scrollTop=y0*Math.pow(1-p,3);if(p<1)setTimeout(step,16)};step()}}else{shutQ()}break}
 case 'open':st.open=st.open===k?null:k;render();break;
 case 'hid':st.showHid=!st.showHid;render();break;
 case 'sheet':st.sheet=k;render();break;
 case 'closesheet':st.sheet=null;render();break;
 case 'ans':{const q=QMAP[t.dataset.q];const before=rank(st).ok.map(x=>x.d.id);st.ans[q.id]=+k;st.sharp=Math.min(96,Math.max(st.sharp,25)+(q.int?10:8));
  const after=rank(st).ok;let best=null;after.forEach((x,i)=>{const was=before.indexOf(x.d.id);const mv=was-i;if(was>=0&&(!best||Math.abs(mv)>Math.abs(best.mv)))best={n:x.d.n,mv,i}});
  const was=dnaPct()-2;render();if(was<UNLOCK&&dnaPct()>=UNLOCK)toast('Your full list is unlocked');else if(locked())toast('Saved. Travel DNA is at '+dnaPct()+'%. '+UNLOCK+'% unlocks the full list');else if(best&&best.mv!==0)toast(best.n+(best.mv>0?' moved up '+best.mv:' moved down '+(-best.mv)));else toast('Saved. The order held.');break}
 case 'skipq':st.ans[k]=-1;st.sharp=Math.max(st.sharp,25)+2;render();break;
 case 'swipe':st.swipeI=0;st.sheet='swipe';render();break;
 case 'sw':{const r={no:-.4,yes:.7,love:1.4}[t.dataset.r];const before=rank(st).ok.map(x=>x.d.id);st.swipes.push({i:st.swipeI,r});st.swipeI++;st.sharp=Math.min(96,Math.max(st.sharp,25)+4);
  if(st.swipeI>=CARDS.length){st.sheet=null;render();const after=rank(st).ok;const mv=after.map((x,i)=>({n:x.d.n,d:before.indexOf(x.d.id)-i})).sort((a,b)=>Math.abs(b.d)-Math.abs(a.d))[0];toast(mv&&mv.d?mv.n+(mv.d>0?' moved up '+mv.d:' moved down '+(-mv.d)):'Your taste is in')}else render();break}
 case 'save':case 'dna':st.dnaFrom=st.screen;go('dnasum');break;
 case 'lvl':{const l=t.dataset.l,lv=LEVELS.find(x=>x[0]===l);const was=st.interests[k];if(l==='off'){delete st.interests[k];st.dxo['i:'+k]=false;st.topMsg=false}else{const tops=Object.values(st.interests).filter(w=>w>=3).length;if(l==='top'&&!(was>=3)&&tops>=MAXSTAR){st.topMsg=true}else{st.interests[k]=lv[2];st.dxo['i:'+k]=true;st.topMsg=false}}render();break}
 case 'closemsg':{if(t.classList.contains('mbg')&&e.target!==t)break;st.topMsg=false;render();break}
 case 'dsec':st.dsc[k]=!st.dsc[k];render();break;
 case 'dall':st.dall=!st.dall;render();break;
 case 'dx':{if(k.startsWith('i:')){const id=k.slice(2);if(!st.interests[id]||!(SUBCH[id]||[]).length)break}st.dxo[k]=!dOpen(k);render();break}
 case 'careadd2':st.care[k]={o:[],firm:false};st.dxo['c_'+k]=true;render();break;
 case 'keep':{const r=dnaRows().find(x=>x.k===k);if(r){st.keep[k]=!keepOn(k,r.def)}render();break}
 case 'commit':{const R=dnaRows();const kept=k=>{const r=R.find(x=>x.k===k);return r?keepOn(k,r.def):true};const bands={};BANDS.forEach(b=>bands[b.k]=kept('b_'+b.k)?[...st.bands[b.k]]:[...BK[b.k]]);savedDNA=JSON.stringify({bands,vibes:kept('vibes')?st.vibes:[],interests:st.interests,subs:st.subs,ans:kept('ans')?st.ans:{},care:Object.fromEntries(Object.entries(st.care).filter(([c])=>kept('c_'+c)))});if(st.dnaFrom){const f=st.dnaFrom;st.dnaFrom=null;go(f);toast('Travel DNA saved')}else go('saved');break}
 case 'asreturn':presetBack(true);break;
 case 'preset':preset(k);break;
 }});
function refresh(){render()}
function preset(k){st=fresh();
 if(k==='sam'){st.doors.open=true;st.doors.flex=true;st.name='Sam';go('door')}
 if(k==='priya'){st.doors.love=true;st.doors.flex=true;st.interests.fishing=3;st.name='Priya';go('love')}
 if(k==='jordan'){st.doors.window=true;st.doors.open=true;st.who=['partner'];st.month=9;st.week=2;st.origin='SFO';st.originSet=true;st.direct=true;st.bands.budget=['highend','luxury'];st.name='Jordan';go('when')}
 if(k==='alex'){st.doors.love=true;st.doors.flex=true;['birding','stargazing','coffeeTea','traditionalCrafts','trailRunning','hotSprings'].forEach(x=>st.interests[x]=2);st.interests.birding=3;st.interests.stargazing=3;st.name='Alex';st.grp='Nature & Wildlife';go('love')}
 if(k==='riya'){st.doors.open=true;st.doors.window=true;st.name='Riya';st.who=['partner','kids'];st.month=6;st.bands.budget=['basic','comfortable'];st.care={kids:{o:['k','u5'],firm:false},food:{o:['vegan'],firm:true}};st.careOpen=true;st.careTiles=['kids','food'];go('essentials')}
 if(k==='omar'){st.doors.love=true;st.doors.flex=true;st.interests={golf:3,wine:2,hiking:2};st.name='Omar';st.grp='Sports & Recreation';go('love')}
 if(k==='mina'){st.mode='dna';st.name='Mina';go('love')}
 if(k==='back')presetBack(false)}
function presetBack(fromSave){let d=null;if(savedDNA){d=JSON.parse(savedDNA)}
 const keepMonth=false;st=fresh();st.returning=true;st.name='Priya';
 if(d){if(d.bands)st.bands=d.bands;st.vibes=d.vibes;st.interests=d.interests;st.ans=d.ans;st.subs=d.subs||{};st.care=d.care||{}}
 else{st.bands.budget=['highend','luxury'];st.vibes=['beach','food'];st.interests={fishing:3};st.ans={f1:0}}
 st.who=['partner'];st.sharp=62;go('welcome')}
render();