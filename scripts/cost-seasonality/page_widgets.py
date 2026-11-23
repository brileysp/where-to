import json,html
ROOT='/Users/brendansalant-pearce/Desktop/Claude Code/where-to-app/'
D=json.load(open(ROOT+'.cache/cost-seasonality-drafts.json'))
MN='Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split()
mid=[15.5,45,74.5,105,135.5,166,196.5,227.5,258,288.5,319,349.5]

def level(b):
    if b<1.12: return ('Flat',0)
    if b<1.31: return ('Mild',1)
    if b<1.63: return ('Moderate',2)
    if b<2.03: return ('High',3)
    return ('Extreme',4)
def dots(k):
    return '<svg class="ic" width="42" height="10" viewBox="0 0 42 10" aria-hidden="true">'+''.join(f'<circle cx="{4+j*8.5:.1f}" cy="5" r="3.2" fill="currentColor" fill-opacity="{1 if j<=k else .22}"/>' for j in range(5))+'</svg>'
KEY='Flat: under 1.1x. Mild: up to 1.3x. Moderate: up to 1.6x. High: up to 2x. Extreme: over 2x. This is how much more many hotels cost in the priciest months than in the cheapest.'
def chart(d):
    w=[x for x in d['weeks']]; vals=[x for x in w if x is not None]; mx=max(vals)
    n=len(vals); avg=sum(v for k,v in enumerate(w) if v is not None and not (d['hol'] and k in (0,51)))/max(1,(n-(2 if d['hol'] else 0)))
    ptset=set(d.get('pt',[]))
    bars=''.join(('<i class="cl"></i>' if x is None else f'<i class="{"pt" if k in ptset else ""}" style="height:{max(3,round(x/mx*100))}%"></i>') for k,x in enumerate(w))
    runs=[];s=None
    for k,x in enumerate(w+[1]):
        if x is None and s is None: s=k
        if x is not None and s is not None: runs.append((s,k)); s=None
    lab=''.join(f'<span class="clab" style="left:{a/52*100:.1f}%;width:{(b-a)/52*100:.1f}%">closed</span>' for a,b in runs if b-a>=7)
    ax=''.join(f'<span style="left:{mid[i]/365*100:.1f}%">{MN[i][0]}</span>' for i in range(12))
    return f'<div class="up52"><div class="typ" style="bottom:{round(avg/mx*100)}%"></div>{bars}</div><div class="ax">{ax}</div><div class="lg"><i></i>average price</div>'
BK={x['id']:x for x in json.load(open(ROOT+'.cache/cost-seasonality-drafts-before-compare2.json'))}
nchg=0
cards=''
for d in D:
    tags=[]
    if d['hol']: tags.append('xmas')
    if d['closed']: tags.append('closed')
    tags.append('reviewed' if d.get('reviewed') else 'unreviewed')
    if d.get('events'): tags.append('event')
    if d.get('pt'): tags.append('partly')
    if d['flat']: tags.append('barelychange')
    if d['special']: tags.append('rough')
    if d['check']: tags.append('check')
    lvl=level(d['best'])
    if d.get('badge'): lvl=({'Flat':0,'Mild':1,'Moderate':2,'High':3,'Extreme':4}[d['badge']] and (d['badge'],0)) or (d['badge'],0)
    tags.append(lvl[0].lower())
    chips=''
    was=BK.get(d['id'],{}).get('sent')
    if was and was!=d['sent']: tags.append('changed'); nchg+=1; chips+='<span class="chip warn">changed in the compare check</span>'
    if d.get('reviewed'): chips+='<span class="chip">reviewed</span>'
    if d.get('eventtext'): chips+='<span class="chip">event named in text</span>'
    if d.get('events'): chips+='<span class="chip">event spike added</span>'
    if d.get('reworded'): chips+='<span class="chip">reworded by the new rules</span>'
    if d.get('edited'): chips+='<span class="chip">your edit</span>'
    if d.get('pt'): chips+='<span class="chip warn">some hotels closed: check</span>'
    if d['check']: chips+='<span class="chip warn">wording to check</span>'
    if d['special']: chips+='<span class="chip">rough shape</span>'
    if d['renamed']: chips+='<span class="chip">one town sampled</span>'
    meta=f'{d["tier"]} · estimate {d["best"]:g}x · {html.escape(d["src"])}'
    if d['area']: meta+=f' · hotels sampled: {html.escape(d["area"])}'
    note=f'<div class="spnote">{html.escape(d["special"])}</div>' if d['special'] else ''
    if was and was!=d['sent']: note+=f'<div class="spnote"><b>Before the compare check:</b> {html.escape(was)}</div>'
    cards+=(f'<article class="pl" data-name="{html.escape(d["name"].lower())}" data-tier="{d["tier"]}" data-tags="{" ".join(tags)}">'
            f'<h3>{html.escape(d["name"])}</h3><div class="meta">{meta}</div>{chips and f"<div class=chips>{chips}</div>"}'
            f'<div class="detail-card"><div class="trow"><div class="detail-section-title">Cost seasonality</div><span class="lvl">{lvl[0]}</span><button type="button" class="ib" aria-label="What do these words mean?">i</button></div><div class="key" hidden>{KEY}</div><p class="addtxt">{html.escape(d["sent"])}</p>{chart(d)}</div>{note}<label class="nb">Your comment<textarea data-note="{d["id"]}" rows="2" placeholder="Comment on {html.escape(d["name"])}"></textarea></label></article>')
n=len(D); nx=sum(1 for d in D if d['hol']); nf=sum(1 for d in D if d['flat']); nc=sum(1 for d in D if d['closed']); nr=sum(1 for d in D if d['special']); nk=sum(1 for d in D if d['check']); npc=sum(1 for d in D if d.get('pt'))
tiers={t:sum(1 for d in D if d['tier']==t) for t in ('Very reliable','Reliable','Fair')}
SCRIPT='<script>\n(function(){\nvar f=\'all\',q=\'\';var cards=[].slice.call(document.querySelectorAll(\'.pl\'));\nfunction go(){var n=0;cards.forEach(function(c){var ok=(f===\'all\'||c.dataset.tags.split(\' \').indexOf(f)>-1)&&c.dataset.name.indexOf(q)>-1;c.hidden=!ok;if(ok)n++;});document.getElementById(\'count\').textContent=n+\' of \'+cards.length;}\ndocument.getElementById(\'q\').addEventListener(\'input\',function(e){q=e.target.value.toLowerCase();go();});\n[].forEach.call(document.querySelectorAll(\'.fb\'),function(b){b.addEventListener(\'click\',function(){f=b.dataset.f;[].forEach.call(document.querySelectorAll(\'.fb\'),function(x){x.setAttribute(\'aria-pressed\',x===b?\'true\':\'false\');});go();});});\nfunction tag(c,on){var t=c.dataset.tags.split(\' \').filter(function(x){return x&&x!==\'commented\';});if(on)t.push(\'commented\');c.dataset.tags=t.join(\' \');}\nvar COLL="cost_seasonality_notes",col=null,S={},timers={};\ndocument.addEventListener("input",function(e){var t=e.target;if(!t.dataset||!t.dataset.note)return;var id=t.dataset.note;tag(t.closest(\'.pl\'),!!t.value.trim());S[id]={text:t.value,at:new Date().toISOString()};clearTimeout(timers[id]);timers[id]=setTimeout(function(){if(col)col.doc(id).set(S[id]).catch(function(){});},500);go();});\n(async function(){var db=null;try{db=await claude.use("db");}catch(e){}if(!db)return;col=db.collection(COLL);\ncol.onSnapshot(function(s){s.docs.forEach(function(d){S[d.id]=d.data();var ta=document.querySelector(\'[data-note="\'+d.id+\'"]\');if(ta){if(document.activeElement!==ta)ta.value=d.data().text||"";tag(ta.closest(\'.pl\'),!!(d.data().text||"").trim());}});go();},function(){});})();\ndocument.addEventListener(\'click\',function(e){var b=e.target.closest&&e.target.closest(\'.ib\');if(!b)return;var k=b.closest(\'.detail-card\').querySelector(\'.key\');var on=k.hidden;k.hidden=!on;b.setAttribute(\'aria-expanded\',on?\'true\':\'false\');});\ngo();\n})();\n</script>'
page=f"""<title>Cost seasonality drafts</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root{{--page:#efece6;--page-fg:#21201d;--page-mut:#5a5650;--bg:#f6f4f1;--bg-elevated:#ffffff;--border:#e3ddd4;--text:#21201d;--text-dim:#5a5650;--text-faint:#8b867d;--accent:#c76a35;--price:#3f5fd0;--warn:#a8741a}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--page:#0b0f10;--page-fg:#eef2f3;--page-mut:#9fb0b5;--bg:#0f1416;--bg-elevated:#161d21;--border:#2a3438;--text:#eef2f3;--text-dim:#9fb0b5;--text-faint:#6d7c80;--accent:#e8935a;--price:#8ea3ff;--warn:#d8b45c;color-scheme:dark}}}}
:root[data-theme="dark"]{{--page:#0b0f10;--page-fg:#eef2f3;--page-mut:#9fb0b5;--bg:#0f1416;--bg-elevated:#161d21;--border:#2a3438;--text:#eef2f3;--text-dim:#9fb0b5;--text-faint:#6d7c80;--accent:#e8935a;--price:#8ea3ff;--warn:#d8b45c;color-scheme:dark}}
body{{background:var(--page);color:var(--page-fg);font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;margin:0;padding-block:28px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}}
main{{max-width:1320px;margin:0 auto;display:flex;flex-direction:column;gap:20px}}
h1{{font-size:26px;margin:0 0 6px}} p{{margin:0 0 8px;max-width:78ch}} .lede{{color:var(--page-mut)}}
.rules{{background:var(--bg-elevated);border:1px solid var(--border);border-radius:10px;padding:12px 16px;font-size:13.5px;color:var(--page-mut)}} .rules b{{color:var(--page-fg)}} .rules ul{{margin:6px 0 0;padding-left:20px}} .rules li{{margin-bottom:3px}}
.ctl{{display:flex;flex-wrap:wrap;gap:8px;align-items:center;position:sticky;top:env(safe-area-inset-top,0px);background:var(--page);padding:8px 0;z-index:5}}
.ctl input{{flex:1 1 220px;min-width:0;font:inherit;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg-elevated);color:var(--page-fg)}}
.fb{{font:inherit;font-size:13px;padding:6px 11px;border-radius:999px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--page-fg);cursor:pointer}} .fb[aria-pressed=true]{{background:var(--accent);border-color:var(--accent);color:#fff}}
#count{{font-size:13px;color:var(--page-mut)}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:18px}}
.pl{{background:var(--bg);border:1px solid var(--border);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;min-width:0}} .pl[hidden]{{display:none}}
.pl h3{{font-size:15px;margin:0}} .meta{{font-size:11.5px;color:var(--page-mut);line-height:1.4}}
.chips{{display:flex;flex-wrap:wrap;gap:5px}} .chip{{font-size:10.5px;padding:1px 8px;border-radius:999px;border:1px solid var(--border);color:var(--page-mut)}} .chip.warn{{border-color:var(--warn);color:var(--warn)}}
.detail-card{{background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:14px;color:var(--text)}}
.detail-section-title{{font-size:11px;font-weight:700;margin:0 0 8px}}
.addtxt{{font-size:13px;line-height:1.6;color:var(--text-dim);margin:0 0 12px}}
.up52{{position:relative;display:flex;align-items:flex-end;gap:1.5px;height:54px;border-bottom:1px solid var(--border)}} .up52 i{{flex:1;border-radius:2px 2px 0 0;background:var(--price)}}
.up52 i.pt{{opacity:.38}}
.up52 i.cl{{background:repeating-linear-gradient(135deg,var(--text-faint) 0 1.5px,transparent 1.5px 4px);opacity:.55;height:9px!important;border-radius:1px}}
.clab{{position:absolute;bottom:14px;text-align:center;font-size:10px;font-style:italic;color:var(--text-faint);pointer-events:none}}
.typ{{position:absolute;left:0;right:0;border-top:1px dashed var(--text-faint);height:0;pointer-events:none}} .lg{{display:flex;align-items:center;justify-content:flex-end;gap:5px;font-size:9px;color:var(--text-faint);margin-top:2px}} .lg i{{display:inline-block;width:16px;border-top:1px dashed var(--text-faint)}}
.ax{{position:relative;height:16px;margin-top:3px}} .ax span{{position:absolute;transform:translateX(-50%);font-size:9px;color:var(--text-faint)}}
.nb{{display:block;font-size:12px;font-weight:600;color:var(--page-mut)}} .nb textarea{{display:block;width:100%;box-sizing:border-box;margin-top:4px;font:14px system-ui,sans-serif;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--bg-elevated);color:var(--page-fg);resize:vertical}}
.trow{{display:flex;align-items:center;gap:8px;margin-bottom:8px}} .trow .detail-section-title{{margin:0;flex:1}}
.lvl{{font-size:11px;font-weight:700;color:var(--text)}}
.ib{{width:18px;height:18px;padding:0;border-radius:50%;border:1.5px solid currentColor;background:none;color:var(--text-faint);font-size:10px;font-weight:700;font-style:italic;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer}} .ib[aria-expanded=true]{{color:var(--accent);border-color:var(--accent)}}
.key{{font-size:11px;color:var(--text-faint);line-height:1.6;background:rgba(127,127,127,.08);border-radius:10px;padding:10px 12px;margin-bottom:10px}} .key[hidden]{{display:none}}
.spnote{{font-size:11.5px;color:var(--page-mut);font-style:italic}}
</style>
<main>
<header><h1>Cost seasonality: drafts for all {n} places</h1>
<p class=lede>Every place scored Fair or above ({tiers['Very reliable']} very reliable, {tiers['Reliable']} reliable, {tiers['Fair']} fair), in the card as it would sit at the bottom of the costs tab. The small grey line above each card (tier, our estimate, source and where the hotels were sampled) is for you and would not be in the app.</p></header>
<div class=rules><b>Decisions so far</b>
<ul><li><b>Badge.</b> One word at the top right of the card, in the same font as the "Cost seasonality" title: Flat (estimate under 1.1x), Mild (up to 1.3x), Moderate (up to 1.6x), High (up to 2x), Extreme (over 2x). The "i" opens that key.</li>
<li><b>Chart and words agree.</b> The ratio in every sentence is the average of the peak months against the average of the months it names as the comparison ("the rest of the year" means every other month), and the badge follows that same ratio. On 18 Nov every blurb was checked against its chart: the ratio, the months named as peaks, the late-December rise, closures and events. Where they disagreed the chart's data decided, and the changed cards carry a "changed in the compare check" tag with the old sentence shown. The old reviewed numbers (such as Banff 3x) were peak month against the single cheapest month, which overstated a comparison with the rest of the year. Shapes come from the earlier index unless it was clearly off, in which case a same-hotel index is used (Bhutan, Death Valley, El Chaltén and a few more).</li>
<li><b>Chart.</b> 52 weekly bars in one colour, a dashed line for the average price with a small "average price" key at the bottom right. No labels on the chart itself; the sentence explains anything unusual.</li>
<li><b>Closures.</b> 25% or fewer of hotels open: closed, drawn as hatched stubs, sentence "Most hotels close from…". 25 to 75% open: <b>faded bars</b>, sentence "About a third / Roughly half / About two thirds of hotels close from…". More than 75% open: normal, nothing said. Closure is inferred from how many hotels Booking.com listed in low-price months (January to September and December; October and November are not judged because Booking's furthest dates are thin), so every place with faded bars carries an amber "check" tag ({npc} places). Amalfi, Ladakh and Denali were already known closures. For safari places the closure share comes from the lodge rate cards (a month with no published rate): South Luangwa is the clear case, with about 60% of its lodges closed from January to March. Checked on 18 Nov: Northern Tanzania really does lose about 30% of its camps in April (Asilia's own guide lists Ubuntu, Olakira and Sayari as closed April and May, matching our gaps), so April is drawn faded with a closure sentence. The gaps for Namibia, Rwanda, Uganda and Kruger are rate-sheet date windows, not closures (they include city hotels in Windhoek and Virunga Lodge), so nothing is said for them. Hwange and the Maasai Mara sit just under the 25% line (about 24% and 20%) and are not marked.</li>
<li><b>Sentence rules.</b> "Prices peak from July to September, with many hotels costing about 2x as much as in winter months" is used only where the peak is clear (about 1.6x or more, peak months about 1.3x the rest, six months at most, or two clear peaks such as spring and fall). Weaker shapes keep "Many hotels cost about 1.4x as much in March as in the rest of the year". Ratios round to whole or half steps (3.6x reads 3.5x). A big holiday jump joins the sentence ("and prices spike around the winter holidays"); a smaller one gets its own ("Prices also jump…", "Prices also increase a bit…"). Flat places: 10% or less "barely change from month to month", 11 to 20% "a slight rise" (dips keep the number). A single cheap month in a clearly seasonal place gives a range ("2x to 3x") against the shoulder months. "Winter months" is not used when a peak month falls in November to March, and "spring and fall" only when the whole seasons support the number; otherwise the months are named. A separate two-month high season (such as January and February in the Argentine Lake District) is named as a peak. Closed seasons come last ("Most hotels close from December to March."); partly closed goes last too. Obvious typos are fixed without asking.</li>
<li><b>Chart.</b> The late-December rise is drawn at the size measured against the surrounding months, and the sentence mentions it whenever it is 1.3x or more (a December peak no longer hides a separate holiday spike). Smaller rises are drawn but not mentioned. Event spikes are drawn and named in the sentence where our own same-hotel quotes show them: Oktoberfest (Munich), the Sturgis rally (Badlands and Black Hills), Singapore's Grand Prix weekend, Tokyo and Kyoto's cherry blossom weeks, Rio's Carnival and New Orleans' Mardi Gras. The Cannes festival is drawn at 3x on the Nice and Riviera chart and the sentence says the rise is in Cannes (about 4x there), because the Nice hotels we sampled did not move. Coachella is drawn at 2x on both weekends and the sentence says most hotels sell out.</li>
<li><b>Weeks.</b> The weekly shape is the monthly curve smoothed across 52 weeks, stretched so its high-to-low ratio matches our estimate. Only the New Year bars carry week-level measurement.</li></ul>
<p style="margin-top:8px"><b>Read these first:</b> {nk} places carry an amber "wording to check" tag, where the cheapest months sit next to the peak or the shape has two peaks. {nr} have a rough shape (Denali, Hokkaido, Istanbul and a flat-curve fallback). Places in the "one town sampled" group cover a wider area than the hotels were in.</p></div>
<div class=ctl><input id=q type=search placeholder="Search a place" aria-label="Search a place"><button class=fb data-f="all" aria-pressed="true">All</button><button class=fb data-f="xmas" aria-pressed="false">Christmas line</button><button class=fb data-f="barelychange" aria-pressed="false">Sentence: barely change</button><button class=fb data-f="closed" aria-pressed="false">Closed</button><button class=fb data-f="partly" aria-pressed="false">Some hotels closed</button><button class=fb data-f="rough" aria-pressed="false">Rough shape</button><button class=fb data-f="check" aria-pressed="false">Wording to check</button><button class=fb data-f="flat" aria-pressed="false">Flat</button><button class=fb data-f="mild" aria-pressed="false">Mild</button><button class=fb data-f="moderate" aria-pressed="false">Moderate</button><button class=fb data-f="high" aria-pressed="false">High</button><button class=fb data-f="extreme" aria-pressed="false">Extreme</button><button class=fb data-f="unreviewed" aria-pressed="false">Not yet reviewed</button><button class=fb data-f="event" aria-pressed="false">Event spike</button><button class=fb data-f="changed" aria-pressed="false">Changed in the compare check</button><button class=fb data-f="commented" aria-pressed="false">With comments</button><span id=count></span></div>
<div class=grid id=g>{cards}</div>
</main>
{SCRIPT}"""
open(ROOT+'.cache/cost-seasonality-all-drafts.html','w').write(page); print(len(page)//1024,'KB')
