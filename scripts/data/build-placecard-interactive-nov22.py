# 22 Nov 2026: the place card review rebuilt like the screens review: a tappable phone per part of the card, each proposed change on Keep/Skip, picks saved in the artifact db (collection placeCardReview).
import base64,json,glob,re
T='/Users/brendansalant-pearce/.claude/projects/-Users-brendansalant-pearce-Desktop-Claude-Code/7967b631-7de4-44fc-a69e-c242cec19f01/tool-results/'
def img(n):
    return 'data:image/jpeg;base64,'+base64.b64encode(open(glob.glob(T+'mcp-Claude_Browser-blob-'+n+'.jpg')[0],'rb').read()).decode()
SH={'fy':img('1795310811543-xk2z73'),'fy2':img('1795310827039-1txu23'),'ab':img('1795310843407-tz567p'),'co':img('1795310851817-wokoij'),'co2':img('1795310858273-nlq47q'),'si':img('1795310867951-qkdlqi')}
t=open('scripts/data/screens-review-template.html').read()
# keep head (css + helpers), replace SCREENS..plumbing start with the place card screens
head=t[:t.index("/* Built in the app from her picks")]
tail=t[t.index("/* what is built or decided no is not shown again"):]
head=head.replace("<title>Screen By Screen Review</title>","<title>Place Card Review</title>").replace("Every screen, tidied: pick what you like","The place card, tidied: pick what you like")
head=head.replace("Each section has a phone you can tap, and a list of proposed changes. Mark each change Keep or Skip. The phone updates live, so Skip puts that one part back to how it is today. Tap Current to see the real screenshot.","Each section is one part of the place card, drawn as a phone you can tap (chips, months, rows). Mark each proposed change Keep or Skip and the phone updates live, so Skip puts that one part back. Current shows a real screenshot of Namibia in September. The numbers inside the drawn phones are illustrative.")
head=re.sub(r'<div class="flat"><b>Looked at.*?</div>\n<div class="sum">','<div class="sum">',head,flags=re.S)
head=head.replace("<details class=\"flat\"><summary><b>Already built and gone from this page</b></summary><ul id=\"builtlist\"></ul></details>\n","")
head=head.replace("body{margin:0;","body{margin:0;")
body=r"""
var BUILT=[];var BUILT_TITLES=[];var DECIDED_NO=[];
var MS=['J','F','M','A','M','J','J','A','S','O','N','D'];
var SC={my:[4.1,4.3,4.4,4.8,5.0,5.4,6.1,6.3,6.8,6.2,4.6,4.4],whale:[2.4,2.2,2.6,2.8,3.0,3.4,3.6,3.5,3.3,3.2,2.9,2.6],star:[6.5,6.8,7.0,7.6,8.4,9.2,9.8,9.9,10,9.4,8.0,7.0]};
function colr(v){return v>=7?'#7fb995':v>=5?'#e8d3a0':'#e0a68f';}
function wd(sc){return sc>=8?'Excellent match':sc>=6.5?'Good match':sc>=5?'Okay match':'Weak match';}
function chart(s,vals,sel,h){return '<div style="display:flex;align-items:flex-end;gap:4px;height:'+(h||80)+'px;margin:6px 0 2px">'+vals.map(function(v,i){return '<button style="flex:1;height:'+(v*(h||80)/10)+'px;border-radius:5px;background:'+colr(v)+';'+(i===sel?'box-shadow:0 0 0 2px var(--ac)':'')+'" '+D(s,'m',i)+'></button>';}).join('')+'</div><div style="display:flex;gap:4px;font-size:10.5px;color:var(--afa);text-align:center">'+MS.map(function(m,i){return '<span style="flex:1;'+(i===sel?'color:var(--ac);font-weight:800':'')+'">'+m+'</span>';}).join('')+'</div>';}
function mrow(emoji,name,pct,sel){return '<div style="position:relative;display:flex;align-items:center;gap:10px;height:38px;padding:0 12px;margin-bottom:6px;border-radius:10px;background:#ece7df;overflow:hidden"><span style="position:absolute;left:0;top:0;bottom:0;width:'+pct+'%;background:'+colr(pct/10)+';opacity:.5"></span><span style="position:relative">'+emoji+'</span><span style="position:relative;flex:1;font-weight:600">'+name+'</span><b style="position:relative;color:'+(pct>=70?'var(--agood)':pct>=50?'#a68a2e':'var(--abad)')+'">'+pct+'%</b></div>';}
function pillBtn(s,k,v,txt,sel){return '<button class="pill'+(sel?' out':'')+'" '+D(s,k,v)+'>'+txt+'</button>';}
var BM='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16l-6-4-6 4V4z"/></svg>';
function hdr(on,s){var lowOn=on('pc_h1'),both=on('pc_h2');
 var title='<div style="display:flex;align-items:center;gap:10px;padding:14px 16px 6px"><span style="font-size:22px">🏜️</span><div style="flex:1"><div style="font-weight:800;font-size:19px;line-height:1.15">Namibia</div><div class="dim" style="font-size:13px">Southern Africa'+(lowOn?' · <b style="color:var(--ac)">September ⌄</b>':'')+'</div></div>'+(both?'<span style="width:32px;height:32px;display:grid;place-items:center;color:var(--adim)">'+BM+'</span>':'')+'<span style="width:32px;height:32px;display:grid;place-items:center;color:var(--adim)">✕</span></div>';
 var month=lowOn?'':'<div style="display:flex;align-items:center;padding:2px 16px 8px"><span style="border:1.5px solid var(--ac);background:var(--as);border-radius:99px;padding:4px 12px;font-weight:800;color:var(--ac)">September ⌄</span><span style="flex:1"></span>'+(both?'':'<span style="width:32px;height:32px;border:1px solid var(--aln);border-radius:50%;display:grid;place-items:center;color:var(--adim)">'+BM+'</span>')+'</div>';
 var tabs='<div style="display:flex;border-bottom:1px solid var(--aln);margin:0 16px">'+['FOR YOU','ABOUT','COSTS'].map(function(x){return '<div style="flex:1;text-align:center;padding:10px 0;font-size:12px;font-weight:800;letter-spacing:.08em;color:'+(x===s?'var(--afg)':'var(--afa)')+';'+(x===s?'box-shadow:inset 0 -2px 0 var(--ac)':'')+'">'+x+'</div>';}).join('')+'</div>';
 return title+month+tabs;}
function chips(s,cur,on,withScore){function c(k,em,label,v){var sel=cur===k;var sc2=withScore?'<small style="background:'+(v>=7?'var(--agood)':v>=5?'#c9a23c':'var(--abad)')+';color:#fff;border-radius:9px;padding:0 6px;font-size:10.5px;font-weight:800;margin-left:6px">'+v.toFixed(1)+'</small>':'';return '<button class="tab'+(sel?' on':'')+'" '+D(s,'chip',k)+'>'+em+(sel?' '+label:'')+sc2+'</button>';}
 var m=ui(s,'m',8);return '<div class="tabs" style="padding:10px 16px 4px">'+c('my','🧬','My Interests',SC.my[m])+c('whale','🐋','Whale Watching',SC.whale[m])+c('star','✨','Stargazing',SC.star[m])+'</div>';}
var SCREENS=[
{id:'head',name:'The header',verdict:'<b>One row less, one control less loud.</b> The month is a setting for the whole card, so it should read like one, and the bookmark belongs next to close.',
 states:[{id:'a',label:'Header',shots:['fy']}],
 changes:[
  {id:'pc_h1',t:'Month becomes a quiet link under the name',w:'The loud filled month pill on its own row competes with the orange chips below it. As a small link under "Southern Africa" it still opens the month picker.'},
  {id:'pc_h2',t:'Bookmark joins close on the title row',w:'Today they sit on different rows. Together they use less height and are easier to find.'}],
 mock:function(on,s){return {body:hdr(on,'FOR YOU')+'<div style="padding:16px"><div class="card"><div class="dim small">The tabs and everything below stay as they are.</div></div></div>',flush:true};}},

{id:'fy',name:'For You: My Interests',verdict:'<b>Say each thing once.</b> Four separate lines say "tap", "My Interests" appears twice, and the month and score are repeated three times. The first-time tips now teach tapping, so the lines can go.',
 states:[{id:'a',label:'My Interests',shots:['fy','fy2']}],
 changes:[
  {id:'pc_f1',t:'Delete the "tap to…" lines',w:'"Your top interests · Tap to compare", "Tap any interest above…", "Tap any month…" and "TAP TO COMPARE" all go, and the same "· Tap to compare" on the single-interest and About charts. The tips popup teaches this once.'},
  {id:'pc_f2',t:'Remove the repeated "My Interests" heading',w:'The selected chip right above already says it.'},
  {id:'pc_f3',t:'One summary line instead of a card and a sentence',w:'"6.8 Good match · September" replaces the score card, the sentence repeating it, and the extra heading line.'},
  {id:'pc_f4',t:'The sentence only appears when something lowered the score',w:'"Based on your combined top interests" only matters when budget or climate lowered it. Tap October in the chart to see how it shows.'}],
 mock:function(on,s){var m=ui(s,'m',8),sc=SC.my[m];var lowered=(m===9);
  var f1=on('pc_f1'),f2=on('pc_f2'),f3=on('pc_f3'),f4=on('pc_f4');
  var summary=f3?'<div style="display:flex;align-items:baseline;gap:10px;margin:12px 0 4px"><span style="font-size:30px;font-weight:800;color:'+colr(sc)+'">'+sc.toFixed(1)+'</span><b>'+wd(sc)+'</b><span class="dim">'+['January','February','March','April','May','June','July','August','September','October','November','December'][m]+'</span></div>':'<div class="card" style="display:flex;align-items:center;margin:12px 0 8px;background:#f4f0e9"><div style="flex:1"><b>Your combined match in '+['January','February','March','April','May','June','July','August','September','October','November','December'][m]+'</b><div style="color:'+colr(sc)+';font-weight:700">'+wd(sc)+'</div></div><span style="font-size:24px;font-weight:800;color:'+colr(sc)+'">'+sc.toFixed(1)+'</span></div>';
  var sentence=f4?(lowered?'<p class="dim small" style="margin:2px 0 8px">Lowered a little by your climate pick for this month.</p>':''):'<p class="dim small" style="margin:2px 0 8px">The match score of '+sc.toFixed(1)+' is based on your combined top interests.</p><p class="dim small" style="margin:0 0 8px">How well Namibia suits each of your interests in this month.</p>';
  var body=hdr(on,'FOR YOU')+(f1?'':'<div style="padding:10px 16px 0;font-weight:800;font-size:13px">Your top interests · Tap to compare</div>')+chips(s,'my',on,true)+'<div style="padding:0 16px">'+(f2?'':'<div style="font-weight:800;margin:8px 0 2px">🧬 My Interests</div>')+(f1?'':'<p class="dim small" style="margin:0">Tap any interest above to learn more.<br>Tap any month on the chart below to see how it compares.</p><div class="lab" style="margin:8px 0 0">Combined match by month · tap to compare</div>')+chart(s,SC.my,m)+summary+sentence+'<div class="lab" style="color:var(--adim)">Top interests</div>'+mrow('🐋','Whale Watching',Math.round(SC.whale[m]*10))+'<div class="lab" style="color:var(--adim);margin-top:8px">Also liked</div>'+mrow('✨','Stargazing',Math.round(SC.star[m]*10))+'</div>';
  return {body:body,flush:true};}},

{id:'one',name:'One interest',verdict:'<b>Keep the two authored paragraphs exactly as they are.</b> The page tells you about whale watching in Namibia in general, then whale watching in Namibia in September, and both stay. Only the month label and the orange pills are up for change.',
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

{id:'about',name:'About',verdict:'<b>All three paragraphs kept.</b> The tab has three pieces of authored writing: what Namibia is about, the general seasons, and what Namibia is like in the month you picked. All three stay. The open question is the pills under the month name.',
 states:[{id:'a',label:'About',shots:['ab']}],
 changes:[
  {id:'pc_a1',t:'Plain sections instead of boxed cards',w:'Space between sections does the job a border does now.'},
  {id:'pc_a2',t:'Rename the chart "Best months for a typical visitor"',w:'So it never looks like the personal month chart on the For You tab.'},
  {id:'pc_a3',t:'One line for the month; drop the green season pills, keep the warnings',w:'The pills can be: Rainy season, Very hot, Very cold, Reserve/park closed, Not accessible this month, Storm/hazard risk in the water, No snow on the ground, any seasonal hazard, Peak crowds & prices, Higher tourism & prices, Some shops, hotels & restaurants closed, and the two green ones, Dry season and Low season. The warnings tell you something the verdict and paragraph do not, and several can apply at once, so they stay as pills. The two green ones just repeat "Excellent time to go", so they go. The line becomes "September · Excellent time to go", the warnings sit under it only when a month has any, then the paragraph. Use the example chips.'}],
 mock:function(on,s){var m=ui(s,'m',8);var ex=ui(s,'ex','plain');var ALL=[7.0,7.2,7.4,7.6,8.8,9.0,9.2,9.4,9.6,7.0,6.6,6.0];var v=ALL[m];var dry=(m>=4&&m<=9);var MN=['January','February','March','April','May','June','July','August','September','October','November','December'][m];var box=function(x){return on('pc_a1')?'<div style="margin-bottom:14px">'+x+'</div>':'<div class="card">'+x+'</div>';};
  var intro=box('<p style="margin:0 0 8px">A self-drive road-trip country of desert, dunes, and wildlife-ringed waterholes, built for exploring independently rather than only by guided safari.</p><p style="margin:0">Dry season May–Oct concentrates wildlife at waterholes for classic sightings; wet season Nov–Apr brings dramatic skies and migratory birds.</p>');
  var verdict=(v>=8?'Excellent time to go':v>=6.5?'Good time to go':'Less ideal');
  var pill=function(x,tone){var c=tone==='bad'?'var(--abad)':tone==='warn'?'#a68a2e':'var(--agood)';return '<span style="border:1px solid '+c+';color:'+c+';border-radius:99px;padding:1px 9px;font-size:11.5px">'+x+'</span>';};
  var warns=(ex==='warn')?[pill('Rainy season','bad'),pill('Higher tourism & prices','warn'),pill('Some shops, hotels & restaurants closed for the season','bad')]:[];
  var good=(ex==='plain'&&dry)?[pill('Dry season','good')]:[];
  var para=(ex==='plain')?((m===8)?'<p style="margin:8px 0 0"><b>September</b> in Namibia is warming up, dry with excellent wildlife viewing at waterholes.</p>':'<p class="dim" style="margin:8px 0 0;font-style:italic">A paragraph written for '+MN+' goes here. Tap September to see a real one.</p>'):'<p class="dim" style="margin:8px 0 0;font-style:italic">The month paragraph goes here.</p>';
  var line=on('pc_a3')?'<div style="margin-top:10px"><b>'+MN+' · <span style="color:'+colr(v)+'">'+verdict+'</span></b></div>'+(warns.length?'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'+warns.join('')+'</div>':'')+para:'<div style="margin-top:10px;padding:10px 12px;border-radius:12px;background:#f1ede6"><b style="display:block">'+MN+'</b><div style="font-weight:700;color:'+colr(v)+'">'+verdict+'</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0">'+warns.concat(good).join('')+'</div>'+para.replace('margin:8px 0 0','margin:4px 0 0')+'</div>';
  var exchips='<div class="pills" style="margin:0 0 10px"><span class="fa small" style="align-self:center">Example</span>'+pillBtn(s,'ex','plain','Namibia',ex==='plain')+pillBtn(s,'ex','warn','A month with warnings',ex==='warn')+'</div>';
  var ch=box('<div class="lab" style="margin:0 0 4px">'+(on('pc_a2')?'Best months for a typical visitor':'Best months overall')+'</div>'+chart(s,ALL,m)+line);
  return {body:hdr(on,'ABOUT')+'<div style="padding:14px 16px">'+intro+exchips+ch+'</div>',flush:true};}},

{id:'costs',name:'Costs',verdict:'<b>Keep the range, the weekly bars, and the "closed" and "faded" weeks.</b> The price range keeps both ends as it is today. The hotel chart already uses faded bars (some hotels closed) and hatched stubs (most hotels closed), so nothing about the viewed month gets marked. What is left is the color.',
 states:[{id:'a',label:'Costs',shots:['co','co2']}],
 changes:[
  {id:'pc_c2',t:'Recolor the hotel chart (color only)',w:'Same 52 weekly bars, same average line, same faded and hatched weeks. Only the bar color changes. My pick is ink grey: price is not good or bad, ink is already in the palette, and plum or slate would each be a one-off. The blue is a one-off too, so this is a small gain; skip it if you will redo the palette later. Try the colors and the Assam-style example.'},
  {id:'pc_c3',t:'Keep the "Mild" badge, drop the ⓘ',w:'"Mild" is useful at a glance. The ⓘ opens a table of multipliers (Flat under 1.1x … Extreme over 2x) that few people need, and the sentence beside it already says it in plain words.'}],
 mock:function(on,s){var ex=ui(s,'ex','nam');var colk=ui(s,'col','blue');
  var card=function(x){return '<div style="margin-bottom:14px">'+x+'</div>';};
  var label='<div style="display:flex;align-items:baseline;gap:8px"><b style="font-size:19px;letter-spacing:.5px">$$ – $$$$$</b><span class="fa small">daily cost range</span><span style="margin-left:auto;width:20px;height:20px;border:1.5px solid var(--afa);border-radius:50%;display:grid;place-items:center;font-size:11px;color:var(--afa)">i</span></div>';
  var top=card(label+'<p class="dim" style="margin:8px 0 0">Uniquely great as a self-drive trip in a rented camper van, though luxe lodge options exist too for those who want them.</p>');
  var items=card([['☕','Coffee','$2'],['🍺','Windhoek Lager','$3'],['🥩','Game meat dinner','$15'],['🐃','Etosha park entry, per person per day','$18'],['🚙','4x4 rental, self-drive, per day','$100'],['✨','Luxury safari lodge, per person, per night, all inclusive','$900']].map(function(x,i,a){return '<div class="row'+(i===a.length-1?' last':'')+'"><span>'+x[0]+'</span><span class="l" style="font-weight:500;color:var(--adim)">'+x[1]+'</span><b>'+x[2]+'</b></div>';}).join(''));
  var COL={blue:'#3f5fd0',ink:'#6b665f',slate:'#5b6b7f',plum:'#8b72b3'};var col=on('pc_c2')?COL[colk==='blue'?'ink':colk]:COL.blue;if(on('pc_c2')&&colk==='blue')colk='ink';
  var bars=[];for(var w=0;w<52;w++){var mid=w*7+3;var h=(ex==='nam')?((mid>=181&&mid<304)?97:88):(mid>=150&&mid<290?60:(mid>=330||mid<60?100:80));var closed=(ex==='assam'&&w>=24&&w<=36);var faded=(ex==='assam'&&((w>=20&&w<=23)||(w>=37&&w<=40)));
   bars.push(closed?'<i style="flex:1;height:9px;border-radius:1px;background:repeating-linear-gradient(135deg,#8b867d 0 1.5px,transparent 1.5px 4px);opacity:.55"></i>':'<i style="flex:1;height:'+h+'%;background:'+col+';opacity:'+(faded?.38:1)+';border-radius:2px 2px 0 0"></i>');}
  var POS=[15.5,45,74.5,105,135.5,166,196.5,227.5,258,288.5,319,349.5].map(function(d){return d/3.65;});
  var axis='<div style="position:relative;height:16px;margin-top:3px">'+MS.map(function(x,i){return '<span style="position:absolute;left:'+POS[i]+'%;transform:translateX(-50%);font-size:9px;color:var(--afa)">'+x+'</span>';}).join('')+'</div>';
  var badge='<span style="margin-left:auto;font-weight:800;font-size:12.5px">'+(ex==='nam'?'Mild':'High')+'</span>'+(on('pc_c3')?'':'<span style="margin-left:8px;width:20px;height:20px;border:1.5px solid var(--afa);border-radius:50%;display:grid;place-items:center;font-size:11px;color:var(--afa)">i</span>');
  var sentence=ex==='nam'?'Hotel prices are fairly flat, with a slight rise at many hotels from July to October.':'Illustrative: most hotels close in the monsoon weeks (hatched), some close either side of it (faded).';
  var picker='<div class="pills" style="margin:8px 0 2px"><span class="fa small" style="align-self:center">Color</span>'+[['blue','Blue (now)'],['ink','Ink grey'],['slate','Slate'],['plum','Plum']].map(function(x){return pillBtn(s,'col',x[0],x[1],colk===x[0]);}).join('')+'</div><div class="pills" style="margin:2px 0"><span class="fa small" style="align-self:center">Example</span>'+pillBtn(s,'ex','nam','Namibia',ex==='nam')+pillBtn(s,'ex','assam','Hotels close (like Assam)',ex==='assam')+'</div>';
  var hotel=card('<div style="display:flex;align-items:center"><b style="font-size:12.5px">Cost seasonality</b>'+badge+'</div><p style="margin:8px 0">'+sentence+'</p><div style="position:relative;display:flex;align-items:flex-end;gap:1.5px;height:54px;border-bottom:1px solid var(--aln)"><span style="position:absolute;left:0;right:0;bottom:92%;border-top:1px dashed #8b867d"></span>'+bars.join('')+'</div>'+axis+'<div class="fa small" style="text-align:right;margin-top:2px">---- average price</div>'+picker);
  return {body:hdr(on,'COSTS')+'<div style="padding:14px 16px">'+top+items+hotel+'</div>',flush:true};}}
];
"""
out=head+body+tail
out=out.replace("var SHOTS=__SHOTS__;","var SHOTS="+json.dumps(SH)+";")
out=out.replace("db.collection('screensReview')","db.collection('placeCardReview')")
out=out.replace("document.getElementById('builtlist').innerHTML=BUILT_ALL.map(function(x){return '<li>'+x+'</li>';}).join('');\n","")
open('.cache/placecard-interactive.html','w').write(out)
print(len(out)//1024,'KB')
