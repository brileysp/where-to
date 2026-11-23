# 22 Nov 2026: rewrites screens-review section 6 (basics, by importance), 8's filter change (keep passport, filter out visited) and 13 (real continent order, passport texture).
import re
p='scripts/data/screens-review-template.html'; t=open(p).read()

bas = r"""{id:'bas',name:'The basics',verdict:'<b>This is the screen that needs the most help.</b> It is about three screens tall, and every pill starts filled orange, so a screen full of orange means "I have not chosen anything". The order also ignores what each question actually does to your results (see the scores in the change below).',
 states:[{id:'a',label:'The basics',shots:['bas1','bas2','bas3','bas4']}],
 changes:[
  {id:'bas1',t:'Quiet "Any" rows instead of walls of pills',w:'Everything starts as an "Any ›" row and opens on tap, with pills that only fill when you choose. Same pattern as the trip settings, so you learn it once.'},
  {id:'bas2',t:'Open Budget and Climate first, then order by impact',w:'Budget & comfort (about 9 out of 10 for changing results) and Climate (8) start open. Then rows: Where in the world (8 when used), Crowds & prices (5), Who is going (3), What else matters (6 for those who need it). Who is going drops from the top because for anyone with two or more interests it changes no scores.'},
  {id:'bas3',t:'One button instead of two',w:'"Continue" and "Skip, I will decide later" both do the same thing here. One button, "Show my places".'},
  {id:'bas4',t:'Hide "What kind of place?" until it does something',w:'It is not wired up, so it currently changes nothing. Showing it is a promise we do not keep. It comes back once places have a type (cities, parks, islands…).'}],
 mock:function(on,s){
  var flat=!on('bas1');
  if(ui(s,'op',null)===null)setui(s,'op',on('bas2')?['b','c']:[]);
  var op=ui(s,'op',[]);
  function opt(key,label,anyTxt,pills){var o=op.indexOf(key)>=0;var picked=ui(s,'p_'+key,[]);var val=picked.length?picked.join(', '):anyTxt;return '<div class="card" style="padding:4px 14px 6px"><button style="display:flex;width:100%;align-items:center;padding:10px 0" '+T(s,'op',key)+'><b style="flex:1;font-size:14.5px">'+label+'</b><span class="v" style="max-width:150px;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'+(picked.length?'color:var(--ac);font-weight:700':'')+'">'+val+'</span><span class="v" style="margin-left:6px">'+(o?'⌃':'›')+'</span></button>'+(o?'<div class="pills" style="padding:2px 0 8px">'+pills.map(function(x){return pill(s,'p_'+key,x,x,picked.indexOf(x)>=0);}).join('')+'</div>':'')+'</div>';}
  function flatCard(t,sub,pills){return '<div class="card"><h4>'+t+'</h4><p>'+sub+'</p><div class="pills">'+pills.map(function(x){return '<span class="pill sel">'+x+'</span>';}).join('')+'</div></div>';}
  var B=['Basic / Budget','Comfortable','High-End','Luxury'],C=['Cold','Cool','Warm','Hot'],W=['Solo','With friends','With a spouse or partner','With my kids'],K=['Cities','US National Parks','Wilderness areas','Small towns','Islands','Beaches & coast'],R=['North America','Central & South America','Europe','Africa','Asia','Australia and the Pacific'];
  var parts;
  if(!flat){
   var care='<div class="card" style="padding:4px 14px"><div class="row last"><span class="l" style="font-weight:700">What else matters?<br><span class="fa small" style="font-weight:400">Kids’ ages, food needs, language, getting around</span></span><span class="v">›</span></div></div>';
   var kind=on('bas4')?'':opt('k','What kind of place','Any',K);
   parts=on('bas2')?[opt('b','Budget &amp; comfort','Any',B),opt('c','Climate','Any',C),opt('w','Where in the world','Anywhere',R),opt('p','Crowds &amp; prices','In between',['Peak times','In between','Off peak']),opt('who','Who is going','Anyone',W),care,kind]
    :[opt('who','Who is going','Anyone',W),opt('b','Budget &amp; comfort','Any',B),opt('c','Climate','Any',C),opt('p','Crowds &amp; prices','In between',['Peak times','In between','Off peak']),opt('w','Where in the world','Anywhere',R),kind,care];
  } else {
   var whoCard='<div class="card"><h4>Who is going?</h4><p>Select all that apply.</p><div class="pills">'+W.map(function(x){return pill(s,'who',x,x,has(s,'who',x));}).join('')+'</div></div>';
   var bc=flatCard('Budget &amp; comfort','Everything selected means “no preference.”',B),cc=flatCard('Climate','Daily highs: Cold under 50°F · Cool 50 to 69 · Warm 70 to 84 · Hot 85 and up',C);
   var rest=flatCard('Crowds &amp; prices','Peak times … Off peak',['In between'])+flatCard('Where in the world?','Everywhere is on. Tap a continent to leave it out.',R)+(on('bas4')?'':flatCard('What kind of place?','Everything is on. Tap a type to leave it out.',K));
   parts=on('bas2')?[bc,cc,rest,whoCard]:[whoCard,bc,cc,rest];
  }
  return {body:topbar(90)+'<div style="padding:0 16px"><h3>The basics</h3><p class="sub">A few taps. Your shortlist appears right after.</p>'+parts.join('')+'</div>',foot:on('bas3')?btn('Show my places'):btn('Continue')+'<div class="lnk">Skip, I will decide later</div>',flush:true};}},

"""
i=t.index("{id:'bas',"); j=t.index("{id:'vibes',")
t=t[:i]+bas+t[j:]

# 8: result filter change
old_chg=re.search(r"\{id:'res3',t:'[^']*',w:'[^']*'\},",t).group(0)
new_chg="{id:'res3',t:'Saved / Visited switch, a way to hide where you have been, and the passport stays',w:'A segmented All / Saved / Visited control, plus a clear \"Hide places I have been\" switch, because many people want to filter OUT visited places. The passport (My Stamps) keeps its own button with your count, so that view is still one tap away. Try all three.'},"
t=t.replace(old_chg,new_chg)
old_filt=re.search(r"var filt=on\('res3'\)\?.*?:'<div style=\"padding:0 16px 8px;display:flex;gap:14px;font-size:12.5px\">.*?</div>';",t,re.S).group(0)
new_filt="""var VIS=['Maasai Mara &amp; Amboseli'],SAV=['Namibia','Okavango Delta'];var hide=ui(s,'hide',false);
  var filt=on('res3')?'<div style="padding:0 16px 8px"><div class="sg" style="grid-template-columns:repeat(3,1fr)">'+['All','Saved','Visited'].map(function(x){return '<button class="'+(seg===x?'sel':'')+'" '+D(s,'seg',x)+'>'+x+'</button>';}).join('')+'</div><div style="display:flex;align-items:center;gap:8px;margin-top:9px"><button style="display:flex;align-items:center;gap:8px;flex:1" '+D(s,'hide',!hide)+'><span class="tg" style="width:36px;height:22px;background:'+(hide?'var(--ac)':'#cfc6ba')+';'+(hide?'':'')+'"><span style="position:absolute;top:3px;'+(hide?'right:3px':'left:3px')+';width:16px;height:16px;border-radius:50%;background:#fff"></span></span><span class="small">Hide places I have been</span></button><button class="chipbtn" '+D(s,'pp',true)+'>🛂 My Stamps · '+VIS.length+' ›</button></div></div>':'<div style="padding:0 16px 8px;display:flex;gap:14px;font-size:12.5px"><button '+D(s,'pp',true)+' class="dim">⬡ places visited ›</button><span class="fa">Hide visited</span><span class="fa">Show saved 🔖</span></div>';"""
t=t.replace(old_filt,new_filt)
# list filtering + visited badge: replace the P.map(pc) usages with filtered list
t=t.replace("function pc(p,i){return '<div class=\"place\"><div class=\"l1\"><span class=\"rk\">#'+(i+1)+'</span><span class=\"nm\">'+p[0]+'</span><span class=\"sc\">'+p[1]+'</span></div><div class=\"l2\"><span class=\"reg\">📍 '+p[2]+'</span><span class=\"bm\">🔖</span></div>'",
 "function pc(p,i){var vis=VIS.indexOf(p[0])>=0;return '<div class=\"place\"><div class=\"l1\"><span class=\"rk\">#'+(i+1)+'</span><span class=\"nm\">'+p[0]+'</span><span class=\"sc\">'+p[1]+'</span></div><div class=\"l2\"><span class=\"reg\">📍 '+p[2]+'</span>'+(vis&&on('res3')?'<span class=\"reg\" style=\"color:var(--ac);border-color:var(--ac)\">✓ Visited</span>':'')+'<span class=\"bm\">'+(SAV.indexOf(p[0])>=0&&on('res3')?'🔖':'🔖')+'</span></div>'")
t=t.replace("return {body:hdr+titleRow+srch+chips+filt+'<div style=\"padding:0 16px\">'+P.map(pc).join('')+'</div>',foot:null,flush:true};}},",
 "var shown=P.filter(function(p){if(!on('res3'))return true;if(seg==='Saved'&&SAV.indexOf(p[0])<0)return false;if(seg==='Visited'&&VIS.indexOf(p[0])<0)return false;if(hide&&VIS.indexOf(p[0])>=0)return false;return true;});\n  var over=ui(s,'pp',false)?'<div class=\"sheetbg\"><div class=\"sheet\" style=\"background:#f3eedc\"><div style=\"display:flex;align-items:center\"><div style=\"flex:1\"><div style=\"font:800 19px ui-monospace,Menlo,monospace;letter-spacing:.14em;color:#2f5a63\">MY STAMPS</div><div class=\"dim\" style=\"font-family:ui-monospace,Menlo,monospace\">'+VIS.length+' of 200 collected</div></div><button '+D(s,'pp',false)+' style=\"width:30px;height:30px;border-radius:50%;background:#fff;text-align:center\">×</button></div><p class=\"dim\" style=\"margin:12px 0 4px\">The passport sheet, unchanged: your stamps and the full collection.</p></div></div>':'';\n  return {body:hdr+titleRow+srch+chips+filt+'<div style=\"padding:0 16px\">'+(shown.length?shown.map(pc).join(''):'<div class=\"card\" style=\"text-align:center;color:var(--adim)\">Nothing here yet.</div>')+'</div>',foot:null,flush:true,over:over};}},")
# bug: pc uses VIS/SAV which are defined in filt block (same function scope) - fine since var hoisting; but filt defined after pc declared -> ok at call time.

# 13 stamps rewrite
stamps = r"""{id:'stamps',name:'My Stamps',verdict:'<b>The passport look stays.</b> The paper texture is part of what makes it feel like a passport. What I would change is the empty map box that says "WORLD MAP PLACEHOLDER", and a couple of small things around it.',
 states:[{id:'a',label:'My Stamps',shots:['stamps']}],
 changes:[
  {id:'st1',t:'Continent progress instead of the placeholder box',w:'One small bar per area, in the order the collection list already uses (Canada, US, Mexico and the Caribbean, South America, Africa, Antarctica, Asia, Europe, Oceania), with the real totals from your 200 places. The paper texture stays.'},
  {id:'st2',t:'A friendly empty state',w:'"No stamps yet — mark a destination visited…" becomes a clear invitation with a button to browse.'},
  {id:'st3',t:'Collected / All as a switch',w:'"Show all destinations" is an underlined text link. A two-way switch says which list you are looking at.'}],
 mock:function(on,s){var sw=ui(s,'sw','Collected');
  var C=[['Canada',6],['US',35],['Mexico, Central America and Caribbean',19],['South America',18],['Africa',17],['Antarctica',1],['Asia',35],['Europe',57],['Oceania',12]];
  var mapBox=on('st1')?'<div style="margin:6px 0 12px">'+C.map(function(c){return '<div style="display:flex;align-items:center;gap:8px;margin:7px 0;font-size:12px"><span style="width:132px;line-height:1.15">'+c[0]+'</span><div class="bar2" style="flex:1;background:#dcd5c2"><i style="width:0;background:#2f5a63"></i></div><span style="width:50px;text-align:right">0 of '+c[1]+'</span></div>';}).join('')+'</div>':'<div style="border:1.5px dashed #9bb0ae;border-radius:18px;height:150px;display:grid;place-items:center;text-align:center;font-family:ui-monospace,Menlo,monospace;color:#2f5a63;margin:6px 0 14px"><div>WORLD MAP PLACEHOLDER<br><span class="dim small">countries &amp; states colored in as visited</span></div></div>';
  var sgl=on('st3')?'<div class="sg" style="grid-template-columns:1fr 1fr;margin-bottom:10px;background:#e3dcc7">'+['Collected','All destinations'].map(function(x){return '<button class="'+(sw===x?'sel':'')+'" '+D(s,'sw',x)+'>'+x+'</button>';}).join('')+'</div>':'<div style="display:flex;margin:4px 0 10px;font-family:ui-monospace,Menlo,monospace"><b style="flex:1;color:#2f5a63">Collection</b><u style="color:#2f5a63;font-weight:700">Show all destinations</u></div>';
  var empty=on('st2')?'<div style="text-align:center;padding:26px 8px"><div style="font-size:38px">🛂</div><b style="font-size:16px;display:block;margin:6px 0 4px">Your passport is empty</b><div class="dim">Tap “Visited” on any place and its stamp lands here.</div><div class="btn" style="margin-top:14px;display:inline-block;width:auto;padding:10px 22px">Browse places</div></div>':'<p class="dim" style="text-align:center;padding:20px 6px">No stamps yet — mark a destination visited, or tap "Show all destinations" to add your first ones.</p>';
  var all=C.slice(0,3).map(function(c){return '<div style="display:flex;font:700 12px ui-monospace,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;color:#2f5a63;margin:12px 0 6px;border-bottom:1px solid #c9c2ac;padding-bottom:3px"><span style="flex:1">'+c[0]+'</span><span>0 of '+c[1]+'</span></div><div class="card" style="font-size:13px;background:#fffdf2">Not visited yet</div>';}).join('');
  return {body:'<div class="paperbg"><div style="padding:16px 16px 8px"><div style="display:flex;align-items:center"><div style="flex:1"><div style="font:800 21px ui-monospace,Menlo,monospace;letter-spacing:.14em;color:#2f5a63">MY STAMPS</div><div class="dim" style="font-family:ui-monospace,Menlo,monospace">0 of 200 collected</div></div><span style="width:30px;height:30px;border-radius:50%;background:#fff;display:grid;place-items:center">×</span></div></div><div style="padding:0 16px 24px">'+mapBox+sgl+(sw==='Collected'||!on('st3')?empty:all)+'</div></div>',foot:null,flush:true};}},

"""
i=t.index("{id:'stamps',"); j=t.index("{id:'home',")
t=t[:i]+stamps+t[j:]

# CSS for paper texture (variables injected by the build script)
t=t.replace("</style>\n<div class=\"page\">",""".a .paperbg{--pg:__PAPER_GRAIN__;--pw:__PAPER_WAVES__;position:relative;min-height:100%;background-color:#f3eedc;background-image:linear-gradient(180deg,rgba(59,143,153,.09) 0,rgba(139,114,179,.05) 110px,rgba(59,143,153,0) 220px),radial-gradient(ellipse at 50% 0%,rgba(255,255,255,.6),transparent 55%),radial-gradient(ellipse at 50% 110%,rgba(140,112,60,.14),transparent 60%),var(--pg);background-size:auto,auto,auto,200px 200px}
.a .paperbg:before{content:'';position:absolute;inset:0;background:var(--pw);background-size:200px 60px;opacity:.17;pointer-events:none}
.a .paperbg>*{position:relative}
</style>
<div class="page">""",1)
open(p,'w').write(t)

# build script gets the texture strings from results.css
b='scripts/data/build-screens-review-nov22.py'; s=open(b).read()
if 'PAPER_GRAIN' not in s:
    s=s.replace("open('.cache/screens-review.html','w')","""css=open('src/components/results/results.css').read()
import re as _re
g=_re.search(r'--paper-grain:\\s*(url\\(.*?\\));\\n',css).group(1); w=_re.search(r'--paper-waves:\\s*(url\\(.*?\\));\\n',css).group(1)
t=t.replace('__PAPER_GRAIN__',g).replace('__PAPER_WAVES__',w)
open('.cache/screens-review.html','w')""")
    open(b,'w').write(s)
print('patched')
