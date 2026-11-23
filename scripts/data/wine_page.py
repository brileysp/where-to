import json,html,collections
import re
LAB={'fineDining':'Fine Dining','streetFood':'Street Food & Markets','coffeeTea':'Specialty Coffee & Tea','wineSpirits':'Wine, Beer & Spirits'}
MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
TYPE={'country':'Country','city':'City','region':'Region','state_province':'State or province','island':'Island','coastal_area':'Coastal area','national_park':'Park','wilderness_area':'Wilderness'}
# 6 Nov 2026: the older source files were cleared from the scratchpad, so the wine cards are taken from the data already embedded in the published page (built 4 Nov from the name-scrubbed texts)
_h=open('food_page.html').read()
data=json.loads(re.search(r'const DATA=(\{.*?\});\nconst LAB',_h,flags=re.S).group(1))
exec(open('wine_alts.py').read())
data['cells']=[c for c in data['cells'] if c['k']=='wineSpirits']; data['na']=[]
for c in data['cells']:
    if c['id'] in ALT: c['alt']=ALT[c['id']][0]; c['altwhy']=ALT[c['id']][1]
exec(open('wine_edits.py').read())
for c in data['cells']:
    e=EDITS.get(c['id'])
    if not e: continue
    c['edited']=True
    if 'ov' in e: c['ov']=e['ov']
    if 'ovadd' in e:
        c['ov']=c['ov'].rstrip()+e['ovadd']
        if c.get('alt'): c['alt']=c['alt'].rstrip()+e['ovadd']
    if 'alt' in e:
        if e['alt'] is None: c.pop('alt',None); c.pop('altwhy',None)
        else: c['alt']=e['alt']
    for k,v in (e.get('bl') or {}).items(): c['bl'][int(k)]['t']=v
    if 'peak' in e:
        old=max(c['fin']); f=e['peak']/old; fin=[round(v*f,1) for v in c['fin']]; m=max(fin)
        c['fin']=[e['peak'] if v==m else v for v in fin]

cnt=collections.Counter(c['k'] for c in data['cells']); nacnt=collections.Counter(c['k'] for c in data['na'])
print(cnt,nacnt)
page='''<title>Wine, Beer and Spirits Review</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root{--bg:#faf8f4;--fg:#1f1d1a;--muted:#6b665e;--line:#e4dfd6;--card:#fff;--accent:#7a4a14;--ten:#f6e7b4;--tenc:#6b4b00;--hi:#e6f2e9;--hic:#2d6a3e;--warn:#fbf1d6;--warnc:#8a6100}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#171613;--fg:#ece8e1;--muted:#a09a90;--line:#3a372f;--card:#201f1b;--accent:#e5b36a;--ten:#4a3a10;--tenc:#f0d78a;--hi:#1d2e22;--hic:#8fcf9f;--warn:#34290f;--warnc:#e8c46a;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#171613;--fg:#ece8e1;--muted:#a09a90;--line:#3a372f;--card:#201f1b;--accent:#e5b36a;--ten:#4a3a10;--tenc:#f0d78a;--hi:#1d2e22;--hic:#8fcf9f;--warn:#34290f;--warnc:#e8c46a;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:15px/1.55 Georgia,serif;padding-block:24px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
main{max-width:880px;margin:0 auto}
h1{font-size:28px;margin:0 0 6px;text-wrap:balance}
.sub{color:var(--muted);max-width:72ch}
.box{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px;margin:12px 0;font:14px/1.5 system-ui,sans-serif}
.box h3{margin:0 0 6px;font:600 15px system-ui,sans-serif}
.box ul{margin:4px 0;padding-left:20px}
.bar{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0;position:sticky;top:0;background:var(--bg);padding:8px 0;z-index:5;border-bottom:1px solid var(--line);font-family:system-ui,sans-serif}
.bar button{border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:999px;padding:6px 14px;font:500 13px system-ui,sans-serif;cursor:pointer}
.bar button[aria-pressed="true"]{background:var(--accent);color:var(--bg);border-color:var(--accent)}
.bar input{flex:1;min-width:150px;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--fg);font:14px system-ui,sans-serif}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:12px 0;min-width:0}
.card h2{font-size:18px;margin:0 0 4px}
.len{font:12.5px/1.5 system-ui,sans-serif;color:var(--muted);margin:6px 0}.over{color:var(--warnc)}
.meta{font:12.5px/1.5 system-ui,sans-serif;color:var(--muted);margin:0 0 8px}
.pill{display:inline-block;border-radius:6px;padding:1px 8px;font:600 11.5px system-ui,sans-serif;margin-right:4px}
.pill.ten{background:var(--ten);color:var(--tenc)} .pill.warn{background:var(--warn);color:var(--warnc)} .pill.ok{background:var(--hi);color:var(--hic)}
.ov{margin:6px 0 10px}
.bl{margin:0 0 8px}
.lv{font:600 11px system-ui,sans-serif;color:var(--muted);text-transform:uppercase;margin-left:6px}
.sc{font:12.5px/1.5 system-ui,sans-serif;color:var(--muted);background:var(--bg);border-radius:6px;padding:7px 10px;margin:8px 0;overflow-wrap:anywhere}
.sc b{color:var(--fg)}
.why{font:13px/1.45 system-ui,sans-serif;margin:4px 0}
textarea{width:100%;box-sizing:border-box;margin-top:6px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);font:14px system-ui,sans-serif;padding:7px 10px}
.saved{font:12px system-ui,sans-serif;color:var(--muted);min-height:14px}
.rul{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;font-family:system-ui,sans-serif}
.rul button{border:1px solid var(--line);background:transparent;color:var(--fg);border-radius:6px;padding:4px 12px;font:500 13px system-ui,sans-serif;cursor:pointer}
.rul button[aria-pressed="true"]{background:var(--hi);color:var(--hic);border-color:var(--hic)}
.cnt{font:13px system-ui,sans-serif;color:var(--muted)}
.nav,.filt{display:flex;flex-wrap:wrap;gap:8px;align-items:center;width:100%}.nav select{max-width:220px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--fg);font:13px system-ui,sans-serif}.pos{font:13px system-ui,sans-serif;color:var(--muted);margin-left:auto}.card{scroll-margin-top:var(--barh,120px)}.ovpair{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0}@media(max-width:640px){.ovpair{grid-template-columns:1fr}}.ovbox{border:1px solid var(--line);border-radius:8px;padding:8px 12px;min-width:0}.ovbox.alt{background:var(--hi)}.ovlab{font:600 12px system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}.ovbox p{margin:6px 0}.altwhy{font:13px/1.45 system-ui,sans-serif;color:var(--muted)}.ovrul{grid-column:1/-1}
</style>
<main>
<h1>Wine, Beer &amp; Spirits: review</h1>
<p class="sub">109 places written by Gemini Pro. Fine Dining, Street Food and Coffee &amp; Tea are saved, so this page now shows only Wine, Beer &amp; Spirits. Nothing here is saved in the app yet. Read, add notes, and tell me to save. Use the buttons at the top to move through the list.</p>
<div class="box"><h3>Clause alts for the overviews (new)</h3><ul>
<li>You asked for each drink to be covered separately, the biggest draw first and the rest at the end, with no range sentence up front and no season clause stuck to the wrong topic (Andaluc&iacute;a is the model). I read all 109 overviews against that. <b>68 have a clause alt</b> beside Gemini's original; the other 41 already read the way you like (Andaluc&iacute;a, Bordeaux, Champagne, Piedmont, Rioja and Tuscany among them).</li>
<li>Each alt uses only the facts already in Gemini's overview. It reorders and splits; it adds nothing new, names no businesses beyond the eight flagged places, and stays inside the length max. Under each alt I say what I changed.</li>
<li>Where it was a judgment call which drink is the biggest draw (Budapest, Barcelona, Aspen), the <i>Why</i> line says so. Swap it in your note if you disagree.</li>
<li>Press <b>Use the Gemini original</b> or <b>Use the clause alt</b> on each card. If you do not choose, the original is what gets saved. The buttons at the top filter to the places with an alt, or the ones you have not chosen yet. Month blurbs are untouched.</li></ul></div>
<div class="box"><h3>What I did before you read</h3><ul>
<li><b>Company names.</b> I took out named wineries, distilleries, breweries, venues and tours wherever the sentence read fine without them (33 edits here, for example Jameson, Penderyn, Marqu&eacute;s de Riscal, the Hofbr&auml;uhaus, Staropramen, Les Caves du Louvre). Eight places keep a name because it is the point of the entry; each carries a <i>Company name left in</i> note: Barbados, Svalbard, Ireland, Hokkaido, Taiwan, Palau, Budapest and Venice. Festivals, trails and protected drink names are not businesses and stay.</li>
<li><b>Length.</b> Each card shows its overview and blurb lengths against the max for its score, plus total words. 16 of the 109 are over the max; only going over (or a flagship overview under 60% of its max) is flagged. Use the "Over the length max only" button to see them.</li>
<li><b>Scores.</b> Gemini's and our old scores were compared against our own wine, beer and spirits columns. The top end is the even ladder you approved (10.0, 9.9, 9.8, and so on): Napa &amp; Sonoma and Champagne are the 10.0s, then Bordeaux and Piedmont at 9.9, Rioja and Tuscany at 9.8. 36 places have a big seasonal drop (more than 2 points); each card says whether I found evidence for it. Where there was none I split the difference and flagged it.</li>
<li><b>Wording and facts.</b> A cheap second pass fixed rule breaks such as "offers" and "year-round" (5 places kept their original wording and are marked). Named festivals, closures and seasons were checked against Wikipedia and web searches before you see them. One slip I fixed while reading: the Nova Scotia blurb repeated the name of a film festival.</li>
<li><b>After you finish:</b> I save the texts and scores, run the rank check, log a dated fact-check note and update the tracker, as with the other three.</li>
</ul></div>
<div class="bar" id="bar"></div>
<div id="out"></div>
</main>
<script>
const DATA='''+json.dumps(data,ensure_ascii=False)+''';
const LAB='''+json.dumps(LAB)+''';
const MON='''+json.dumps(MON)+''';
let cur={k:'wineSpirits',q:'',sort:'name',only:false,over:false,alt:false,nc:false}; const NOTES={}; let col=null;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function ms(a){return a.length===12?'All year':a.map(m=>MON[m-1]).join(', ');}
function tier(p){return p<4?[280,180]:p<6?[380,260]:p<8.5?[450,320]:[550,326];}
function lens(c){const peak=Math.max(...c.fin),[om,bm]=tier(peak);const ol=c.ov.length;const bl=c.bl.map(b=>b.t.length);const words=(c.ov+' '+c.bl.map(b=>b.t).join(' ')).trim().split(/\s+/).length;const chars=ol+bl.reduce((a,b)=>a+b,0);const maxT=om+bm*bl.length;const overBl=bl.filter(n=>n>bm).length;const over=ol>om||overBl>0;const short=peak>=6&&ol<0.6*om;return {peak,om,bm,ol,bl,words,chars,maxT,overBl,over,short};}
function ovPair(c,id,n){const [om]=tier(Math.max(...c.fin)); const ch=n.ovChoice||''; const f=(t)=>t.length>om?`<b class="over">${t.length} / ${om}</b>`:`${t.length} / ${om}`;
  return `<div class="ovpair"><div class="ovbox"><div class="ovlab">Gemini original</div><p class="ov">${esc(c.ov)}</p><div class="altwhy">${f(c.ov)} characters</div></div><div class="ovbox alt"><div class="ovlab">Clause alt (proposal)</div><p class="ov">${esc(c.alt)}</p><div class="altwhy">${f(c.alt)} characters. <b>Why:</b> ${esc(c.altwhy)}</div></div><div class="rul ovrul" data-id="${id}"><button data-ov="orig" aria-pressed="${ch==='orig'}">Use the Gemini original</button><button data-ov="alt" aria-pressed="${ch==='alt'}">Use the clause alt</button><span class="altwhy">${ch?'':'Not chosen yet: the original stays unless you pick the alt.'}</span></div></div>`;}
function card(c){
  const peak=Math.max(...c.fin), id=c.k+'__'+c.id; const n=NOTES[id]||{};
  const ten=peak>=9.95; const pills=(ten?'<span class="pill ten">a 10</span>':'')+(c.cls==='agree'?'<span class="pill ok">scores agree</span>':'<span class="pill warn">scores reviewed</span>')+(c.rej?'<span class="pill warn">wording not cleaned</span>':'')+(c.alt?'<span class="pill ok">clause alt proposed</span>':'')+(c.edited?'<span class="pill ok">your edit applied</span>':'');
  return `<section class="card" id="c-${c.id}"><h2>${esc(c.name)}</h2><p class="meta">${esc(c.type)} · ${c.depth==='year'?'one blurb for the year':c.depth==='groups'?'blurbs by season':'month by month'} · peak <b>${peak.toFixed(1)}</b> ${pills}</p>
  ${c.alt?ovPair(c,id,n):`<p class="ov">${esc(c.ov)}</p>`}${c.bl.map(b=>`<p class="bl"><b>${ms(b.m)}</b><span class="lv">${esc(b.lv)}</span><br>${esc(b.t)}</p>`).join('')}
  ${(()=>{const L=lens(c);const w=(n,m)=>n>m?`<b class="over">${n} / ${m}</b>`:`${n} / ${m}`;return `<p class="len"><b>Length (limits for a ${L.peak.toFixed(1)} peak):</b> overview ${w(L.ol,L.om)} characters · ${L.bl.length===1?'blurb':'blurbs'} ${L.bl.map(n=>w(n,L.bm)).join(', ')} (max ${L.bm} each) · total ${L.words} words, ${L.chars} of ${L.maxT} characters${L.over?' <span class="pill warn">over the max</span>':''}${L.short?' <span class="pill warn">overview short for a flagship</span>':''}</p>`;})()}
  <div class="sc"><b>Final scores:</b> ${c.fin.map(v=>v.toFixed(1)).join(' ')}<br><b>Gemini:</b> ${c.gem.map(v=>v.toFixed(1)).join(' ')}<br><b>Our old:</b> ${c.ours.map(v=>v.toFixed(1)).join(' ')}</div>
  <p class="why"><b>Scores.</b> ${esc(c.why)}</p>${c.nf?`<p class="why"><b>Company name left in (core to the place).</b> ${esc(c.nf)}</p>`:''}${c.sw?`<p class="why"><b>Seasonal drop (Gemini ${c.sw.sw} points, ${c.sw.verdict}).</b> ${esc(c.sw.note)}</p>`:''}${c.flags.length?`<p class="why"><b>Gemini flagged:</b> ${esc(c.flags.join('; '))}</p>`:''}
  <textarea data-n="${id}" rows="2" placeholder="Your note on this one">${esc(n.note||'')}</textarea></section>`;
}
function naCard(c){
  const id='na__'+c.k+'__'+c.id; const n=NOTES[id]||{}; const choice=n.choice||c.rec;
  return `<section class="card"><h2>${esc(c.name)} <span class="meta">${esc(LAB[c.k])}</span></h2><p class="meta">${esc(c.type)} · our old peak ${c.ours.toFixed(1)}</p>
  <p class="why"><b>Gemini:</b> ${esc(c.why)}</p><p class="meta">Our columns: ${esc(JSON.stringify(c.cols).slice(0,170))}</p>
  <div class="rul" data-id="${id}"><button data-c="na" aria-pressed="${choice==='na'}">Switch to not applicable</button><button data-c="keep" aria-pressed="${choice==='keep'}">Keep applicable, write the text</button></div>
  <textarea data-n="${id}" rows="1" placeholder="Note">${esc(n.note||'')}</textarea></section>`;
}
function render(){
  const bar=`<div class="nav"><button data-nav="top">&uarr; Top</button><button data-nav="prev">&laquo; Previous</button><button data-nav="next">Next &raquo;</button><button data-nav="ten">+10 &raquo;&raquo;</button><button data-nav="nonote">Next without a note</button><select id="jump" aria-label="Go to a place"><option value="">Go to a place&hellip;</option>${DATA.cells.filter(c=>c.k==='wineSpirits').slice().sort((a,b)=>a.name.localeCompare(b.name)).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><span class="pos" id="pos"></span></div><div class="filt"><button data-s="name" aria-pressed="${cur.sort==='name'}">A to Z</button><button data-s="peak" aria-pressed="${cur.sort==='peak'}">Highest peak</button><button data-o="1" aria-pressed="${cur.only}">Scores reviewed only</button><button data-v="1" aria-pressed="${cur.over}">Over the length max only</button><button data-a="1" aria-pressed="${cur.alt}">Only places with a clause alt (${DATA.cells.filter(c=>c.alt).length})</button><button data-nc="1" aria-pressed="${cur.nc}">Alts not yet chosen</button><input id="q" placeholder="Search a place" value="${esc(cur.q)}"></div>`;
  document.getElementById('bar').innerHTML=bar;
  let h='';
  if(cur.k==='na'){ h='<div class="box"><h3>Gemini called these not applicable</h3>Your rule: nothing existing means not applicable; otherwise applicable wins. My recommendation is pre-selected: 34 switch to not applicable, and Great Barrier Reef street food stays applicable (Cairns and Port Douglas have markets). Change any of them here.</div>'+DATA.na.map(naCard).join(''); }
  else{ let rows=DATA.cells.filter(c=>c.k===cur.k); if(cur.q) rows=rows.filter(c=>c.name.toLowerCase().includes(cur.q.toLowerCase())); if(cur.only) rows=rows.filter(c=>c.cls!=='agree'); if(cur.over) rows=rows.filter(c=>lens(c).over); if(cur.alt) rows=rows.filter(c=>c.alt); if(cur.nc) rows=rows.filter(c=>c.alt&&!((NOTES[c.k+'__'+c.id]||{}).ovChoice));
    rows.sort(cur.sort==='peak'?(a,b)=>Math.max(...b.fin)-Math.max(...a.fin):(a,b)=>a.name.localeCompare(b.name)); h=`<p class="cnt">${rows.length} places</p>`+rows.map(card).join(''); }
  document.getElementById('out').innerHTML=h;
}
document.addEventListener('click',e=>{const b=e.target.closest('button'); if(!b) return;
  if(b.dataset.k){cur.k=b.dataset.k;render();window.scrollTo(0,0);return;} if(b.dataset.s){cur.sort=b.dataset.s;render();return;} if(b.dataset.o){cur.only=!cur.only;render();return;} if(b.dataset.v){cur.over=!cur.over;render();return;} if(b.dataset.a){cur.alt=!cur.alt;render();return;} if(b.dataset.nc){cur.nc=!cur.nc;render();return;} if(b.dataset.ov){const id=b.closest('.rul').dataset.id; NOTES[id]=Object.assign({},NOTES[id]||{},{ovChoice:b.dataset.ov,at:new Date().toISOString()}); if(col) col.doc(id).set(NOTES[id]).catch(()=>{}); render(); return;}
  if(b.dataset.c){const id=b.closest('.rul').dataset.id; NOTES[id]=Object.assign({},NOTES[id]||{},{choice:b.dataset.c,at:new Date().toISOString()}); if(col) col.doc(id).set(NOTES[id]).catch(()=>{}); render();}});
document.addEventListener('input',e=>{if(e.target.id==='q'){cur.q=e.target.value;const p=e.target.selectionStart;render();const q=document.getElementById('q');q.focus();q.setSelectionRange(p,p);}});
document.addEventListener('focusout',e=>{const t=e.target; if(!t.dataset||!t.dataset.n) return; const id=t.dataset.n; NOTES[id]=Object.assign({},NOTES[id]||{},{note:t.value,at:new Date().toISOString()}); if(col) col.doc(id).set(NOTES[id]).then(()=>{if(t.nextElementSibling)t.nextElementSibling.textContent='Saved';}).catch(()=>{});});
function cards(){return Array.from(document.querySelectorAll('#out section.card'));}
function curIdx(){const cs=cards(); const y=document.getElementById('bar').getBoundingClientRect().height+8; let i=0; for(let k=0;k<cs.length;k++){ if(cs[k].getBoundingClientRect().top-y<=8) i=k; else break; } return i;}
function goTo(i){const cs=cards(); if(!cs.length) return; i=Math.max(0,Math.min(cs.length-1,i)); cs[i].scrollIntoView({behavior:'smooth',block:'start'});}
function updatePos(){const bh=document.getElementById('bar').getBoundingClientRect().height; document.documentElement.style.setProperty('--barh',(bh+10)+'px'); const cs=cards(); const el=document.getElementById('pos'); if(el) el.textContent=cs.length?('Place '+(curIdx()+1)+' of '+cs.length):'';}
document.addEventListener('click',e=>{const b=e.target.closest('button'); if(!b||!b.dataset.nav) return; const cs=cards(); const i=curIdx(); const n=b.dataset.nav;
  if(n==='top') window.scrollTo({top:0,behavior:'smooth'}); else if(n==='prev') goTo(i-1); else if(n==='next') goTo(i+1); else if(n==='ten') goTo(i+10);
  else if(n==='nonote'){ for(let k=i+1;k<cs.length;k++){ const t=cs[k].querySelector('textarea'); if(t&&!t.value.trim()){goTo(k);return;} } }});
document.addEventListener('change',e=>{if(e.target.id==='jump'&&e.target.value){const el=document.getElementById('c-'+e.target.value); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); e.target.value='';}});
document.addEventListener('keydown',e=>{const t=e.target; if(t&&(t.tagName==='TEXTAREA'||t.tagName==='INPUT'||t.tagName==='SELECT')) return; if(e.key==='j'||e.key==='n') goTo(curIdx()+1); else if(e.key==='k'||e.key==='p') goTo(curIdx()-1);});
window.addEventListener('scroll',()=>{updatePos();},{passive:true});
const _render=render; render=function(){_render(); updatePos();};

render();
(async()=>{let db=null;try{db=await claude.use("db");}catch(e){} if(!db) return; col=db.collection("food_review");
 col.onSnapshot(s=>{s.docs.forEach(d=>{NOTES[d.id]=d.data();}); const a=document.activeElement; if(!(a&&(a.tagName==='TEXTAREA'||a.tagName==='INPUT'))) render();},()=>{});})();
</script>
'''
_n=sum(1 for c in data['cells'] if c.get('alt')); _e=sum(1 for c in data['cells'] if c.get('edited'))
page=page.replace('<b>68 have a clause alt</b>','<b>%d still have a clause alt</b>'%_n).replace('the other 41 already read','the other %d either already read'%(len(data['cells'])-_n))
page=page.replace('Month blurbs are untouched.</li></ul></div>','Month blurbs are untouched except where your notes asked for a change.</li><li><b>Your notes through Mexico City are applied</b> to %d cards (marked <i>your edit applied</i>): your rewritten overviews, the Hong Kong peak of 3.7, the Maui and Mauritius rewrites and the Banff clean-up of the glacier-water wording.</li></ul></div>'%_e)
open('wine_page.html','w').write(page); print(len(page))
import re
js=re.findall(r'<script>(.*?)</script>',page,flags=re.S)[-1]; open('/tmp/chk4.js','w').write(js)
