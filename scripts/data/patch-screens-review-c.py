# 22 Nov 2026: owner's notes: three When options (one a real calendar), Flying from on The basics (mockup first), three Travel DNA switch options, three world-map stamp options, wording and decided items.
p='scripts/data/screens-review-template.html'; t=open(p).read()

# --- decided items
t=t.replace("var DECIDED_NO=['love1','rank1','home2','home3'];","var DECIDED_NO=['love1','rank1','home2','home3','bas4','res2','pc_c1'];\nvar SKIPPED=['bas4','res2','pc_c1'];")
t=t.replace("function on(id){return BUILT.indexOf(id)>=0||P[id]!=='skip';}","function on(id){return SKIPPED.indexOf(id)<0&&(BUILT.indexOf(id)>=0||P[id]!=='skip');}")

# --- data and helpers
helpers = r'''
var MAPP=__MAPPATHS__;var PTS=__PTS__;
var MONTHN=['January','February','March','April','May','June','July','August','September','October','November','December'];
function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t2=Math.imul(a^a>>>15,1|a);t2=t2+Math.imul(t2^t2>>>7,61|t2)^t2;return((t2^t2>>>14)>>>0)/4294967296;};}
var ORDER=(function(){var r=rng(11),a=PTS.map(function(_,i){return i;});for(var i=a.length-1;i>0;i--){var j=Math.floor(r()*(i+1));var x=a[i];a[i]=a[j];a[j]=x;}return a;})();
function px(p){return [(p.lon+180)/360*720,Math.min(280,(84-p.lat)/142*284)];}
'''
t=t.replace("/* ===================== the screens ===================== */",helpers+"/* ===================== the screens ===================== */",1)

# --- WHEN
i=t.index("{id:'when',"); j=t.index("{id:'logi',")
when=r'''{id:'when',name:'When are you going',verdict:'<b>Three smarter ways to pick the dates.</b> Today you pick a month, a length and a week as three separate rows of pills. Each option below turns that into one gesture. Press Keep on the one you like best; the other two stay as ideas. The tabs above the phone switch between them.',
 states:[{id:'a',label:'1 · Calendar',shots:['when']},{id:'b',label:'2 · Trip bar',shots:['when']},{id:'c',label:'3 · Best months',shots:['when']}],
 changes:[
  {id:'wo1',t:'Option 1: a real calendar',w:'Tap a start day and an end day. We work out the month, the week of the month and the trip length from those two taps, and say plainly when the trip runs into the next month (the same 7-day rule as today). A "Just the month for now" switch brings back the simple month grid for people who are flexible.'},
  {id:'wo2',t:'Option 2: a trip bar',w:'Pick a month, then see it as four week blocks in a strip that continues into the following months. Tap the block where you start and choose how long; the bar fills across the blocks, so a 2-week trip that starts late in September visibly spills into October.'},
  {id:'wo3',t:'Option 3: months that show how well they suit you',w:'The month grid, but each month carries a small bar for how well it suits your interests overall, and the best months are starred ("Best for you"). It helps people who are flexible choose with information. Length is one row, and the week is dropped unless you want it. (The bars here are illustrative.)'}],
 mock:function(on,s,st){
  var len=ui(s,'len',null);var LN=[['wk','Long weekend','3 to 4 days'],['1w','1 week',''],['2w','2 weeks',''],['3w','3+ weeks','']];
  function lenSeg(){return '<div class="sg">'+LN.map(function(x){return '<button class="'+(len===x[0]?'sel':'')+'" '+D(s,'len',x[0])+'>'+(x[0]==='wk'?'Long<br>weekend':x[1])+'</button>';}).join('')+'</div>';}
  if(st==='a'){
   var cm=ui(s,'cm',8),cy=ui(s,'cy',2027),a=ui(s,'a',null),b=ui(s,'b',null),flex=ui(s,'flex',false);
   var DAY=864e5;function val(y,m,d){return new Date(y,m,d).getTime();}
   var first=new Date(cy,cm,1).getDay(),dim=new Date(cy,cm+1,0).getDate();
   var cells='';for(var k=0;k<first;k++)cells+='<span></span>';
   for(var d=1;d<=dim;d++){var v=val(cy,cm,d);var isA=a===v,isB=b===v,inr=a&&b&&v>a&&v<b;cells+='<button '+D(s,'pick',v)+' style="height:34px;border-radius:'+(isA||isB?'10px':inr?'0':'10px')+';font-size:13px;text-align:center;'+(isA||isB?'background:var(--ac);color:#fff;font-weight:800':inr?'background:var(--as)':'background:none')+'">'+d+'</button>';}
   var summary='';
   if(a){var da=new Date(a);var txt=MONTHN[da.getMonth()].slice(0,3)+' '+da.getDate();if(b){var db2=new Date(b);var n=Math.round((b-a)/DAY)+1;var lenTxt=n<=4?'a long weekend':n<=9?'1 week':n<=17?'2 weeks':'3+ weeks';var wk=Math.min(4,Math.ceil(da.getDate()/7));txt+=' to '+MONTHN[db2.getMonth()].slice(0,3)+' '+db2.getDate()+' · '+n+' days, '+lenTxt;var next=(db2.getMonth()!==da.getMonth())?db2.getDate():0;summary='<div class="card" style="margin-top:10px;background:var(--as);border-color:var(--ac)"><b>'+txt+'</b><div class="dim small" style="margin-top:3px">Ranked for <b>'+MONTHN[da.getMonth()]+'</b>, week '+wk+'.'+(next>=7?' It also counts '+MONTHN[db2.getMonth()]+' ('+next+' days).':(next>0?' The last '+next+' days in '+MONTHN[db2.getMonth()]+' are too few to count.':''))+'</div></div>';}else{summary='<div class="card" style="margin-top:10px"><b>'+txt+'</b><div class="dim small">Now tap the day you come home.</div></div>';}}
   var cal=flex?'<div class="mg" style="margin-top:6px">'+MONTHS.map(function(x,i){return '<button class="'+(cm===i?'sel':'')+'" '+D(s,'cm',i)+'>'+x+'</button>';}).join('')+'</div><p class="dim small" style="margin:8px 0 0">Flexible: we rank places by the month only.</p>':'<div style="display:flex;align-items:center;justify-content:space-between;margin:2px 0 6px"><button '+D(s,'nav',-1)+' style="font-size:20px;padding:4px 12px">‹</button><b>'+MONTHN[cm]+' '+cy+'</b><button '+D(s,'nav',1)+' style="font-size:20px;padding:4px 12px">›</button></div><div style="display:grid;grid-template-columns:repeat(7,1fr);text-align:center;font-size:11px;color:var(--afa);margin-bottom:2px">'+['S','M','T','W','T','F','S'].map(function(x){return '<span>'+x+'</span>';}).join('')+'</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px 0">'+cells+'</div>'+summary;
   return {body:topbar(60)+'<div style="padding:0 16px"><h3>When are you going?</h3><p class="sub">'+(flex?'Just pick a month.':'Tap the day you leave and the day you come back.')+'</p><div class="card">'+cal+'</div><button class="pill'+(flex?' sel':'')+'" '+D(s,'flex',!flex)+'>Just the month for now</button></div>',foot:btn('Continue',!(flex||a)),flush:true};}
  if(st==='b'){
   var m=ui(s,'m',8),w=ui(s,'w',1),L=ui(s,'len2','2w');var NB={wk:1,'1w':1,'2w':2,'3w':3}[L];
   var months=[m,(m+1)%12,(m+2)%12];var blocks='';
   for(var g=0;g<3;g++){blocks+='<div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:700;margin-bottom:3px;color:'+(g===0?'var(--afg)':'var(--afa)')+'">'+MONTHS[months[g]]+'</div><div style="display:flex;gap:2px">';for(var q=0;q<4;q++){var idx=g*4+q;var inb=idx>=w&&idx<w+NB;blocks+=(g===0?'<button '+D(s,'w',q)+' ':'<span ')+'style="flex:1;height:34px;border-radius:5px;background:'+(inb?'var(--ac)':'#e3ddd4')+';display:block;font-size:9px;color:'+(inb?'#fff':'var(--afa)')+';text-align:center;line-height:34px">'+(q+1)+(g===0?'</button>':'</span>');}blocks+='</div></div>';}
   var endIdx=w+NB-1;var endM=MONTHS[months[Math.min(2,Math.floor(endIdx/4))]];var endW=(endIdx%4)+1;
   var sum='<div class="card" style="background:var(--as);border-color:var(--ac)"><b>Starts '+MONTHS[m]+', week '+(w+1)+' · '+(L==='wk'?'a long weekend':L==='1w'?'1 week':L==='2w'?'2 weeks':'3+ weeks')+'</b><div class="dim small" style="margin-top:3px">Ends around '+endM+', week '+endW+'.'+(endIdx>=4?' It runs into '+endM+'.':'')+' Ranked for <b>'+MONTHN[m]+'</b>'+(endIdx>=4?' and '+MONTHN[months[1]]+'.':'.')+'</div></div>';
   return {body:topbar(60)+'<div style="padding:0 16px"><h3>When are you going?</h3><p class="sub">Pick the month, then tap the week you start.</p><div style="display:flex;gap:7px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none">'+MONTHS.map(function(x,i){return '<button class="pill'+(m===i?' sel':'')+'" style="flex:none" '+D(s,'m',i)+'>'+x+'</button>';}).join('')+'</div><div class="card" style="margin-top:8px"><div class="lab" style="margin:0 0 6px">Your trip</div><div style="display:flex;gap:8px">'+blocks+'</div></div><div class="lab">How long</div><div class="sg">'+LN.map(function(x){return '<button class="'+(L===x[0]?'sel':'')+'" '+D(s,'len2',x[0])+'>'+(x[0]==='wk'?'Long<br>weekend':x[1])+'</button>';}).join('')+'</div><div style="margin-top:12px">'+sum+'</div></div>',foot:btn('Continue'),flush:true};}
  var m3=ui(s,'m3',null);var SCORE=[5.2,5.4,5.9,6.4,7.0,7.5,7.7,7.6,7.2,6.6,5.8,5.3];var best=SCORE.map(function(v,i){return [v,i];}).sort(function(x,y){return y[0]-x[0];}).slice(0,3).map(function(x){return x[1];});
  var tiles=MONTHS.map(function(x,i){var sel=m3===i;return '<button '+D(s,'m3',i)+' style="position:relative;border:1.5px solid '+(sel?'var(--ac)':'var(--aln)')+';background:'+(sel?'var(--as)':'#fff')+';border-radius:11px;padding:8px 0 7px;text-align:center"><div style="font-weight:'+(sel?800:600)+';font-size:13.5px">'+x+(best.indexOf(i)>=0?' <span style="color:var(--ac)">★</span>':'')+'</div><div style="height:5px;margin:6px 10px 0;border-radius:3px;background:#ece7df;overflow:hidden"><i style="display:block;height:100%;width:'+(SCORE[i]*10)+'%;background:'+colr(SCORE[i])+'"></i></div></button>';}).join('');
  return {body:topbar(60)+'<div style="padding:0 16px"><h3>When are you going?</h3><p class="sub">Months that suit your interests best are starred.</p><div class="card"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px">'+tiles+'</div><p class="dim small" style="margin:10px 0 0">★ Best for you: '+best.slice().sort(function(a2,b2){return a2-b2;}).map(function(i){return MONTHN[i];}).join(', ')+'</p></div><div class="card"><h4>How long?</h4><p>Optional.</p>'+lenSeg()+'</div></div>',foot:btn('Continue',m3===null),flush:true};}},

'''
t=t[:i]+when+t[j:]

# --- LOGI -> Flying from on the basics
i=t.index("{id:'logi',"); j=t.index("{id:'bas',")
logi=r'''{id:'logi',name:'Getting there',verdict:'<b>The mockup you asked for.</b> "Getting there" is a whole screen for one optional question (where you fly from). The proposal: delete that screen and put the same question on The basics as one more row, so the path is one step shorter. The phone shows The basics with the new row open. Tap the rows.',
 states:[{id:'a',label:'The basics, with Flying from',shots:['logi','bas1']}],
 changes:[
  {id:'logi1',t:'Remove "Getting there" and add a "Flying from" row to The basics',w:'Same two dropdowns (country, then state or region), in a row that opens on tap. It sits just under "Where in the world" because both are about distance. The screen and its progress step disappear. It is optional, as now, and the trip settings still have it.'}],
 mock:function(on,s){
  if(ui(s,'op',null)===null)setui(s,'op',['from']);var op=ui(s,'op',[]);var from=ui(s,'from',null);
  function row(key,label,val,body){var o=op.indexOf(key)>=0;return '<div class="card" style="padding:4px 14px 6px'+(key==='from'&&o?';border-color:var(--ac)':'')+'"><button style="display:flex;width:100%;align-items:center;padding:10px 0" '+T(s,'op',key)+'><b style="flex:1;font-size:14.5px">'+label+(key==='from'?' <span class="small" style="color:var(--ac);font-weight:700">new</span>':'')+'</b><span class="v">'+val+' '+(o?'⌃':'›')+'</span></button>'+(o&&body?body:'')+'</div>';}
  var fromBody='<div style="padding:2px 0 10px"><div class="small dim" style="margin-bottom:8px">Used to rank far-away places lower when the trip is short.</div><div class="card" style="margin:0 0 8px;padding:10px 12px;display:flex"><span style="flex:1">United States</span><span class="fa">▾</span></div><button class="card" style="margin:0;padding:10px 12px;display:flex;width:100%" '+D(s,'from','Colorado, United States')+'><span style="flex:1;color:'+(from?'var(--afg)':'var(--afa)')+'">'+(from?'Colorado':'Choose your state')+'</span><span class="fa">▾</span></button></div>';
  return {body:topbar(90)+'<div style="padding:0 16px"><h3>The basics</h3><p class="sub">A few taps. Your shortlist appears right after.</p>'+row('b','Budget &amp; comfort','Any')+row('c','Climate','Any')+row('w','Where in the world','Anywhere')+row('from','Flying from',from||'Not set',fromBody)+row('p','Crowds &amp; prices','In between')+row('who','Who’s going','Anyone')+row('care','What else matters','Optional')+row('k','What kind of place','Any')+'</div>',foot:btn('Show my places'),flush:true};}},

'''
t=t[:i]+logi+t[j:]

# --- wording: Who's going
t=t.replace("opt('who','Who is going','Anyone',W)","opt('who','Who’s going','Anyone',W)").replace("'<div class=\"card\"><h4>Who is going?</h4>","'<div class=\"card\"><h4>Who’s going?</h4>")
t=t.replace("Who is going drops from the top","Who’s going drops from the top").replace("Crowds & prices (5), Who is going (3)","Crowds & prices (5), Who’s going (3)")
t=t.replace("<b>The most important screen, and the one with most to gain.</b>","<b>Parked: we will do a deeper dive here later.</b> The most important screen, and the one with most to gain.")

# --- DNA options
i=t.index("{id:'dna',"); j=t.index("{id:'sw',")
dna=r'''{id:'dna',name:'Travel DNA page: the switches',verdict:'<b>Rethinking this one.</b> Each row on the page has a switch that means "keep this for my next trips", but nothing says so, and the line beside it says "No preference", so it looks like the switch controls the preference. Three ways to say it. Pick one with Keep.',
 states:[{id:'a',label:'A · "Keep" label',shots:['dna2']},{id:'b',label:'B · Every trip / This trip',shots:['dna2']},{id:'c',label:'C · Two groups',shots:['dna2']}],
 changes:[
  {id:'dnaA',t:'Option A: keep the switches, add a "Keep" label under each',w:'The smallest change. Same switches, one word of explanation, and "No preference" becomes "Any".'},
  {id:'dnaB',t:'Option B: replace the switch with a tag, "Every trip" or "This trip"',w:'Each row shows which kind it is, and tapping the tag flips it. No on/off to decode, and the words are the meaning.'},
  {id:'dnaC',t:'Option C: two groups, and the choice moves inside the row',w:'The page is split into "Saved for every trip" and "This trip only". Tap a row to edit it, and a two-way control inside says which group it lives in. The collapsed rows are quiet, with no switches at all.'}],
 mock:function(on,s,st){
  var R=[['💳','Budget & comfort','Any'],['🌡️','Climate','Warm, Hot'],['🎭','Social vibe','Any'],['👥','Who’s going','Solo'],['🏠','Where you live','Colorado, United States']];var DEF=[true,false,true,false,true];
  function kept(i){return ui(s,'k'+i,DEF[i]);}
  var head='<div style="padding:0 16px"><h3 style="font-size:21px">Your Travel DNA</h3><p class="small dim" style="margin:0 0 10px">'+(st==='c'?'Tap a row to edit it or change where it is saved.':'What we use now, and what carries over to your next trips.')+'</p>';
  var anyTxt=function(v){return v;};
  if(st==='a'){var h=R.map(function(r,i){var k=kept(i);return '<div class="card" style="display:flex;align-items:center;gap:10px;opacity:'+(k?1:.7)+'"><span style="font-size:20px">'+r[0]+'</span><div style="flex:1"><b>'+r[1]+'</b><div class="dim small">'+r[2]+'</div></div><div style="text-align:center"><button class="tg" style="display:block;background:'+(k?'var(--ac)':'#cfc6ba')+'" '+D(s,'k'+i,!k)+'><span style="position:absolute;top:3px;'+(k?'right:3px':'left:3px')+';width:20px;height:20px;border-radius:50%;background:#fff"></span></button><div class="small fa" style="margin-top:2px">Keep</div></div></div>';}).join('');return {body:topbar(100)+head+h+'</div>',foot:btn('Save my Travel DNA')+'<div class="lnk">Preview my places</div>',flush:true};}
  if(st==='b'){var hb=R.map(function(r,i){var k=kept(i);return '<div class="card" style="display:flex;align-items:center;gap:10px"><span style="font-size:20px">'+r[0]+'</span><div style="flex:1"><b>'+r[1]+'</b><div class="dim small">'+r[2]+'</div></div><button '+D(s,'k'+i,!k)+' style="border-radius:99px;padding:4px 11px;font-size:12px;font-weight:700;'+(k?'background:var(--as);color:var(--ac);border:1px solid var(--ac)':'background:#ece7df;color:var(--adim);border:1px solid transparent')+'">'+(k?'Every trip':'This trip')+'</button></div>';}).join('');return {body:topbar(100)+head+hb+'<p class="small fa" style="margin:6px 2px">Tap a tag to change it.</p></div>',foot:btn('Save my Travel DNA')+'<div class="lnk">Preview my places</div>',flush:true};}
  var op=ui(s,'op',[]);function grp(title,sub,idxs){if(!idxs.length)return '';return '<div class="lab" style="margin:12px 0 6px;color:var(--ac)">'+title+'</div><p class="small fa" style="margin:-2px 0 6px">'+sub+'</p>'+idxs.map(function(i){var r=R[i],o=op.indexOf(i)>=0;return '<div class="card" style="padding:4px 14px"><button style="display:flex;width:100%;align-items:center;gap:10px;padding:9px 0" '+T(s,'op',i)+'><span style="font-size:20px">'+r[0]+'</span><div style="flex:1"><b>'+r[1]+'</b><div class="dim small">'+r[2]+'</div></div><span class="v">'+(o?'⌃':'▾')+'</span></button>'+(o?'<div style="padding:2px 0 10px"><div class="sg" style="grid-template-columns:1fr 1fr"><button class="'+(kept(i)?'sel':'')+'" '+D(s,'k'+i,true)+'>Every trip</button><button class="'+(!kept(i)?'sel':'')+'" '+D(s,'k'+i,false)+'>This trip only</button></div></div>':'')+'</div>';}).join('');}
  var ev=[],tr=[];R.forEach(function(_,i){(kept(i)?ev:tr).push(i);});
  return {body:topbar(100)+head+grp('Saved for every trip','These come with you to your next trips.',ev)+grp('This trip only','These are forgotten after this trip.',tr)+'</div>',foot:btn('Save my Travel DNA')+'<div class="lnk">Preview my places</div>',flush:true};}},

'''
t=t[:i]+dna+t[j:]

# --- STAMPS: three world maps
i=t.index("{id:'stamps',"); j=t.index("{id:'home',")
stamps=r'''{id:'stamps',name:'My Stamps: world map',verdict:'<b>Three world maps that fill in as you collect stamps.</b> They keep the passport paper and the texture. Use the chips on the phone to jump from 0 stamps to 120 and watch each one fill. Tap a dot or stamp to see the place. Pick one with Keep. (Which places are collected here is random, just for the demo.)',
 states:[{id:'a',label:'A · Continents fill in',shots:['stamps']},{id:'b',label:'B · Dots become stamps',shots:['stamps']},{id:'c',label:'C · Stamps on the map',shots:['stamps']}],
 changes:[
  {id:'sm1',t:'Map A: the six continents fill in',w:'Each continent shades deeper as you collect there, with "3 of 17" on it. Simple and calm, and it matches the six regions already used on The basics. It is less precise: a stamp in Kenya and one in Egypt look the same.'},
  {id:'sm2',t:'Map B: all 200 places as dots that turn into stamps',w:'Every place is a small dot on a pale world map. Collect one and its dot grows and darkens. You can see what is left to visit, and the map slowly fills with ink. Tap a dot for the name.'},
  {id:'sm3',t:'Map C: real stamps land on the map',w:'The most passport-like: each place you mark visited gets its own rubber stamp (its emoji in an inked ring, slightly rotated) pressed onto the map, and places still to visit are faint pins. The most charming, and the busiest once you have many.'}],
 mock:function(on,s,st){
  var n=ui(s,'n',25),sel=ui(s,'sel',null),zoom=ui(s,'zoom',false);
  var vis={};for(var q=0;q<n&&q<ORDER.length;q++)vis[ORDER[q]]=true;
  var tot={},got={};PTS.forEach(function(p,i){var r=p.r||'ant';tot[r]=(tot[r]||0)+1;if(vis[i])got[r]=(got[r]||0)+1;});
  var NAME={na:'North America',csa:'Central & South America',eu:'Europe',af:'Africa',as:'Asia',oc:'Australia & Pacific'};
  var LAND='#e3dcc4',INK='#2f5a63';
  var svg='';
  if(st==='a'){var CEN={na:[160,78],csa:[225,190],eu:[372,58],af:[372,152],as:[535,84],oc:[612,212]};
   Object.keys(MAPP).forEach(function(k){var sh=(got[k]||0)/tot[k];svg+='<path d="'+MAPP[k]+'" fill="'+INK+'" fill-opacity="'+(0.12+0.78*sh).toFixed(2)+'" stroke="#f3eedc" stroke-width="0.8"/>';});
   Object.keys(CEN).forEach(function(k){svg+='<text x="'+CEN[k][0]+'" y="'+CEN[k][1]+'" text-anchor="middle" font-size="19" font-weight="800" font-family="ui-monospace,Menlo,monospace" fill="'+((got[k]||0)/tot[k]>0.45?'#fff':INK)+'">'+(got[k]||0)+'/'+tot[k]+'</text>';});}
  else{Object.keys(MAPP).forEach(function(k){svg+='<path d="'+MAPP[k]+'" fill="'+LAND+'" stroke="'+(st==='c'?'#b9b196':'none')+'" stroke-width="0.7"/>';});
   if(st==='b'){PTS.forEach(function(p,i){var c=px(p);svg+=vis[i]?'<circle data-a="ui" data-s="'+s+'" data-k="sel" data-v="'+i+'" cx="'+c[0].toFixed(1)+'" cy="'+c[1].toFixed(1)+'" r="6" fill="'+INK+'" stroke="#f3eedc" stroke-width="1.4"/>':'<circle data-a="ui" data-s="'+s+'" data-k="sel" data-v="'+i+'" cx="'+c[0].toFixed(1)+'" cy="'+c[1].toFixed(1)+'" r="2.8" fill="#a79e84"/>';});}
   else{var INKS=['#2f5a63','#9b3d3d','#3c6e47','#5b4a8a'];var rr=rng(5);PTS.forEach(function(p,i){var c=px(p);if(!vis[i]){svg+='<circle data-a="ui" data-s="'+s+'" data-k="sel" data-v="'+i+'" cx="'+c[0].toFixed(1)+'" cy="'+c[1].toFixed(1)+'" r="1.9" fill="#a79e84"/>';return;}var col=INKS[i%4],rot=Math.round(rr()*50-25);svg+='<g data-a="ui" data-s="'+s+'" data-k="sel" data-v="'+i+'" transform="translate('+c[0].toFixed(1)+' '+c[1].toFixed(1)+') rotate('+rot+')"><circle r="13" fill="#f3eedc" fill-opacity=".55" stroke="'+col+'" stroke-width="1.8"/><circle r="9.5" fill="none" stroke="'+col+'" stroke-width=".9"/><text y="5" text-anchor="middle" font-size="13">'+p.e+'</text></g>';});}}
  var W=zoom?'200%':'100%';
  var map='<div style="overflow-x:auto;border-radius:14px;border:1px solid #d9d2b8;background:#f8f4e6"><svg viewBox="0 0 720 284" style="display:block;width:'+W+';min-width:100%;height:auto">'+svg+'</svg></div>';
  var chips='<div class="pills" style="margin:10px 0 4px"><span class="fa small" style="align-self:center">Stamps</span>'+[0,8,25,60,120].map(function(x){return '<button class="pill'+(n===x?' out':'')+'" '+D(s,'n',x)+'>'+x+'</button>';}).join('')+(st!=='a'?'<button class="pill'+(zoom?' out':'')+'" '+D(s,'zoom',!zoom)+'>🔍 Zoom</button>':'')+'</div>';
  var selTxt=(sel!==null&&st!=='a')?'<div class="small" style="margin:4px 0"><b>'+PTS[sel].e+' '+PTS[sel].n+'</b> · '+(vis[sel]?'collected':'not yet')+'</div>':'';
  var counts='<div class="small dim" style="margin-top:6px;line-height:1.6">'+Object.keys(NAME).map(function(k){return NAME[k]+' '+(got[k]||0)+' of '+tot[k];}).join(' · ')+'</div>';
  return {body:'<div class="paperbg"><div style="padding:16px 16px 8px"><div style="display:flex;align-items:center"><div style="flex:1"><div style="font:800 21px ui-monospace,Menlo,monospace;letter-spacing:.14em;color:#2f5a63">MY STAMPS</div><div class="dim" style="font-family:ui-monospace,Menlo,monospace">'+n+' of 200 collected</div></div><span style="width:30px;height:30px;border-radius:50%;background:#fff;display:grid;place-items:center">×</span></div></div><div style="padding:0 16px 24px">'+map+chips+selTxt+(st==='a'?'':counts)+'<div class="sg" style="grid-template-columns:1fr 1fr;margin:12px 0 4px;background:#e3dcc7"><button class="sel">Collected</button><button>All destinations</button></div></div></div>',foot:null,flush:true};}},

'''
t=t[:i]+stamps+t[j:]

# navigation helper for the calendar: nav and pick actions
t=t.replace("else if(a==='ui'){var v=t.dataset.v;","else if(a==='ui'&&t.dataset.k==='nav'){var cm0=ui(s,'cm',8),cy0=ui(s,'cy',2027),dlt=+t.dataset.v;cm0+=dlt;if(cm0<0){cm0=11;cy0--;}if(cm0>11){cm0=0;cy0++;}setui(s,'cm',cm0);setui(s,'cy',cy0);refresh(sc);}\n else if(a==='ui'&&t.dataset.k==='pick'){var tv=+t.dataset.v,a0=ui(s,'a',null),b0=ui(s,'b',null);if(!a0||(a0&&b0)){setui(s,'a',tv);setui(s,'b',null);}else if(tv<a0){setui(s,'a',tv);}else{setui(s,'b',tv);}refresh(sc);}\n else if(a==='ui'){var v=t.dataset.v;")
open(p,'w').write(t); print('ok')
