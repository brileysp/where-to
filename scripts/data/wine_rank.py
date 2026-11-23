import json,re
h=open('../naw/wine_page.html').read()
D=json.loads(re.search(r'const DATA=(\{.*?\});\nconst LAB',h,flags=re.S).group(1))
TL={'Country':'Countries','City':'Cities','Region':'Regions','State or province':'States and provinces','Island':'Islands','Coastal area':'Coastal areas','Park':'Parks','Wilderness':'Wilderness'}
MOVES={
'chicago':(8.4,"9.3 sat above Tokyo & Kyoto (8.9), Prague (8.4), Edinburgh (8.2) and London (8.1). Chicago is a major craft beer hub, but beer alone does not outrank Prague's beer culture or Tokyo's sake, whisky and beer. Gemini 9.3, our old 4.0."),
'puglia':(8.4,"9.3 put Puglia level with Chicago and above Tokyo & Kyoto, Barcelona and Sicily. Primitivo and Negroamaro make good reds, but the region is not in the class of Piedmont, Tuscany or Rioja. Gemini 9.0, our old 7.0."),
'andalucia':(8.8,"8.0 sat below Santorini (8.7) and Puglia. Andalucía is the home of sherry, one of the world's great fortified wines, plus Montilla-Moriles and Málaga sweet wines. Gemini scored it 9.0; our old 5.0 under-counts it."),
'ireland':(8.4,"7.8 sat below Edinburgh (8.2) and level with Vermont and Sardinia. Ireland has the Guinness Storehouse, the whiskey trail and a strong pub culture; it belongs with Prague, Vienna and Rome. Gemini 8.4, our old 2.0."),
'hudson-valley':(7.4,"8.1 put it level with Madeira, Lisbon, Queenstown and Nice. The evidence is moderate (wine 6, beer 7, spirits 6, whisky 2) and Gemini's 9.0 was generous. Gemini 9.0, our old 5.0."),
}
cells=[]
for c in D['cells']:
    m=re.search(r'\(wine (\S+), beer (\S+), spirits (\S+), whisky (\S+)\)',c.get('why',''))
    cols=[None if (not m or x=='None') else float(x) for x in (m.groups() if m else [None]*4)]
    cells.append({'id':c['id'],'name':c['name'],'type':TL.get(c['type'],c['type']),'peak':max(c['fin']),'low':min(c['fin']),'a':cols[0],'b':cols[1],'c':cols[2],'d':cols[3],'old':round(max(c['ours']),1),'gem':round(max(c['gem']),1),'mv':({'to':MOVES[c['id']][0],'why':MOVES[c['id']][1]} if c['id'] in MOVES else None)})
assert all(k in {c['id'] for c in cells} for k in MOVES)
page='''<title>Wine, Beer and Spirits Rank Check</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root{--bg:#faf8f4;--fg:#1f1d1a;--muted:#6b665e;--line:#e4dfd6;--card:#fff;--accent:#7a4a14;--hi:#e6f2e9;--hic:#2d6a3e;--warn:#fbf1d6;--warnc:#8a6100}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#171613;--fg:#ece8e1;--muted:#a09a90;--line:#3a372f;--card:#201f1b;--accent:#e5b36a;--hi:#1d2e22;--hic:#8fcf9f;--warn:#34290f;--warnc:#e8c46a;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#171613;--fg:#ece8e1;--muted:#a09a90;--line:#3a372f;--card:#201f1b;--accent:#e5b36a;--hi:#1d2e22;--hic:#8fcf9f;--warn:#34290f;--warnc:#e8c46a;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:15px/1.55 Georgia,serif;padding-block:24px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
main{max-width:920px;margin:0 auto}
h1{font-size:28px;margin:0 0 6px;text-wrap:balance}.sub{color:var(--muted);max-width:72ch}
.box{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px;margin:12px 0;font:14px/1.5 system-ui,sans-serif}.box h3{margin:0 0 6px;font:600 15px system-ui,sans-serif}.box ul{margin:4px 0;padding-left:20px}
.bar{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0;position:sticky;top:0;background:var(--bg);padding:8px 0;z-index:5;border-bottom:1px solid var(--line);font-family:system-ui,sans-serif}
.bar button{border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:999px;padding:6px 14px;font:500 13px system-ui,sans-serif;cursor:pointer}.bar button[aria-pressed="true"]{background:var(--accent);color:var(--bg);border-color:var(--accent)}
textarea{width:100%;box-sizing:border-box;margin-top:6px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);font:14px system-ui,sans-serif;padding:7px 10px}
.saved{font:12px system-ui,sans-serif;color:var(--muted);min-height:14px}
.rul{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;font-family:system-ui,sans-serif}.rul button{border:1px solid var(--line);background:transparent;color:var(--fg);border-radius:6px;padding:4px 12px;font:500 13px system-ui,sans-serif;cursor:pointer}.rul button[aria-pressed="true"]{background:var(--hi);color:var(--hic);border-color:var(--hic)}
table{border-collapse:collapse;width:100%;font:13.5px/1.4 system-ui,sans-serif}th,td{padding:5px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{font-weight:600;color:var(--muted);font-size:12px}td.n{font-variant-numeric:tabular-nums;white-space:nowrap}tr.mv td{background:var(--warn)}.tw{overflow-x:auto}.mvbox{margin:4px 0 8px;font:13px/1.45 system-ui,sans-serif}
</style>
<main>
<h1>Wine, Beer &amp; Spirits: rank check</h1>
<p class="sub">Wine, Beer &amp; Spirits is saved. These are the two rank checks: first each place against others of the same kind (cities with cities, regions with regions), then all 109 places in one list. I read both against our own columns (wine, beer, spirits and whisky, each 0 to 10, plus our old score and Gemini's). 5 moves are suggested, highlighted below. For each, press Accept or Decline and add a note, or put a number in the note if you want a different peak. Nothing changes until you tell me to apply them. A moved place keeps the shape of its seasonal curve and only its peak changes.</p>
<div class="box"><h3>What I looked for</h3><ul>
<li>Places far above or below others of their kind that have clearly more or less evidence behind them.</li>
<li>Places where Gemini's generous scale lifted a good but not great place level with the world's best (Chicago, Puglia, Hudson Valley), and places our old score under-counted (Andalucía, Ireland).</li>
<li>The top of the list in order: does it read like a plausible ranking of the world's wine, beer and spirits destinations?</li></ul></div>
<div class="bar" id="bar"></div>
<div id="out"></div>
</main>
<script>
const DATA=__DATA__;
const TYPES=['Cities','Regions','Countries','Islands','Coastal areas','Parks','States and provinces','Wilderness'];
let cur='kinds'; const NOTES={}; let col=null;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const id=p=>'wineSpirits__'+p.id; const v=x=>x==null?'-':x;
function row(p){const n=NOTES[id(p)]||{};const mv=p.mv;
  const m=mv?`<tr class="mv"><td colspan="9"><div class="mvbox"><b>Suggested: ${p.peak.toFixed(1)} to ${mv.to.toFixed(1)}.</b> ${esc(mv.why)}<div class="rul" data-id="${id(p)}"><button data-c="accept" aria-pressed="${n.choice==='accept'}">Accept</button><button data-c="decline" aria-pressed="${n.choice==='decline'}">Decline</button></div><textarea data-n="${id(p)}" rows="1" placeholder="Note">${esc(n.note||'')}</textarea><span class="saved"></span></div></td></tr>`:'';
  return `<tr class="${mv?'mv':''}"><td>${esc(p.name)}</td><td class="n"><b>${p.peak.toFixed(1)}</b></td><td class="n">${p.low.toFixed(1)}</td><td class="n">${v(p.a)}</td><td class="n">${v(p.b)}</td><td class="n">${v(p.c)}</td><td class="n">${v(p.d)}</td><td class="n">${p.old.toFixed(1)}</td><td class="n">${p.gem.toFixed(1)}</td></tr>`+m;}
const head='<tr><th>Place</th><th>Peak</th><th>Lowest</th><th>Wine</th><th>Beer</th><th>Spirits</th><th>Whisky</th><th>Old</th><th>Gemini</th></tr>';
function render(){
  document.getElementById('bar').innerHTML=`<button data-t="kinds" aria-pressed="${cur==='kinds'}">1. Within similar places</button><button data-t="all" aria-pressed="${cur==='all'}">2. All places</button>`;
  let h='';
  if(cur==='kinds'){
    h='<div class="box">Wine, Beer, Spirits and Whisky are our evidence columns (0 to 10); a dash means we have no column for that place. Old = our score before Gemini. Highlighted rows have a suggested move.</div>';
    for(const t of TYPES){const rows=DATA.filter(p=>p.type===t).sort((a,b)=>b.peak-a.peak||a.name.localeCompare(b.name)); if(!rows.length) continue;
      h+=`<h3 style="font:600 17px Georgia,serif;margin:22px 0 6px">${t} (${rows.length})</h3><div class="tw"><table>${head}${rows.map(p=>row(p)).join('')}</table></div>`;}
  } else {
    const after=DATA.map(p=>Object.assign({},p,{pk2:(p.mv&&NOTES[id(p)]&&NOTES[id(p)].choice==='decline')?p.peak:(p.mv?p.mv.to:p.peak)}));
    const top=DATA.slice().sort((a,b)=>b.peak-a.peak||a.name.localeCompare(b.name)).slice(0,40);
    const top2=after.slice().sort((a,b)=>b.pk2-a.pk2||a.name.localeCompare(b.name)).slice(0,40);
    h=`<div class="box"><h3>Reading all 109 together</h3><ul><li>The top reads right: Napa &amp; Sonoma and Champagne at 10.0, then Bordeaux, Piedmont, Rioja, Tuscany, the Douro, Georgia, Marlborough and Mendoza.</li><li>The Scottish Highlands at 9.5 now sit with Bavaria and Provence, after your note about whisky.</li><li>Chicago and Puglia at 9.3 are higher than the evidence supports; Andalucía (sherry) and Ireland are lower than theirs. The 5 moves fix those, and Hudson Valley comes down a little.</li><li>The bottom (Palau, Svalbard, Marrakech, Tierra del Fuego) is places where drinking is a small part of a visit, which looks right.</li></ul></div>
    <div class="tw"><table><tr><th>#</th><th>As saved</th><th>Peak</th><th>After accepted moves</th><th>Peak</th></tr>${top.map((p,k)=>`<tr><td class="n">${k+1}</td><td>${esc(p.name)}</td><td class="n">${p.peak.toFixed(1)}</td><td>${esc(top2[k].name)}</td><td class="n">${top2[k].pk2.toFixed(1)}</td></tr>`).join('')}</table></div>
    <h3 style="font:600 17px Georgia,serif;margin:22px 0 6px">All 109, highest first</h3><div class="tw"><table>${head}${DATA.slice().sort((a,b)=>b.peak-a.peak||a.name.localeCompare(b.name)).map(p=>row(p)).join('')}</table></div>`;
  }
  document.getElementById('out').innerHTML=h;}
document.addEventListener('click',e=>{const b=e.target.closest('button'); if(!b) return; if(b.dataset.t){cur=b.dataset.t;render();window.scrollTo(0,0);return;}
  if(b.dataset.c){const i=b.closest('.rul').dataset.id; NOTES[i]=Object.assign({},NOTES[i]||{},{choice:b.dataset.c,at:new Date().toISOString()}); if(col) col.doc(i).set(NOTES[i]).catch(()=>{}); render();}});
document.addEventListener('focusout',e=>{const t=e.target; if(!t.dataset||!t.dataset.n) return; const i=t.dataset.n; NOTES[i]=Object.assign({},NOTES[i]||{},{note:t.value,at:new Date().toISOString()}); if(col) col.doc(i).set(NOTES[i]).then(()=>{if(t.nextElementSibling)t.nextElementSibling.textContent='Saved';}).catch(()=>{});});
render();
(async()=>{let db=null;try{db=await claude.use("db");}catch(e){} if(!db) return; col=db.collection("wine_rank");
 col.onSnapshot(s=>{s.docs.forEach(d=>{NOTES[d.id]=d.data();}); const a=document.activeElement; if(!(a&&(a.tagName==='TEXTAREA'||a.tagName==='INPUT'))) render();},()=>{});})();
</script>
'''
open('wine_rank.html','w').write(page.replace('__DATA__',json.dumps(cells,ensure_ascii=False)))
print(len(cells),len(MOVES))
