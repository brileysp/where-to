# 23 Nov 2026 (later): Flying from built; When as three versions of stacked weeks; DNA page rethought (no trip rows, no switches); stamps as pins only for places visited.
p='scripts/data/screens-review-template.html'; t=open(p).read()
t=t.replace("var BUILT=['bas1',","var BUILT=['logi1','bas1',",1)

# ---------------- WHEN: three versions of stacked weeks
i=t.index("{id:'when',"); j=t.index("{id:'logi',")
when=r'''{id:'when',name:'When are you going',verdict:'<b>Three cleaner versions of the stacked weeks.</b> Same idea you liked: the month as real weeks (Monday to Sunday, with a short week where the month starts or ends mid-week), no exact dates. Each version drops the extra boxes and keeps one sentence of summary. Pick one with Keep.',
 states:[{id:'a',label:'A · Week rows',shots:['when']},{id:'b',label:'B · Week bars',shots:['when']},{id:'c',label:'C · One week at a time',shots:['when']}],
 changes:[
  {id:'wv1',t:'Version A: week rows',w:'The stacked weeks, tidied. Seven soft cells per week, the days outside the month left empty, a small month name above, and one line under the chart saying what you picked ("Sep 6, about 2 weeks"). No header letters, no card around it.'},
  {id:'wv2',t:'Version B: week bars',w:'Each week is one rounded bar placed where it really falls in the week, so a short first or last week is a short bar. Cleaner than seven cells, and the shape is the point. Tap a bar to start there; the bars below fill for the length.'},
  {id:'wv3',t:'Version C: one week at a time',w:'The simplest: one big control that says "Week of Sep 6" with arrows to step forward or back, and a small calendar-shaped picture of that week and the month beside it. Fewer things on screen, but you cannot see the whole month at once.'}],
 mock:function(on,s,st){
  var CY=2027;var len=ui(s,'len','2w');var LN=[['wk','Long weekend'],['1w','1 week'],['2w','2 weeks'],['3w','3+ weeks']];
  var NB={wk:1,'1w':1,'2w':2,'3w':3}[len];var DAYS={wk:4,'1w':7,'2w':14,'3w':21}[len];
  function segs(y,m){var dim=new Date(y,m+1,0).getDate(),out=[],cur=null;for(var d=1;d<=dim;d++){var wd=new Date(y,m,d).getDay();if(!cur||wd===1){cur={d1:d,d2:d,m:m,y:y};out.push(cur);}else cur.d2=d;}return out;}
  function lenSeg(){return '<div class="sg" style="margin-top:12px">'+LN.map(function(x){return '<button class="'+(len===x[0]?'sel':'')+'" '+D(s,'len',x[0])+'>'+(x[0]==='wk'?'Long<br>weekend':x[1])+'</button>';}).join('')+'</div>';}
  function lenTxt(){return len==='wk'?'a long weekend':len==='1w'?'1 week':len==='2w'?'2 weeks':'3 weeks or more';}
  var mm=ui(s,'mm',8);var S=segs(CY,mm);var sr=ui(s,'sr',1);if(sr>=S.length)sr=0;var seg=S[sr];
  function endInfo(){var a=new Date(seg.y,seg.m,seg.d1);var e=new Date(a.getTime()+(DAYS-1)*864e5);return {txt:MONTHN[e.getMonth()].slice(0,3)+' '+e.getDate(),next:e.getMonth()!==seg.m};}
  var e=endInfo();
  var sum='<p style="margin:12px 2px 0;font-size:14px"><b>'+MONTHN[mm].slice(0,3)+' '+seg.d1+'</b>, '+lenTxt()+' · to about '+e.txt+(e.next||sr+NB>S.length?'. Runs into '+MONTHN[(mm+1)%12]+'.':'')+'</p>';
  var months='<div style="display:flex;gap:7px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none">'+MONTHS.map(function(x,i){return '<button class="pill'+(mm===i?' sel':'')+'" style="flex:none" '+D(s,'mm',i)+'>'+x+'</button>';}).join('')+'</div>';
  var head='<h3>When are you going?</h3><p class="sub">Pick the month, then the week you start.</p>'+months;
  if(st==='a'){
   var rows=S.map(function(x,i){var inr=i>=sr&&i<sr+NB;var first=new Date(CY,mm,x.d1).getDay();var off=(first+6)%7;var cells='';for(var c=0;c<7;c++){var bel=(c>=off&&c<off+(x.d2-x.d1+1));cells+='<span style="height:30px;border-radius:8px;background:'+(bel?(inr?'var(--ac)':'#ddd5c6'):'transparent')+'"></span>';}return '<button '+D(s,'sr',i)+' style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;width:100%;margin-bottom:5px">'+cells+'</button>';}).join('');
   return {body:topbar(60)+'<div style="padding:0 16px">'+head+'<div style="margin-top:10px"><div class="small fa" style="margin:0 0 6px 2px">'+MONTHN[mm]+' '+CY+'</div>'+rows+'</div>'+lenSeg()+sum+'</div>',foot:btn('Continue'),flush:true};}
  if(st==='b'){
   var bars=S.map(function(x,i){var inr=i>=sr&&i<sr+NB;var first=new Date(CY,mm,x.d1).getDay();var off=(first+6)%7;var n=x.d2-x.d1+1;return '<button '+D(s,'sr',i)+' style="position:relative;display:block;width:100%;height:34px;margin-bottom:6px;border-radius:10px;background:#f1ede6"><span style="position:absolute;top:0;bottom:0;left:'+(off/7*100)+'%;width:'+(n/7*100)+'%;border-radius:10px;background:'+(inr?'var(--ac)':'#d9d0bd')+';color:'+(inr?'#fff':'var(--adim)')+';font-size:12px;line-height:34px;text-align:left;padding-left:10px;white-space:nowrap">'+MONTHN[mm].slice(0,3)+' '+x.d1+(n<7?' · '+n+' days':'')+'</span></button>';}).join('');
   return {body:topbar(60)+'<div style="padding:0 16px">'+head+'<div style="margin-top:12px">'+bars+'</div>'+lenSeg()+sum+'</div>',foot:btn('Continue'),flush:true};}
  var mini=S.map(function(x,i){var first=new Date(CY,mm,x.d1).getDay();var off=(first+6)%7;var cells='';for(var c=0;c<7;c++){var bel=(c>=off&&c<off+(x.d2-x.d1+1));cells+='<span style="height:9px;border-radius:3px;background:'+(bel?(i>=sr&&i<sr+NB?'var(--ac)':'#ddd5c6'):'transparent')+'"></span>';}return '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:3px">'+cells+'</div>';}).join('');
  return {body:topbar(60)+'<div style="padding:0 16px">'+head+'<div class="card" style="margin-top:12px;display:flex;align-items:center;gap:14px"><button '+D(s,'sr',(sr+S.length-1)%S.length)+' style="font-size:24px;padding:6px 10px">‹</button><div style="flex:1;text-align:center"><div class="small fa">Starting the week of</div><div style="font-size:24px;font-weight:800">'+MONTHN[mm].slice(0,3)+' '+seg.d1+'</div></div><button '+D(s,'sr',(sr+1)%S.length)+' style="font-size:24px;padding:6px 10px">›</button></div><div style="width:110px;margin:12px auto 0">'+mini+'</div>'+lenSeg()+sum+'</div>',foot:btn('Continue'),flush:true};}},

'''
t=t[:i]+when+t[j:]

# ---------------- DNA: rethought
i=t.index("{id:'dna',"); j=t.index("{id:'sw',")
dna=r'''{id:'dna',name:'Travel DNA page: just you',verdict:'<b>Your question is the right one.</b> Today the page does have a "this trip" part, but only when you open it from a trip (Manage DNA on the list): it adds a "This trip only" group, a switch on every row, and edits that change the list you are looking at right away. That mixes you with the trip. The rethink: the Travel DNA page is only about you (interests, the lasting preferences, who you usually travel with, where you live). Anything that belongs to one trip lives in the trip sheet, which already holds each trip\'s own choices over your defaults. The switches go away.',
 states:[{id:'a',label:'The page',shots:['dna2']},{id:'b',label:'Trip sheet: save as default',shots:['tripset']}],
 changes:[
  {id:'dnaD',t:'The Travel DNA page is only you: no trip rows, no switches',w:'Removes "This trip only", every keep switch, and the "Who is going this time" and dates rows from the page. What stays: interests and their levels, budget and comfort, what matters when you choose, who you usually travel with, where you live, your photo picks and taste answers. Each row just shows its value and edits in place.'},
  {id:'dnaE',t:'In the trip sheet, a quiet "Make this my default" under a choice',w:'The only job the switches did well was carrying a trip choice over to every trip. This does it where the choice is made: change Budget in the trip sheet and a small link offers to save it to your Travel DNA. Optional; skip it and the trip simply keeps its own value.'}],
 mock:function(on,s,st){
  var R=[['💳','Budget & comfort','Any'],['🎭','Social vibe','Any'],['👨‍👩‍👧','Who you usually travel with','Solo, With a spouse or partner'],['🏠','Where you live','Colorado, United States']];
  if(st==='b'){var saved=ui(s,'saved',false);return {body:'<div style="padding:12px 16px;font-weight:800">My September 2027 trip ▾</div><div style="padding:8px 16px"><div class="place"><b>#1 Namibia</b></div></div>',foot:null,over:'<div class="sheetbg"><div class="sheet"><div class="sc2"><h3 style="margin:0 0 8px;font-size:20px">My September 2027 trip</h3><div class="card" style="padding:4px 14px 10px"><div class="row last"><span class="l">Budget &amp; comfort</span><span class="v o" style="color:var(--ac);font-weight:700">Comfortable</span></div><div class="pills" style="margin:0 0 8px">'+['Basic / Budget','Comfortable','High-End','Luxury'].map(function(x){return '<span class="pill'+(x==='Comfortable'?' sel':'')+'">'+x+'</span>';}).join('')+'</div>'+(saved?'<div class="small" style="color:var(--agood);font-weight:700">✓ Saved to your Travel DNA</div>':'<button class="small" '+D(s,'saved',true)+' style="color:var(--ac);text-decoration:underline">Make this my default</button>')+'</div><div class="row"><span class="l">Climate</span><span class="v">Any ›</span></div><div class="row"><span class="l">Who’s going</span><span class="v">Anyone ›</span></div></div><div class="btn" style="margin-top:8px">Show 200 places</div></div></div>'};}
  var op=ui(s,'op',[]);var cards=R.map(function(r,i){var o=op.indexOf(i)>=0;return '<div class="card" style="padding:4px 14px"><button style="display:flex;width:100%;align-items:center;gap:10px;padding:9px 0" '+T(s,'op',i)+'><span style="font-size:20px">'+r[0]+'</span><div style="flex:1"><b>'+r[1]+'</b><div class="dim small">'+r[2]+'</div></div><span class="v">'+(o?'⌃':'▾')+'</span></button>'+(o?'<div class="pills" style="padding:2px 0 10px">'+['Option one','Option two','Option three'].map(function(x){return '<span class="pill">'+x+'</span>';}).join('')+'</div>':'')+'</div>';}).join('');
  var ints=[['🏔️','Scenic Landscapes','Like'],['🐾','Wildlife Viewing','Love'],['✨','Stargazing','Like']].map(function(x,n){return '<div class="row'+(n===2?' last':'')+'" style="padding:11px 0"><span style="font-size:19px">'+x[0]+'</span><b style="flex:1;font-size:13.5px">'+x[1]+'</b><span class="small dim">'+x[2]+'</span><span class="lvl">'+[0,1,2,3].map(function(k){return '<i class="'+(k<=(x[2]==='Love'?2:1)?'o':'')+'"></i>';}).join('')+'</span></div>';}).join('');
  return {body:topbar(100)+'<div style="padding:0 16px"><h3 style="font-size:21px">Your Travel DNA</h3><p class="small dim" style="margin:0 0 10px">Just you. What we start from for every trip.</p><div class="card" style="padding:4px 14px">'+ints+'</div>'+cards+'</div>',foot:btn('Save my Travel DNA')+'<div class="lnk">Preview my places</div>',flush:true};}},

'''
t=t[:i]+dna+t[j:]

# ---------------- STAMPS: pins only for visited places
i=t.index("{id:'stamps',"); j=t.index("{id:'home',")
stamps=r'''{id:'stamps',name:'My Stamps: pins on the map',verdict:'<b>A pin for each place you have been, and nothing on the map before that.</b> An empty map to start, and every place you mark visited drops a pin. Three pin looks. Use the chips on the phone to go from 0 stamps to 120 and watch it fill. Tap a pin for the place. (Which places are collected is random, just for the demo.)',
 states:[{id:'a',label:'A · Simple pins',shots:['stamps']},{id:'b',label:'B · Emoji pins',shots:['stamps']},{id:'c',label:'C · Pins with names',shots:['stamps']}],
 changes:[
  {id:'sp1',t:'Look A: simple pins',w:'One small terracotta pin per place, on a pale passport-paper map. The calmest and the clearest at a glance.'},
  {id:'sp2',t:'Look B: emoji pins',w:'Each pin carries the place\'s own emoji in a white head, so you can read the map by symbol. More personality, a little busier.'},
  {id:'sp3',t:'Look C: pins with names',w:'Small pins with the place name beside them while there are few; with many, the names hide and tap shows them. The most informative early on.'}],
 mock:function(on,s,st){
  var n=ui(s,'n',25),sel=ui(s,'sel',null),zoom=ui(s,'zoom',false);
  var vis={};for(var q=0;q<n&&q<ORDER.length;q++)vis[ORDER[q]]=true;
  var LAND='#e6dfc8';var svg='';Object.keys(MAPP).forEach(function(k){svg+='<path d="'+MAPP[k]+'" fill="'+LAND+'" stroke="#cfc6a8" stroke-width="0.6" stroke-linejoin="round"/>';});
  var PIN='M0,0 C-4,-7 -8,-10 -8,-15 A8,8 0 1 1 8,-15 C8,-10 4,-7 0,0Z';
  var many=n>30;var vi=0;
  PTS.forEach(function(p,i){if(!vis[i])return;var c=px(p);var isel=sel===i;var g='<g data-a="ui" data-s="'+s+'" data-k="sel" data-v="'+i+'" transform="translate('+c[0].toFixed(1)+' '+c[1].toFixed(1)+')'+(isel?' scale(1.35)':'')+'" style="cursor:pointer">';
   if(st==='b'){g+='<path d="'+PIN+'" fill="#b9693c" stroke="#fff" stroke-width="1.2"/><circle cx="0" cy="-15" r="6.3" fill="#fff"/><text y="-11.3" text-anchor="middle" font-size="9.5">'+p.e+'</text>';}
   else{g+='<path d="'+PIN+'" fill="#b9693c" stroke="#fff" stroke-width="1.2"/><circle cx="0" cy="-15" r="3" fill="#fff"/>';}
   if(st==='c'&&(!many||isel)){g+='<text x="10" y="-12" font-size="11" font-weight="700" fill="#2b2622" stroke="#f8f4e6" stroke-width="3" paint-order="stroke" font-family="system-ui,sans-serif">'+p.n+'</text>';}
   g+='</g>';svg+=g;vi++;});
  var W=zoom?'220%':'100%';
  var map='<div style="overflow-x:auto;border-radius:14px;border:1px solid #d9d2b8;background:#f8f4e6"><svg viewBox="0 0 720 284" style="display:block;width:'+W+';min-width:100%;height:auto">'+svg+'</svg></div>';
  var chips='<div class="pills" style="margin:10px 0 4px"><span class="fa small" style="align-self:center">Stamps</span>'+[0,8,25,60,120].map(function(x){return '<button class="pill'+(n===x?' out':'')+'" '+D(s,'n',x)+'>'+x+'</button>';}).join('')+'<button class="pill'+(zoom?' out':'')+'" '+D(s,'zoom',!zoom)+'>🔍 Zoom</button></div>';
  var selTxt=(sel!==null&&vis[sel])?'<div class="small" style="margin:4px 0"><b>'+PTS[sel].e+' '+PTS[sel].n+'</b></div>':(n===0?'<div class="small dim" style="margin:4px 0">Nothing yet. Mark a place visited and its pin lands here.</div>':'');
  return {body:'<div class="paperbg"><div style="padding:16px 16px 8px"><div style="display:flex;align-items:center"><div style="flex:1"><div style="font:800 21px ui-monospace,Menlo,monospace;letter-spacing:.14em;color:#2f5a63">MY STAMPS</div><div class="dim" style="font-family:ui-monospace,Menlo,monospace">'+n+' of 200 collected</div></div><span style="width:30px;height:30px;border-radius:50%;background:#fff;display:grid;place-items:center">×</span></div></div><div style="padding:0 16px 24px">'+map+chips+selTxt+'<div class="sg" style="grid-template-columns:1fr 1fr;margin:12px 0 4px;background:#e3dcc7"><button class="sel">Collected</button><button>All destinations</button></div></div></div>',foot:null,flush:true};}},

'''
t=t[:i]+stamps+t[j:]
open(p,'w').write(t); print('ok')
