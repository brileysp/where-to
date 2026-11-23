# 9 Nov 2026: builds the review page for the Museums & Art + Architecture wording cleanup (before / after, changed words in blue).
import json,re,difflib,html
INP={(c['k'],c['id']):c for c in json.load(open('scripts/data/museums-arch-cleanup-input-nov9.json'))}
OUT=json.load(open('scripts/data/museums-arch-cleaned-nov9.json')); PK=json.load(open('scripts/data/museums-arch-peaks-nov9.json'))
def tier(p): return (280,180) if p<4 else (380,260) if p<6 else (450,320) if p<8.5 else (550,326)
def tok(s): return re.findall(r'\s+|[^\s]+',s)
def diff_after(a,b):
    A=tok(a); B=tok(b); sm=difflib.SequenceMatcher(None,A,B,autojunk=False); out=''
    for op,i1,i2,j1,j2 in sm.get_opcodes():
        seg=''.join(B[j1:j2])
        if op=='equal': out+=html.escape(seg)
        elif op in('replace','insert') and seg.strip(): out+='<span class="chg">'+html.escape(seg)+'</span>'
        elif op in('replace','insert'): out+=html.escape(seg)
    return out
cells=[]
for r in OUT:
    k,i=r['k'],r['id']; c=INP[(k,i)]; g=c['gemini']; j=r['cleaned']; om,bm=tier(PK[f'{k}|{i}'])
    old=[('Overview',g['overview'],om)]+[('Blurb, '+('all months' if len(b['months'])==12 else ', '.join(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1] for m in sorted(b['months']))),b['text'],bm) for b in g['blurbs']]
    new=[j['overview']]+[(b if isinstance(b,str) else b['text']) for b in j['blurbs']]
    items=[]
    for (lab,o,lim),n in zip(old,new):
        if o==n: continue
        items.append({'lab':lab,'old':html.escape(o),'new':diff_after(o,n),'ol':len(o),'nl':len(n),'lim':lim,'newover':len(n)>lim and len(o)<=lim,'longer':len(n)>len(o)})
    if items: cells.append({'k':k,'id':i,'name':c['name'],'lab':'Museums & Art' if k=='museumsArt' else 'Architecture','rules':r['rules'],'items':items})
cells.sort(key=lambda c:(c['k'],c['name']))
page='''<title>Wording Cleanup Review</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root{--bg:#faf8f4;--fg:#1f1d1a;--muted:#6b665e;--line:#e4dfd6;--card:#fff;--accent:#7a4a14;--hi:#e6f2e9;--hic:#2d6a3e;--warn:#fbf1d6;--warnc:#8a6100;--chg:#2c5d9b}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#171613;--fg:#ece8e1;--muted:#a09a90;--line:#3a372f;--card:#201f1b;--accent:#e5b36a;--hi:#1d2e22;--hic:#8fcf9f;--warn:#34290f;--warnc:#e8c46a;--chg:#8db8f0;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#171613;--fg:#ece8e1;--muted:#a09a90;--line:#3a372f;--card:#201f1b;--accent:#e5b36a;--hi:#1d2e22;--hic:#8fcf9f;--warn:#34290f;--warnc:#e8c46a;--chg:#8db8f0;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:15px/1.55 Georgia,serif;padding-block:24px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
main{max-width:1000px;margin:0 auto}h1{font-size:28px;margin:0 0 6px;text-wrap:balance}.sub{color:var(--muted);max-width:74ch}
.box{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px;margin:12px 0;font:14px/1.5 system-ui,sans-serif}.box h3{margin:0 0 6px;font:600 15px system-ui,sans-serif}.box ul{margin:4px 0;padding-left:20px}
.bar{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0;position:sticky;top:0;background:var(--bg);padding:8px 0;z-index:5;border-bottom:1px solid var(--line);font-family:system-ui,sans-serif;align-items:center}
.bar button{border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:999px;padding:6px 14px;font:500 13px system-ui,sans-serif;cursor:pointer}.bar button[aria-pressed="true"]{background:var(--accent);color:var(--bg);border-color:var(--accent)}
.bar input,.bar select{padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--fg);font:13px system-ui,sans-serif;min-width:0}
.nav,.filt{display:flex;flex-wrap:wrap;gap:8px;align-items:center;width:100%}.pos{font:13px system-ui,sans-serif;color:var(--muted);margin-left:auto}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:12px 0;min-width:0;scroll-margin-top:var(--barh,120px)}.card h2{font-size:18px;margin:0 0 2px}
.tag{font:600 12px system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:var(--accent)}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0}@media(max-width:700px){.pair{grid-template-columns:1fr}}
.col{border:1px solid var(--line);border-radius:8px;padding:8px 12px;min-width:0}.col.new{background:var(--hi)}.lab{font:600 12px system-ui,sans-serif;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}.col p{margin:6px 0}.len{font:12.5px system-ui,sans-serif;color:var(--muted)}.over{color:var(--warnc);font-weight:600}
.chg{color:var(--chg);font-weight:600}
.rul{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;font-family:system-ui,sans-serif;align-items:center}.rul button{border:1px solid var(--line);background:transparent;color:var(--fg);border-radius:6px;padding:4px 12px;font:500 13px system-ui,sans-serif;cursor:pointer}.rul button[aria-pressed="true"]{background:var(--warn);color:var(--warnc);border-color:var(--warnc)}
textarea{width:100%;box-sizing:border-box;margin-top:6px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);font:14px system-ui,sans-serif;padding:7px 10px}.saved{font:12px system-ui,sans-serif;color:var(--muted)}
</style>
<main>
<h1>Wording cleanup: Museums &amp; Art and Architecture</h1>
<p class="sub">__N__ places have at least one text changed (__T__ texts in all). The cleanup pass (Gemini Flash, thinking at its lowest, cost $0.22) was told to fix only the listed wording rules and change nothing else. Nothing is saved yet. The original is on the left; the cleaned text on the right shows each changed word in blue. If you do nothing, every change is saved. Press <b>Keep the original</b> on any card you want left alone.</p>
<div class="box"><h3>What was checked automatically</h3><ul>
<li>Every cleaned text still has the same blurbs for the same months. No cell failed to return.</li>
<li>None of the rule words are left in a text that was flagged for them: "offer", "year-round" and similar filler, promotional words, contrast framings.</li>
<li>No text got meaningfully longer. 15 got a few characters longer; two now sit just over the maximum for their score (shown in amber): El Chaltén Museums by 1 character and Vancouver &amp; Whistler Museums by 6.</li>
<li>No new place or museum names appeared (the only new capitalized words are the first words of rewritten sentences).</li>
<li>This pass does not fix facts and does not apply the newer structure rules (biggest draw first, one topic per sentence). It also leaves museum and building names alone, since those are allowed here.</li></ul></div>
<div class="bar" id="bar"></div>
<div id="out"></div>
</main>
<script>
const DATA=__DATA__;
let cur={k:'all',q:'',over:false,keep:false}; const NOTES={}; let col=null;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const key=c=>c.k+'__'+c.id;
function card(c){const n=NOTES[key(c)]||{};
 return `<section class="card" id="c-${key(c)}"><div class="tag">${esc(c.lab)}</div><h2>${esc(c.name)}</h2><div class="len">Rules fixed: ${c.rules.join(', ')}</div>
 ${c.items.map(it=>`<div class="lab" style="margin-top:8px">${esc(it.lab)}</div><div class="pair"><div class="col"><div class="lab">Original</div><p>${it.old}</p><div class="len">${it.ol} characters</div></div><div class="col new"><div class="lab">Cleaned</div><p>${it.new}</p><div class="len">${it.newover?'<span class="over">':''}${it.nl} / ${it.lim} characters${it.newover?'</span>':''}</div></div></div>`).join('')}
 <div class="rul" data-id="${key(c)}"><button data-keep="1" aria-pressed="${!!n.keep}">Keep the original</button><span class="saved">${n.keep?'The original will be kept for this place.':'The cleaned text will be saved.'}</span></div>
 <textarea data-n="${key(c)}" rows="1" placeholder="Note">${esc(n.note||'')}</textarea></section>`;}
function render(){
 document.getElementById('bar').innerHTML=`<div class="nav"><button data-nav="top">&uarr; Top</button><button data-nav="prev">&laquo; Previous</button><button data-nav="next">Next &raquo;</button><button data-nav="ten">+10 &raquo;&raquo;</button><button data-nav="nonote">Next without a note</button><span class="pos" id="pos"></span></div><div class="filt"><button data-k="all" aria-pressed="${cur.k==='all'}">Both (${DATA.length})</button><button data-k="museumsArt" aria-pressed="${cur.k==='museumsArt'}">Museums &amp; Art (${DATA.filter(c=>c.k==='museumsArt').length})</button><button data-k="architecture" aria-pressed="${cur.k==='architecture'}">Architecture (${DATA.filter(c=>c.k==='architecture').length})</button><button data-o="1" aria-pressed="${cur.over}">Over the max now</button><button data-keepf="1" aria-pressed="${cur.keep}">Kept as original</button><input id="q" placeholder="Search a place" value="${esc(cur.q)}"></div>`;
 let rows=DATA.filter(c=>(cur.k==='all'||c.k===cur.k)&&(!cur.q||c.name.toLowerCase().includes(cur.q.toLowerCase()))&&(!cur.over||c.items.some(i=>i.newover))&&(!cur.keep||(NOTES[key(c)]||{}).keep));
 document.getElementById('out').innerHTML=`<p class="len">${rows.length} places</p>`+rows.map(card).join('');}
function cards(){return Array.from(document.querySelectorAll('#out section.card'));}
function curIdx(){const cs=cards(); const y=document.getElementById('bar').getBoundingClientRect().height+8; let i=0; for(let k=0;k<cs.length;k++){ if(cs[k].getBoundingClientRect().top-y<=8) i=k; else break; } return i;}
function goTo(i){const cs=cards(); if(!cs.length) return; i=Math.max(0,Math.min(cs.length-1,i)); cs[i].scrollIntoView({behavior:'smooth',block:'start'});}
function updatePos(){const bh=document.getElementById('bar').getBoundingClientRect().height; document.documentElement.style.setProperty('--barh',(bh+10)+'px'); const cs=cards(); const el=document.getElementById('pos'); if(el) el.textContent=cs.length?('Place '+(curIdx()+1)+' of '+cs.length):'';}
document.addEventListener('click',e=>{const b=e.target.closest('button'); if(!b) return;
 if(b.dataset.nav){const cs=cards(); const i=curIdx(); const n=b.dataset.nav; if(n==='top') window.scrollTo({top:0,behavior:'smooth'}); else if(n==='prev') goTo(i-1); else if(n==='next') goTo(i+1); else if(n==='ten') goTo(i+10); else if(n==='nonote'){for(let k=i+1;k<cs.length;k++){const t=cs[k].querySelector('textarea'); if(t&&!t.value.trim()){goTo(k);return;}}} return;}
 if(b.dataset.k){cur.k=b.dataset.k;render();updatePos();window.scrollTo(0,0);return;} if(b.dataset.o){cur.over=!cur.over;render();updatePos();return;} if(b.dataset.keepf){cur.keep=!cur.keep;render();updatePos();return;}
 if(b.dataset.keep){const id=b.closest('.rul').dataset.id; const on=!(NOTES[id]||{}).keep; NOTES[id]=Object.assign({},NOTES[id]||{},{keep:on,at:new Date().toISOString()}); if(col) col.doc(id).set(NOTES[id]).catch(()=>{}); render();updatePos();}});
document.addEventListener('input',e=>{if(e.target.id==='q'){cur.q=e.target.value;const p=e.target.selectionStart;render();updatePos();const q=document.getElementById('q');q.focus();q.setSelectionRange(p,p);}});
document.addEventListener('focusout',e=>{const t=e.target; if(!t.dataset||!t.dataset.n) return; const id=t.dataset.n; NOTES[id]=Object.assign({},NOTES[id]||{},{note:t.value,at:new Date().toISOString()}); if(col) col.doc(id).set(NOTES[id]).then(()=>{if(t.nextElementSibling)t.nextElementSibling.textContent=' Saved';}).catch(()=>{});});
document.addEventListener('keydown',e=>{const t=e.target; if(t&&(t.tagName==='TEXTAREA'||t.tagName==='INPUT'||t.tagName==='SELECT')) return; if(e.key==='j'||e.key==='n') goTo(curIdx()+1); else if(e.key==='k'||e.key==='p') goTo(curIdx()-1);});
window.addEventListener('scroll',updatePos,{passive:true});
render();updatePos();
(async()=>{let db=null;try{db=await claude.use("db");}catch(e){} if(!db) return; col=db.collection("sweep_review");
 col.onSnapshot(s=>{s.docs.forEach(d=>{NOTES[d.id]=d.data();}); const a=document.activeElement; if(!(a&&(a.tagName==='TEXTAREA'||a.tagName==='INPUT'))){render();updatePos();}},()=>{});})();
</script>
'''
T=sum(len(c['items']) for c in cells)
open('wording_cleanup_review.html','w').write(page.replace('__DATA__',json.dumps(cells,ensure_ascii=False)).replace('__N__',str(len(cells))).replace('__T__',str(T)))
print(len(cells),T)
