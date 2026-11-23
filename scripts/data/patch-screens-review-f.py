# 23 Nov 2026 (later): When = month, then how long, then a calm week choice (3 versions); DNA page = baseline with add interests / add a preference; stamps = small red round-head pushpins, nothing else.
p='scripts/data/screens-review-template.html'; t=open(p).read()

# ---------------- WHEN
i=t.index("{id:'when',"); j=t.index("{id:'logi',")
when=r'''{id:'when',name:'When are you going',verdict:'<b>Month, then how long, then a calm way to pick the week.</b> How long now comes before the week, so the week choice already knows how many weeks to fill. All three start from "Any week" (the default for people who do not know yet), have no cards or banners, and show only one quiet line of summary. They sit between the big week rows and the one-week-at-a-time stepper. Pick one with Keep.',
 states:[{id:'a',label:'A · Week chips',shots:['when']},{id:'b',label:'B · One month bar',shots:['when']},{id:'c',label:'C · Early, middle, late',shots:['when']}],
 changes:[
  {id:'wv4',t:'Version A: a row of week chips',w:'Below "How long", one wrapping row of small pills: "Any week", then one pill per real week of the month ("6–12"). A short first or last week is just a shorter range. Tap one and the chosen length fills forward.'},
  {id:'wv5',t:'Version B: the month as one bar of week slices',w:'A single slim bar for the month cut into its real weeks (short weeks are short slices). Tap a slice to start there and the length fills forward. "Any week" is a quiet switch above it. The most visual, still small.'},
  {id:'wv6',t:'Version C: early, middle or late, then the exact week if you know it',w:'For people who do not know yet: three big soft choices (Early, Middle, Late September) are enough. A small "Pick the exact week" link opens version A\'s chips for people who do know.'}],
 mock:function(on,s,st){
  var CY=2027;var mm=ui(s,'mm',8);var len=ui(s,'len','2w');var sr=ui(s,'sr',null);var any=sr===null;
  var LN=[['wk','Long weekend'],['1w','1 week'],['2w','2 weeks'],['3w','3+ weeks']];var NB={wk:1,'1w':1,'2w':2,'3w':3}[len];var DAYS={wk:4,'1w':7,'2w':14,'3w':21}[len];
  function segs(y,m){var dim=new Date(y,m+1,0).getDate(),out=[],cur=null;for(var d=1;d<=dim;d++){var wd=new Date(y,m,d).getDay();if(!cur||wd===1){cur={d1:d,d2:d,m:m,y:y};out.push(cur);}else cur.d2=d;}return out;}
  var S=segs(CY,mm);if(!any&&sr>=S.length)sr=0;
  var months='<div class="mg" style="margin:4px 0 14px">'+MONTHS.map(function(x,i){return '<button class="'+(mm===i?'sel':'')+'" '+D(s,'mm',i)+'>'+x+'</button>';}).join('')+'</div>';
  var lenH='<div class="lab" style="margin:0 0 6px">How long</div><div class="sg">'+LN.map(function(x){return '<button class="'+(len===x[0]?'sel':'')+'" '+D(s,'len',x[0])+'>'+(x[0]==='wk'?'Long<br>weekend':x[1])+'</button>';}).join('')+'</div>';
  function lenTxt(){return len==='wk'?'a long weekend':len==='1w'?'1 week':len==='2w'?'2 weeks':'3 weeks or more';}
  function line(){if(any)return '<p class="small dim" style="margin:12px 2px 0">Any time in '+MONTHN[mm]+', '+lenTxt()+'.</p>';var seg=S[sr];var a=new Date(seg.y,seg.m,seg.d1);var e=new Date(a.getTime()+(DAYS-1)*864e5);var spill=e.getMonth()!==seg.m||sr+NB>S.length;return '<p class="small dim" style="margin:12px 2px 0">'+MONTHN[mm].slice(0,3)+' '+seg.d1+', '+lenTxt()+(spill?' · runs into '+MONTHN[(mm+1)%12]:'')+'</p>';}
  function lab(x){return x.d1===x.d2?String(x.d1):x.d1+'–'+x.d2;}
  var weekHead='<div class="lab" style="margin:16px 0 6px">Which week? <span style="text-transform:none;letter-spacing:0;font-weight:500;color:var(--afa)">Optional</span></div>';
  function chipsRow(){return '<div class="pills"><button class="pill'+(any?' sel':'')+'" '+D(s,'sr',null)+'>Any week</button>'+S.map(function(x,i){var inr=!any&&i>=sr&&i<sr+NB;return '<button class="pill'+(inr?' sel':'')+'" '+D(s,'sr',i)+'>'+lab(x)+'</button>';}).join('')+'</div>';}
  var head='<h3>When are you going?</h3><p class="sub">Pick the month, how long, then the week if you know it.</p>'+months+lenH;
  if(st==='a')return {body:topbar(60)+'<div style="padding:0 16px">'+head+weekHead+chipsRow()+line()+'</div>',foot:btn('Continue'),flush:true};
  if(st==='b'){var bar='<div style="display:flex;gap:3px;margin-top:2px">'+S.map(function(x,i){var n=x.d2-x.d1+1;var inr=!any&&i>=sr&&i<sr+NB;return '<button '+D(s,'sr',i)+' style="flex:'+n+' 1 0;min-width:0;height:34px;border-radius:9px;background:'+(inr?'var(--ac)':'#e3ddd4')+';opacity:'+(any?.55:1)+'"></button>';}).join('')+'</div><div style="display:flex;gap:3px;margin-top:3px">'+S.map(function(x){var n=x.d2-x.d1+1;return '<span style="flex:'+n+' 1 0;min-width:0;font-size:10px;color:var(--afa)">'+x.d1+'</span>';}).join('')+'</div>';
   return {body:topbar(60)+'<div style="padding:0 16px">'+head+'<div style="display:flex;align-items:center;margin:16px 0 6px"><span class="lab" style="margin:0;flex:1">Which week? <span style="text-transform:none;letter-spacing:0;font-weight:500;color:var(--afa)">Optional</span></span><button class="pill'+(any?' sel':'')+'" '+D(s,'sr',null)+' style="font-size:12px;padding:4px 11px">Any week</button></div>'+bar+line()+'</div>',foot:btn('Continue'),flush:true};}
  var ex=ui(s,'ex',false);var third=Math.ceil(S.length/3);
  var big=[['Early','the first week or so',0],['Middle','around the middle',1],['Late','the last week or so',2]].map(function(b){var idx=b[2]===0?0:b[2]===1?Math.floor(S.length/2):S.length-1;var on1=!any&&!ex&&sr===idx;return '<button '+D(s,'sr',idx)+' style="display:block;width:100%;text-align:left;padding:12px 14px;margin-bottom:7px;border-radius:12px;border:1.5px solid '+(on1?'var(--ac)':'var(--aln)')+';background:'+(on1?'var(--as)':'#fff')+'"><b>'+b[0]+' '+MONTHN[mm]+'</b><div class="small dim">'+b[1]+'</div></button>';}).join('');
  return {body:topbar(60)+'<div style="padding:0 16px">'+head+weekHead+big+'<div style="display:flex;gap:14px;align-items:center"><button class="pill'+(any?' sel':'')+'" '+D(s,'sr',null)+' style="font-size:12.5px">Any week</button><button class="small" '+D(s,'ex',!ex)+' style="color:var(--ac);text-decoration:underline">'+(ex?'Hide the exact weeks':'Pick the exact week')+'</button></div>'+(ex?'<div style="margin-top:10px">'+chipsRow()+'</div>':'')+line()+'</div>',foot:btn('Continue'),flush:true};}},

'''
t=t[:i]+when+t[j:]

# ---------------- DNA: baseline, with a way to add
i=t.index("{id:'dna',"); j=t.index("{id:'sw',")
dna=r'''{id:'dna',name:'Travel DNA page: your baseline',verdict:'<b>You agree with the concept, so here is how you edit it.</b> The page says "Your baseline. What we start with for every trip." Interests: tap the dots to change how much you like one, and "Add interests" opens the full list by group. Preferences: only the ones you have set are listed, each editable in place, and "Add a preference" lists the rest (climate, food needs, language, getting around, how you travel, kids). Trip choices live in the trip sheet. Try the add buttons.',
 states:[{id:'a',label:'The page',shots:['dna2']},{id:'b',label:'Trip sheet: save as default',shots:['tripset']}],
 changes:[
  {id:'dnaD',t:'The Travel DNA page is your baseline: no trip rows, no switches, with add buttons',w:'Removes "This trip only", every keep switch and the trip rows. Adds "Your baseline. What we start with for every trip." under the title, an "Add interests" button, and an "Add a preference" button, so the page is both where you edit and where you grow it.'},
  {id:'dnaE',t:'In the trip sheet, a quiet "Make this my default" under a choice',w:'Change Budget in the trip sheet and a small link offers to save it to your baseline. Optional; skip it and that trip keeps its own value.'}],
 mock:function(on,s,st){
  if(st==='b'){var saved=ui(s,'saved',false);return {body:'<div style="padding:12px 16px;font-weight:800">My September 2027 trip ▾</div><div style="padding:8px 16px"><div class="place"><b>#1 Namibia</b></div></div>',foot:null,over:'<div class="sheetbg"><div class="sheet"><div class="sc2"><h3 style="margin:0 0 8px;font-size:20px">My September 2027 trip</h3><div class="card" style="padding:4px 14px 10px"><div class="row last"><span class="l">Budget &amp; comfort</span><span class="v o" style="color:var(--ac);font-weight:700">Comfortable</span></div><div class="pills" style="margin:0 0 8px">'+['Basic / Budget','Comfortable','High-End','Luxury'].map(function(x){return '<span class="pill'+(x==='Comfortable'?' sel':'')+'">'+x+'</span>';}).join('')+'</div>'+(saved?'<div class="small" style="color:var(--agood);font-weight:700">✓ Saved to your baseline</div>':'<button class="small" '+D(s,'saved',true)+' style="color:var(--ac);text-decoration:underline">Make this my default</button>')+'</div><div class="row"><span class="l">Climate</span><span class="v">Any ›</span></div><div class="row"><span class="l">Who’s going</span><span class="v">Anyone ›</span></div></div><div class="btn" style="margin-top:8px">Show 200 places</div></div></div>'};}
  var LV=['Off','Curious','Like','Love','Top'];
  var ints=ui(s,'ints',[['🏔️','Scenic Landscapes',2],['🐾','Wildlife Viewing',3],['✨','Stargazing',2]]);
  var ADDI=[['🐘','Safari'],['🐋','Whale Watching'],['🦜','Birding'],['🌋','Geology'],['🥾','Hiking & Trekking'],['🍜','Food & Markets']];
  var addI=ui(s,'addi',false);var pickedI=ui(s,'pi',[]);
  var allInts=ints.concat(pickedI.map(function(n){var a=ADDI.filter(function(x){return x[1]===n;})[0];return [a[0],a[1],2];}));
  var irows=allInts.map(function(x,n){var L=ui(s,'lv'+x[1],x[2]);return '<div class="row'+(n===allInts.length-1?' last':'')+'" style="padding:11px 0"><span style="font-size:19px">'+x[0]+'</span><b style="flex:1;font-size:13.5px">'+x[1]+'</b><span class="small dim" style="width:46px;text-align:right">'+LV[L]+'</span><span class="lvl">'+[0,1,2,3].map(function(k){return '<button '+D(s,'lv'+x[1],k+1)+' style="display:block;padding:0"><i style="display:block;border-color:'+(k+1<=L?'var(--ac)':'#cfc6ba')+';background:'+(k+1<=L?'var(--ac)':'#fff')+'"></i></button>';}).join('')+'</span></div>';}).join('');
  var addBox=addI?'<div class="card" style="margin-top:8px"><div class="lab" style="margin:0 0 6px">Add interests</div><div class="pills">'+ADDI.filter(function(x){return pickedI.indexOf(x[1])<0;}).map(function(x){return '<button class="pill" '+T(s,'pi',x[1])+'>'+x[0]+' '+x[1]+'</button>';}).join('')+'</div><button class="small" '+D(s,'addi',false)+' style="margin-top:8px;color:var(--ac);text-decoration:underline">Done</button></div>':'<button class="pill" '+D(s,'addi',true)+' style="margin-top:8px">＋ Add interests</button>';
  var PR=[['💳','Budget & comfort','Any'],['👨‍👩‍👧','Who you usually travel with','Solo, With a spouse or partner'],['🏠','Where you live','Colorado, United States']];
  var MORE=[['🌡️','Climate'],['🎭','Social vibe'],['💪','Physical demand'],['🍽️','Food needs'],['🗣️','Language'],['♿','Getting around'],['🧭','How you travel'],['👶','Kid-friendly']];
  var addedP=ui(s,'pp',[]);var addP=ui(s,'addp',false);
  var prows=PR.concat(addedP.map(function(n){var a=MORE.filter(function(x){return x[1]===n;})[0];return [a[0],a[1],'Any'];})).map(function(r){return '<div class="card" style="padding:4px 14px"><div style="display:flex;align-items:center;gap:10px;padding:9px 0"><span style="font-size:20px">'+r[0]+'</span><div style="flex:1"><b>'+r[1]+'</b><div class="dim small">'+r[2]+'</div></div><span class="v">▾</span></div></div>';}).join('');
  var addPbox=addP?'<div class="card"><div class="lab" style="margin:0 0 6px">Add a preference</div><div class="pills">'+MORE.filter(function(x){return addedP.indexOf(x[1])<0;}).map(function(x){return '<button class="pill" '+T(s,'pp',x[1])+'>'+x[0]+' '+x[1]+'</button>';}).join('')+'</div><button class="small" '+D(s,'addp',false)+' style="margin-top:8px;color:var(--ac);text-decoration:underline">Done</button></div>':'<button class="pill" '+D(s,'addp',true)+'>＋ Add a preference</button>';
  return {body:topbar(100)+'<div style="padding:0 16px"><h3 style="font-size:21px">Your Travel DNA</h3><p class="sub" style="margin-bottom:10px">Your baseline. What we start with for every trip.</p><div class="lab" style="margin:6px 0 4px">Interests</div><div class="card" style="padding:4px 14px">'+irows+'</div>'+addBox+'<div class="lab" style="margin:16px 0 6px">Preferences</div>'+prows+addPbox+'</div>',foot:btn('Save my Travel DNA')+'<div class="lnk">Preview my places</div>',flush:true};}},

'''
t=t[:i]+dna+t[j:]

# ---------------- STAMPS: pushpins
i=t.index("{id:'stamps',"); j=t.index("{id:'home',")
stamps=r'''{id:'stamps',name:'My Stamps: pushpins',verdict:'<b>Small red round-headed pushpins, like the ones you press into a real map.</b> Nothing on the map until you have been somewhere, then one pin per place. No names and no emoji, only the pin. Three sizes and settings of the same pin; use the chips on the phone to go from 0 to 120 stamps, and tap a pin to see which place it is. (Collected places are random, just for the demo.)',
 states:[{id:'a',label:'A · Pushpin',shots:['stamps']},{id:'b',label:'B · Tiny',shots:['stamps']},{id:'c',label:'C · With shadow',shots:['stamps']}],
 changes:[
  {id:'sp4',t:'Pin A: a classic red pushpin',w:'A round red head with a small highlight and a short needle, small enough that 100 of them still read as dots of color.'},
  {id:'sp5',t:'Pin B: tiny pushpins',w:'The same pin about a third smaller, with almost no needle: the lightest on a crowded map (Europe with 50 places), the least pin-like.'},
  {id:'sp6',t:'Pin C: pushpins with a soft shadow',w:'The classic pin with a faint shadow under the head, as if pressed into paper. The most real-looking, slightly heavier.'}],
 mock:function(on,s,st){
  var n=ui(s,'n',25),sel=ui(s,'sel',null),zoom=ui(s,'zoom',false);
  var vis={};for(var q=0;q<n&&q<ORDER.length;q++)vis[ORDER[q]]=true;
  var LAND='#e6dfc8';var svg='';Object.keys(MAPP).forEach(function(k){svg+='<path d="'+MAPP[k]+'" fill="'+LAND+'" stroke="#cfc6a8" stroke-width="0.6" stroke-linejoin="round"/>';});
  var sc=st==='b'?0.62:1;
  PTS.forEach(function(p,i){if(!vis[i])return;var c=px(p);var isel=sel===i;var k=sc*(isel?1.6:1);
   var g='<g data-a="ui" data-s="'+s+'" data-k="sel" data-v="'+i+'" transform="translate('+c[0].toFixed(1)+' '+c[1].toFixed(1)+') scale('+k.toFixed(2)+')" style="cursor:pointer">';
   if(st==='c')g+='<ellipse cx="2.2" cy="-1" rx="4.6" ry="1.6" fill="#000" opacity=".22"/>';
   g+='<line x1="0" y1="0" x2="0" y2="'+(st==='b'?'-3':'-7')+'" stroke="#8a8a8a" stroke-width="1"/><circle cx="0" cy="-9.5" r="5.2" fill="#d23b32" stroke="#a3231c" stroke-width=".8"/><circle cx="-1.6" cy="-11.2" r="1.5" fill="#fff" opacity=".7"/></g>';svg+=g;});
  var W=zoom?'220%':'100%';
  var map='<div style="overflow-x:auto;border-radius:14px;border:1px solid #d9d2b8;background:#f8f4e6"><svg viewBox="0 0 720 284" style="display:block;width:'+W+';min-width:100%;height:auto">'+svg+'</svg></div>';
  var chips='<div class="pills" style="margin:10px 0 4px"><span class="fa small" style="align-self:center">Stamps</span>'+[0,8,25,60,120].map(function(x){return '<button class="pill'+(n===x?' out':'')+'" '+D(s,'n',x)+'>'+x+'</button>';}).join('')+'<button class="pill'+(zoom?' out':'')+'" '+D(s,'zoom',!zoom)+'>🔍 Zoom</button></div>';
  var selTxt=(sel!==null&&vis[sel])?'<div class="small" style="margin:4px 0"><b>'+PTS[sel].n+'</b></div>':(n===0?'<div class="small dim" style="margin:4px 0">Nothing yet. Mark a place visited and a pin lands here.</div>':'');
  return {body:'<div class="paperbg"><div style="padding:16px 16px 8px"><div style="display:flex;align-items:center"><div style="flex:1"><div style="font:800 21px ui-monospace,Menlo,monospace;letter-spacing:.14em;color:#2f5a63">MY STAMPS</div><div class="dim" style="font-family:ui-monospace,Menlo,monospace">'+n+' of 200 collected</div></div><span style="width:30px;height:30px;border-radius:50%;background:#fff;display:grid;place-items:center">×</span></div></div><div style="padding:0 16px 24px">'+map+chips+selTxt+'<div class="sg" style="grid-template-columns:1fr 1fr;margin:12px 0 4px;background:#e3dcc7"><button class="sel">Collected</button><button>All destinations</button></div></div></div>',foot:null,flush:true};}},

'''
t=t[:i]+stamps+t[j:]
open(p,'w').write(t); print('ok')
