# 22 Nov 2026: applies the owner's notes to the interactive place card review (real bookmark icon, both authored paragraphs kept, three About paragraphs, cost range kept, weekly chart, no score colors).
p='scripts/data/build-placecard-interactive-nov22.py'; t=open(p).read()

# real bookmark icon from BookmarkIcon.tsx
t=t.replace("function hdr(on,s){","var BM='<svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16l-6-4-6 4V4z\"/></svg>';\nfunction hdr(on,s){",1)
t=t.replace("""(both?'<span style="width:32px;height:32px;display:grid;place-items:center;color:var(--adim)">🔖</span>':'')""","""(both?'<span style="width:32px;height:32px;display:grid;place-items:center;color:var(--adim)">'+BM+'</span>':'')""")
t=t.replace("""'<span style="width:32px;height:32px;border:1px solid var(--aln);border-radius:50%;display:grid;place-items:center">🔖</span>'""","""'<span style="width:32px;height:32px;border:1px solid var(--aln);border-radius:50%;display:grid;place-items:center;color:var(--adim)">'+BM+'</span>'""")
# f1 scope
t=t.replace("w:'\"Your top interests · Tap to compare\", \"Tap any interest above…\", \"Tap any month…\" and \"TAP TO COMPARE\" all go. The tips popup teaches this once.'","w:'\"Your top interests · Tap to compare\", \"Tap any interest above…\", \"Tap any month…\" and \"TAP TO COMPARE\" all go, and the same \"· Tap to compare\" on the single-interest and About charts. The tips popup teaches this once.'")

i=t.index("{id:'one',"); j=t.index("{id:'about',")
one=r"""{id:'one',name:'One interest',verdict:'<b>Keep the two authored paragraphs exactly as they are.</b> The page tells you about whale watching in Namibia in general, then whale watching in Namibia in September, and both stay. Only the month label and the orange pills are up for change.',
 states:[{id:'a',label:'Whale Watching',shots:['si']}],
 changes:[
  {id:'pc_s1',t:'Shorter month label: "In September"',w:'The month card repeats the whole name ("Whale Watching in Namibia in September") right under a paragraph and a chip that already say it. "In September" keeps the split between the general paragraph and the month paragraph. Both paragraphs are untouched.'},
  {id:'pc_s3',t:'Remove the orange "From your picks and answers" pills',w:'They only show for some interests, and the same reasons already appear on the shaded rows in My Interests.'}],
 mock:function(on,s){var m=ui(s,'m',8),sc=SC.whale[m];var MN=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var general='<p style="margin:6px 0 10px"><b>Bottlenose</b> and endemic <b>Heaviside’s dolphins</b> are reliably seen on marine cruises from Walvis Bay, while <b>humpback</b> and <b>southern right whales</b> pass offshore during their winter migration from July to November.</p>';
  var monthPara=(m===8)?'<p style="margin:8px 0 0"><b>Humpback</b> and <b>southern right whales</b> are regularly seen passing offshore during their winter migration, adding to the reliable sightings of <b>Heaviside’s</b> and <b>bottlenose dolphins</b> on Walvis Bay cruises.</p>':'<p class="dim" style="margin:8px 0 0;font-style:italic">A paragraph written for '+MN[m]+' goes here. Tap September to see a real one.</p>';
  var title=on('pc_s1')?'In '+MN[m]:'Whale Watching in Namibia in '+MN[m];
  var card='<div style="background:#f1ede6;border-radius:14px;padding:12px 14px;margin-top:6px"><div style="display:flex;align-items:center"><div style="flex:1"><b>'+title+'</b><div style="font-weight:700;color:'+(sc>=7?'var(--agood)':sc>=5?'#a68a2e':'var(--abad)')+'">'+wd(sc).replace('match','match')+'</div></div><span style="font-size:24px;font-weight:800;color:'+(sc>=7?'var(--agood)':sc>=5?'#a68a2e':'var(--abad)')+'">'+sc.toFixed(1)+'</span></div>'+monthPara+'</div>';
  var pills=on('pc_s3')?'':'<div class="lab" style="margin:12px 0 6px">From your picks and answers</div><div class="pills"><span class="pill" style="border-color:var(--ac);background:var(--as)">Not your kind of boat</span><span class="pill" style="border-color:var(--ac);background:var(--as)">No swimming with whales</span></div>';
  var tapLine=on('pc_f1')?'':' · Tap to compare';
  return {body:hdr(on,'FOR YOU')+chips(s,'whale',on,true)+'<div style="padding:0 16px"><div style="font-weight:800;font-size:15px;margin:10px 0 0">🐋 Whale Watching in Namibia</div>'+general+'<div class="lab" style="margin:6px 0 0">Whale Watching by month'+tapLine+'</div>'+chart(s,SC.whale,m)+card+pills+'</div>',flush:true};}},

"""
t=t[:i]+one+t[j:]

i=t.index("{id:'about',"); j=t.index("{id:'costs',")
about=r"""{id:'about',name:'About',verdict:'<b>Lighter, with all three paragraphs kept.</b> The tab has three pieces of authored writing: what Namibia is about, the general seasons, and what Namibia is like in the month you picked. All three stay. Two boxed cards frame them, and the chart title can be mistaken for your personal chart.',
 states:[{id:'a',label:'About',shots:['ab']}],
 changes:[
  {id:'pc_a1',t:'Plain sections instead of boxed cards',w:'Space between sections does the job a border does now.'},
  {id:'pc_a2',t:'Rename the chart "Best months for a typical visitor"',w:'So it never looks like the personal month chart on the For You tab.'},
  {id:'pc_a3',t:'One line for the month: name, verdict and tag',w:'"September · Excellent time to go · Dry season" on one line instead of four stacked labels. The paragraph about that month stays right under it.'}],
 mock:function(on,s){var m=ui(s,'m',8);var ALL=[7.0,7.2,7.4,7.6,8.8,9.0,9.2,9.4,9.6,7.0,6.6,6.0];var v=ALL[m];var dry=(m>=4&&m<=9);var MN=['January','February','March','April','May','June','July','August','September','October','November','December'][m];var box=function(x){return on('pc_a1')?'<div style="margin-bottom:14px">'+x+'</div>':'<div class="card">'+x+'</div>';};
  var intro=box('<p style="margin:0 0 8px">A self-drive road-trip country of desert, dunes, and wildlife-ringed waterholes, built for exploring independently rather than only by guided safari.</p><p style="margin:0">Dry season May–Oct concentrates wildlife at waterholes for classic sightings; wet season Nov–Apr brings dramatic skies and migratory birds.</p>');
  var verdict=(v>=8?'Excellent time to go':v>=6.5?'Good time to go':'Less ideal');var tag='<span style="border:1px solid var(--aln);border-radius:99px;padding:1px 9px;font-size:11.5px;color:var(--adim)">'+(dry?'Dry season':'Wet season')+'</span>';
  var para=(m===8)?'<p style="margin:8px 0 0"><b>September</b> in Namibia is warming up, dry with excellent wildlife viewing at waterholes.</p>':'<p class="dim" style="margin:8px 0 0;font-style:italic">A paragraph written for '+MN+' goes here. Tap September to see a real one.</p>';
  var line=on('pc_a3')?'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px"><b>'+MN+' · <span style="color:'+colr(v)+'">'+verdict+'</span></b>'+tag+'</div>'+para:'<div style="margin-top:10px;padding:10px 12px;border-radius:12px;background:#f1ede6"><b style="display:block">'+MN+'</b><div style="font-weight:700;color:'+colr(v)+'">'+verdict+'</div><div style="margin:4px 0">'+tag+'</div>'+para.replace('margin:8px 0 0','margin:4px 0 0')+'</div>';
  var tapLine=on('pc_f1')?'':' · Tap to compare';
  var ch=box('<div class="lab" style="margin:0 0 4px">'+(on('pc_a2')?'Best months for a typical visitor':'Best months overall'+tapLine)+'</div>'+chart(s,ALL,m)+line);
  return {body:hdr(on,'ABOUT')+'<div style="padding:14px 16px">'+intro+ch+'</div>',flush:true};}},

"""
t=t[:i]+about+t[j:]

i=t.index("{id:'costs',"); j=t.index("\n];\n\"\"\"")
costs=r"""{id:'costs',name:'Costs',verdict:'<b>Keep the range, and keep the weekly chart.</b> The price range has to show both ends: some places can be done cheap or lavish, some only cheap, some only expensive. The hotel chart is weekly on purpose, because a Christmas spike is not a whole-month spike. Only color and a few labels are up for change.',
 states:[{id:'a',label:'Costs',shots:['co','co2']}],
 changes:[
  {id:'pc_c1',t:'Add a five-step scale under "$$ – $$$$$" that shows the span',w:'The range text stays. Under it, five steps from $ to $$$$$ light up between the two ends, so a wide place fills most of the bar, a budget-only place fills the left end and an expensive-only place fills the right. Tap the examples.'},
  {id:'pc_c2',t:'Hotel chart: not blue, and your month marked',w:'Still 52 weekly bars with the average line. The blue changes to a color that is not good, okay or bad, and the weeks of the month you are viewing stay solid while the rest soften. Pick a color below the chart.'},
  {id:'pc_c3',t:'Keep the "Mild" badge, drop the ⓘ',w:'"Mild" is useful at a glance. The ⓘ opens a table of multipliers (Flat under 1.1x … Extreme over 2x) that few people need, and the sentence beside it already says it in plain words.'},
  {id:'pc_c4',t:'Cards lose their borders',w:'Matches the other tabs, where sections are separated by space.'}],
 mock:function(on,s){var m=ui(s,'m',8);var ex=ui(s,'ex','nam');var colk=ui(s,'col','ink');
  var EX={nam:[2,5,'Namibia'],ind:[1,5,'Wide range, like India or South Africa (example)'],nic:[1,2,'Budget only, like Nicaragua or Guatemala (example)'],swi:[4,5,'High end only, like Switzerland or Dubai (example)']};
  var lo=EX[ex][0],hi=EX[ex][1];var tiers=function(n){return Array(n+1).join('$');};
  var card=function(x){return on('pc_c4')?'<div style="margin-bottom:14px">'+x+'</div>':'<div class="card">'+x+'</div>';};
  var label='<div style="display:flex;align-items:baseline;gap:8px"><b style="font-size:19px;letter-spacing:.5px">'+tiers(lo)+(hi!==lo?' – '+tiers(hi):'')+'</b><span class="fa small">daily cost range</span><span style="margin-left:auto;width:20px;height:20px;border:1.5px solid var(--afa);border-radius:50%;display:grid;place-items:center;font-size:11px;color:var(--afa)">i</span></div>';
  var scale=on('pc_c1')?'<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin:10px 0 2px">'+[1,2,3,4,5].map(function(k){var inr=k>=lo&&k<=hi;return '<div style="text-align:center"><div style="height:8px;border-radius:'+(k===lo&&k===hi?'8px':k===lo?'8px 2px 2px 8px':k===hi?'2px 8px 8px 2px':'2px')+';background:'+(inr?'#3c3a36':'#e3ddd4')+'"></div><div style="font-size:11px;margin-top:3px;font-weight:'+(inr?'800':'500')+';color:'+(inr?'var(--afg)':'var(--afa)')+'">'+tiers(k)+'</div></div>';}).join('')+'</div><div class="fa small" style="margin-bottom:6px">under $100 a day … $800+</div><div class="pills" style="margin:6px 0 4px">'+Object.keys(EX).map(function(k){return pill(s,'ex',k,k==='nam'?'Namibia':k==='ind'?'Wide':k==='nic'?'Budget only':'High end only',ex===k,'out');}).join('')+'</div><div class="fa small">'+EX[ex][2]+'</div>':'';
  var top=card(label+scale+'<p class="dim" style="margin:8px 0 0">Uniquely great as a self-drive trip in a rented camper van, though luxe lodge options exist too for those who want them.</p>');
  var items=card([['☕','Coffee','$2'],['🍺','Windhoek Lager','$3'],['🥩','Game meat dinner','$15'],['🐃','Etosha park entry, per person per day','$18'],['🚙','4x4 rental, self-drive, per day','$100'],['✨','Luxury safari lodge, per person, per night, all inclusive','$900']].map(function(x,i,a){return '<div class="row'+(i===a.length-1?' last':'')+'"><span>'+x[0]+'</span><span class="l" style="font-weight:500;color:var(--adim)">'+x[1]+'</span><b>'+x[2]+'</b></div>';}).join(''));
  var COL={ink:'#6b665f',plum:'#8b72b3',teal:'#3b8f99'};var col=on('pc_c2')?COL[colk]:'#4f6fd0';
  var starts=[0,31,59,90,120,151,181,212,243,273,304,334,365];var bars=[];for(var w=0;w<52;w++){var mid=w*7+3;var inM=mid>=starts[m]&&mid<starts[m+1];var h=(mid>=181&&mid<304)?97:88;bars.push('<i style="flex:1;height:'+h+'%;background:'+col+';opacity:'+(on('pc_c2')?(inM?1:.35):1)+';border-radius:1px"></i>');}
  var POS=[15.5,45,74.5,105,135.5,166,196.5,227.5,258,288.5,319,349.5].map(function(d){return d/3.65;});
  var axis='<div style="position:relative;height:16px;margin-top:3px">'+MS.map(function(x,i){return '<button style="position:absolute;left:'+POS[i]+'%;transform:translateX(-50%);font-size:10.5px;'+(on('pc_c2')&&i===m?'color:var(--ac);font-weight:800':'color:var(--afa)')+'" '+D(s,'m',i)+'>'+x+'</button>';}).join('')+'</div>';
  var badge='<span style="margin-left:auto;font-weight:800;font-size:12.5px">Mild</span>'+(on('pc_c3')?'':'<span style="margin-left:8px;width:20px;height:20px;border:1.5px solid var(--afa);border-radius:50%;display:grid;place-items:center;font-size:11px;color:var(--afa)">i</span>');
  var picker=on('pc_c2')?'<div class="pills" style="margin:8px 0 2px"><span class="fa small" style="align-self:center">Color</span>'+[['ink','Ink grey'],['plum','Plum'],['teal','Teal']].map(function(x){return pill(s,'col',x[0],x[1],colk===x[0],'out');}).join('')+'</div>':'';
  var hotel=card('<div style="display:flex;align-items:center"><b style="font-size:12.5px">Cost seasonality</b>'+badge+'</div><p style="margin:8px 0">Hotel prices are fairly flat, with a slight rise at many hotels from July to October.</p><div style="position:relative;display:flex;align-items:flex-end;gap:1px;height:70px"><span style="position:absolute;left:0;right:0;bottom:92%;border-top:1px dashed #8b867d"></span>'+bars.join('')+'</div>'+axis+'<div class="fa small" style="text-align:right;margin-top:2px">---- average price</div>'+picker);
  return {body:hdr(on,'COSTS')+'<div style="padding:14px 16px">'+top+items+hotel+'</div>',flush:true};}}"""
t=t[:i]+costs+t[j:]
open(p,'w').write(t)
print('patched')
