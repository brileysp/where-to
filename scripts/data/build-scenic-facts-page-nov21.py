# 21 Nov 2026: builds .cache/scenic-facts-21.html from scripts/data/scenic-facts-21-proposal-nov21.json (run build-scenic-facts-proposal-nov21.py first).
import json, html
d = json.load(open('scripts/data/scenic-facts-21-proposal-nov21.json'))
K = ['m','d','c','f','t','w','i','o','g','p']
LAB = {'m':'Mountains','d':'Deserts and canyons','c':'Coasts','f':'Forests','t':'Cities and villages','w':'Lakes, rivers and waterfalls','i':'Polar, glaciers and ice','o':'Iconic draw','g':'Beyond the icons','p':'Landscape photography'}
VA = {'roadside':'From the road or a viewpoint','short':'Short walks to lookouts','halfDay':'Half-day walks','longHike':'Long hikes','backcountry':'Backcountry trips with camping','airBoat':'From the air or a boat'}
e = html.escape
def va_diff(o, n):
    add = [VA[x] for x in n if x not in o]; rem = [VA[x] for x in o if x not in n]
    if not add and not rem: return '<span class="same">Unchanged: ' + e(', '.join(VA[x] for x in n)) + '</span>'
    out = []
    if add: out.append('<span class="up">Add: ' + e(', '.join(add)) + '</span>')
    if rem: out.append('<span class="dn">Remove: ' + e(', '.join(rem)) + '</span>')
    out.append('<span class="same">Result: ' + e(', '.join(VA[x] for x in n)) + '</span>')
    return '<br>'.join(out)
cards = []
for key, v in d.items():
    nchg = sum(1 for k in K if v['old'][k] != v['new'][k])
    rows = []
    for k in K:
        o, n = v['old'][k], v['new'][k]
        ch = o != n
        ov = '–' if o is None else o
        arrow = f'<b class="{"up" if (o is None or n > o) else "dn"}">{ov} → {n}</b>' if ch else f'<span class="same">{n} (kept)</span>'
        rows.append(f'<tr class="{"c" if ch else ""}"><td>{LAB[k]}</td><td class="n">{arrow}</td><td>{e(v["why"].get(k, "") if ch else "")}</td></tr>')
    srcs = ''.join(f'<li><a href="{e(s["u"])}" target="_blank" rel="noopener">{e(s["t"])}</a></li>' for s in v['sources'])
    verdict = f'<p class="verdict"><b>My read:</b> {e(v["verdict"])}</p>' if v['verdict'] else ''
    sig_same = v['sigOld'] == v['sigNew']
    cards.append(f'''<section class="card" id="{key}" data-n="{nchg}">
<h2>{e(v["label"])} <span class="tag">{nchg} rating{"s" if nchg!=1 else ""} change{"" if nchg!=1 else "s"}</span></h2>
<p class="scope"><b>Scope:</b> {e(v["scope"])}</p>{verdict}
<div class="tw"><table><thead><tr><th>Kind of landscape</th><th>Was → now</th><th>Why</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div>
<p><b>Ways to reach the best views:</b><br>{va_diff(v["vaOld"], v["vaNew"])}</p>
<p><b>Signature views</b><br><span class="was">Was: {e(v["sigOld"] or "(blank)")}</span><br><span class="now">Now: {e(v["sigNew"])}</span></p>
<p class="gaps"><b>What I could not confirm:</b> {e(v["gaps"])}</p>
<details><summary>Sources ({len(v["sources"])})</summary><ul>{srcs}</ul></details>
<div class="rul" data-id="{key}"><button data-c="ok">Approve</button><button data-c="chg">Approve with my changes</button><button data-c="hold">Hold, not yet</button></div>
<textarea data-n="{key}" rows="2" placeholder="Your note, or the number you want instead (for example: Lakes 9)"></textarea><div class="saved"></div>
</section>''')
total = sum(1 for v in d.values() for k in K if v['old'][k] != v['new'][k])
page = '''<title>Scenic Ratings Rebuild</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root{--bg:#faf8f4;--fg:#1f1d1a;--muted:#6b665e;--line:#e4dfd6;--card:#fff;--accent:#7a4a14;--up:#1f6b3a;--dn:#a23a2a;--hi:#e6f2e9;--hic:#2d6a3e;--warn:#fbf1d6;--warnc:#7a5600}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#171613;--fg:#ece8e1;--muted:#a09a90;--line:#3a372f;--card:#201f1b;--accent:#e5b36a;--up:#8fcf9f;--dn:#f0a595;--hi:#1d2e22;--hic:#8fcf9f;--warn:#34290f;--warnc:#e8c46a;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#171613;--fg:#ece8e1;--muted:#a09a90;--line:#3a372f;--card:#201f1b;--accent:#e5b36a;--up:#8fcf9f;--dn:#f0a595;--hi:#1d2e22;--hic:#8fcf9f;--warn:#34290f;--warnc:#e8c46a;color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--fg);font:15px/1.55 Georgia,serif;max-width:980px;margin:0 auto;padding-block:24px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font-size:28px;margin:0 0 6px;text-wrap:balance}h2{font-size:20px;margin:0 0 8px;text-wrap:balance}.sub{color:var(--muted);max-width:72ch}
.box{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px;margin:14px 0;font:14px/1.5 system-ui,sans-serif}.box h3{margin:0 0 6px;font:600 15px system-ui,sans-serif}.box ul,.box ol{margin:4px 0;padding-left:20px}.box li{margin:4px 0}
.box.warn{background:var(--warn);border-color:var(--warnc)}
.bar{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0;position:sticky;top:env(safe-area-inset-top,0px);background:var(--bg);padding:8px 0;z-index:5;border-bottom:1px solid var(--line);font-family:system-ui,sans-serif;align-items:center}
.bar button{border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:999px;padding:6px 14px;font:500 13px system-ui,sans-serif;cursor:pointer}.bar button[aria-pressed="true"]{background:var(--accent);color:var(--bg);border-color:var(--accent)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 18px;margin:16px 0;font:14px/1.5 system-ui,sans-serif}.card h2{font-family:Georgia,serif}
.tag{font:12px system-ui,sans-serif;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:2px 9px;margin-left:6px;white-space:nowrap}
.scope{color:var(--muted);margin:0 0 8px}.verdict{background:var(--hi);color:var(--fg);border-left:3px solid var(--hic);padding:6px 10px;margin:8px 0}
table{border-collapse:collapse;width:100%;font:13.5px/1.4 system-ui,sans-serif;min-width:560px}th,td{padding:5px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{font-weight:600;color:var(--muted);font-size:12px}td.n{font-variant-numeric:tabular-nums;white-space:nowrap}tr.c td{background:var(--warn)}.tw{overflow-x:auto}
.up{color:var(--up)}.dn{color:var(--dn)}.same{color:var(--muted)}.was{color:var(--muted)}.gaps{color:var(--muted)}
details{margin:8px 0}summary{cursor:pointer;color:var(--accent)}a{color:var(--accent)}
.rul{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.rul button{border:1px solid var(--line);background:transparent;color:var(--fg);border-radius:6px;padding:5px 12px;font:500 13px system-ui,sans-serif;cursor:pointer}.rul button[aria-pressed="true"]{background:var(--hi);color:var(--hic);border-color:var(--hic)}
textarea{width:100%;margin-top:8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);font:14px system-ui,sans-serif;padding:7px 10px}
.saved{font:12px system-ui,sans-serif;color:var(--muted);min-height:14px}
</style>
<h1>Scenic ratings rebuild: 21 widened places</h1>
<p class="sub">Each place below had its Scenic ratings written for a narrower place, before you confirmed its scope. For each one I searched the web (no Gemini, no cost), checked each rating against the confirmed scope, and wrote down what changes and why. Nothing is written to the live database until you tell me to. Changed ratings are highlighted. __TOTAL__ ratings change across the 21 places.</p>
<div class="box warn"><h3>Four things that need your call</h3><ol>
<li><b>Three ratings I raised to 10.</b> Banff &amp; Jasper lakes (Moraine Lake is the example we give for a 10 in that column), and El Chaltén &amp; El Calafate ice and iconic draw (Perito Moreno and the Southern Patagonian Ice Field are our example for a 10). Say if any should stay at 9.</li>
<li><b>Savanna has no column.</b> The Serengeti and Kruger are mostly plains, and none of the landscape columns rates plains. I have left it as a gap and carried them with the signature view. Adding a "Plains and savanna" column would be a bigger change (a chip and its questions), so I have not proposed it.</li>
<li><b>I added a 21st place.</b> Quebec City &amp; Montreal was not on the list of 20 I gave you, because its facts carry the current scope version. But it had mountains 0 and coasts 0 with Charlevoix and the Saguenay Fjord now in scope, so I included it.</li>
<li><b>What the source-checked flag will mean.</b> When you approve a place I will tick it for the ratings, ways to reach views and signature views only. Camera gear rules were not rechecked (they are unchanged), and I will say so beside the tick.</li></ol></div>
<div class="box"><h3>How much the search could confirm</h3><ul>
<li>Most signature views and the size and fame of the main sights are backed by the sources listed on each card.</li>
<li>For several places the search returned nothing on one or more anchors (for example Cambodia’s mountains and coast, Flores, Khao Sok, Piedmont’s Alps). Each card says which ratings are my judgement. I would not call those "source-checked" until you have looked at them.</li>
<li>Where sources disagree on a figure (heights, lengths, areas), I did not use the figure in any rating.</li></ul></div>
<div class="bar"><button data-f="all" aria-pressed="true">All 21</button><button data-f="big">Most changes first</button><button data-f="open">Not decided yet</button><span class="saved" id="cnt"></span></div>
<div id="list">__CARDS__</div>
<script>
const COLL="scenicFacts21_review";let col=null;const M={};
const lab={ok:"Approved",chg:"Approved with changes",hold:"On hold"};
function paint(){document.querySelectorAll('.card').forEach(c=>{const m=M[c.id]||{};c.querySelectorAll('.rul button').forEach(b=>b.setAttribute('aria-pressed',m.choice===b.dataset.c?'true':'false'));const ta=c.querySelector('textarea');if(ta&&document.activeElement!==ta&&m.note!==undefined)ta.value=m.note;});
 const n=Object.values(M).filter(x=>x.choice).length;document.getElementById('cnt').textContent=n+' of 21 decided';applyFilter();}
let F='all';function applyFilter(){const list=document.getElementById('list');const cs=[...list.children];
 if(F==='big')cs.sort((a,b)=>b.dataset.n-a.dataset.n); else cs.sort((a,b)=>cs0.indexOf(a)-cs0.indexOf(b));
 cs.forEach(c=>{list.appendChild(c);c.hidden=(F==='open'&&(M[c.id]||{}).choice);});}
const cs0=[...document.getElementById('list').children];
document.querySelector('.bar').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;F=b.dataset.f;document.querySelectorAll('.bar button').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));applyFilter();});
document.addEventListener('click',e=>{const b=e.target.closest('.rul button');if(!b)return;const i=b.closest('.rul').dataset.id;M[i]=Object.assign({},M[i]||{},{choice:b.dataset.c,at:new Date().toISOString()});if(col)col.doc(i).set(M[i]).catch(()=>{});paint();});
document.addEventListener('focusout',e=>{const t=e.target;if(!t.dataset||!t.dataset.n||t.tagName!=='TEXTAREA')return;const i=t.dataset.n;M[i]=Object.assign({},M[i]||{},{note:t.value,at:new Date().toISOString()});if(col)col.doc(i).set(M[i]).then(()=>{t.nextElementSibling.textContent='Saved';}).catch(()=>{});});
paint();
(async()=>{let db=null;try{db=await claude.use("db");}catch(e){}if(!db)return;col=db.collection(COLL);col.onSnapshot(s=>{s.docs.forEach(d=>{M[d.id]=d.data();});paint();},()=>{});})();
</script>'''
page = page.replace('__TOTAL__', str(total)).replace('__CARDS__', '\n'.join(cards))
open('.cache/scenic-facts-21.html', 'w').write(page)
print(len(page), 'bytes written')
