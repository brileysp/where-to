# 21 Nov 2026: builds .cache/score-bars-before-after.html. The "now" side uses the app's real results.css rules (extracted below) and real markup,
# the "with option C" side uses the shaded-row bars from the Match Explainer Tighter mockup.
import re
css=open('src/components/results/results.css').read()
css=re.sub(r'/\*.*?\*/','',css,flags=re.S)
blocks=[];depth=0;start=0
for i,ch in enumerate(css):
    if ch=='{': depth+=1
    elif ch=='}':
        depth-=1
        if depth==0:
            blocks.append(css[start:i+1].strip()); start=i+1
PREF=('.ichip','.interest-chip','.month-detail','.match-','.detail-section-title','.card','.score-','.search-dropdown','.dna-sentence','.dna-hint','.interest-detail','.results-list')
def sel_ok(b):
    head=b.split('{')[0]
    if head.strip().startswith('@'):
        return any(re.search(r'(^|[\s,}])'+re.escape(p),b) for p in PREF) and not re.search(r'(keyframes)',head) is None or (head.strip().startswith('@media') and any(p in b for p in PREF))
    sels=[s.strip() for s in head.split(',')]
    return any(s.startswith(PREF) for s in sels)
real=[b for b in blocks if sel_ok(b)]
# keyframes the chips/cards use must come along
kf=[b for b in blocks if b.startswith('@keyframes') and re.search(r'ichip|bubble|pop|stamp|rank-flash|reveal',b.split('{')[0])]
real_css='\n'.join(real+kf)
real_css=re.sub(r'\.card-stamp[^{]*\{[^}]*\}','',real_css)

MINE='''
.x-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px;align-items:start}
.x-col{min-width:0}
.x-tag{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px}
.x-now{color:var(--text-faint)}.x-new{color:var(--accent)}
.x-frame{background:var(--bg-card);border:1px solid var(--border);border-radius:20px;padding:16px;box-shadow:0 8px 24px #0000001a;min-width:0;overflow:hidden}
.x-frame.shell{background:var(--bg)}
.x-sec{margin:34px 0 8px}.x-sec h2{font-size:20px;margin:0 0 4px}.x-sec p{margin:0;color:var(--text-dim);font-size:14px;max-width:80ch}
.x-sec .where{font-size:12.5px;color:var(--text-faint)}
.x-opinion{margin-top:10px;font-size:13.5px;color:var(--text-dim);border-left:3px solid var(--accent);padding:2px 0 2px 10px;max-width:80ch}
.x-opinion b{color:var(--text)}
/* option C bars */
.sr{position:relative;display:flex;align-items:center;gap:10px;width:100%;border:0;background:var(--track);color:var(--text);font:inherit;text-align:left;padding:0 12px;height:38px;border-radius:10px;overflow:hidden;margin-bottom:6px;cursor:default}
.sr .fill{position:absolute;left:0;top:0;bottom:0;opacity:.34}
.sr .ghostfill{position:absolute;top:0;bottom:0;background:repeating-linear-gradient(135deg,var(--bad-soft) 0 4px,transparent 4px 8px);border-right:1.5px dashed var(--poor)}
.sr>*:not(.fill):not(.ghostfill){position:relative}
.sr .e{font-size:16px}.sr .nm{flex:1;font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sr .pc{font-weight:800;font-size:14px;font-variant-numeric:tabular-nums}
.sr .i{width:16px;height:16px;border-radius:50%;border:1.5px solid var(--poor);color:var(--poor);font-size:10px;font-weight:800;display:grid;place-items:center}
.sr.sel{outline:2px solid var(--accent);outline-offset:-2px}
.sr.tall{height:46px}
.g{color:var(--good)}.o{color:var(--okay)}.r{color:var(--poor)}
.why2{margin:-2px 2px 8px 2px;padding:9px 12px;background:var(--bad-soft);border-radius:10px;font-size:12.5px}
.why2 b{color:var(--poor)}
.okline{font-size:12.5px;color:var(--text-dim);margin:-2px 4px 8px}.okline b{color:var(--good)}
.sepx{height:1px;background:var(--border);margin:8px 0}
.lbl2{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-faint);margin:2px 0 8px}
.big{position:relative;display:flex;align-items:center;justify-content:space-between;border-radius:12px;padding:12px 14px;background:var(--track);overflow:hidden}
.big .fill{position:absolute;left:0;top:0;bottom:0;opacity:.34}
.big>*:not(.fill){position:relative}
.big b{display:block;font-size:14px}.big small{font-size:12.5px;font-weight:700}
.big .n{font-size:26px;font-weight:800}
.cardfill{position:relative;overflow:hidden}
.cardfill .cf{position:absolute;left:0;top:0;height:46px;opacity:.28;border-radius:12px 0 0 0}
.cardfill>*:not(.cf){position:relative}
.sfill{position:relative;overflow:hidden}
.sfill .cf{position:absolute;left:0;top:0;bottom:0;opacity:.3}
.sfill>*:not(.cf){position:relative}
.xlist{display:flex;flex-direction:column;gap:12px}
.chipwrap{margin-bottom:0}
'''
TOKENS='''
:root{--bg:#f6f4f1;--bg-elevated:#ffffff;--bg-card:#ffffff;--border:#e3ddd4;--text:#21201d;--text-dim:#5a5650;--text-faint:#8b867d;--accent:#c76a35;--accent-soft:#c76a3522;--good:#4caf7d;--good-soft:#7fbf8f;--okay:#d8b45c;--poor:#d97b4f;--bad:#c25a5a;--heart:#c94569;--radius:12px;--card-bg:rgba(0,0,0,.03);--track:#ece7df;--bad-soft:#f8e7df}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f1416;--bg-elevated:#161d21;--bg-card:#1a2226;--border:#2a3438;--text:#eef2f3;--text-dim:#9fb0b5;--text-faint:#6d7c80;--accent:#e8935a;--accent-soft:#e8935a33;--heart:#e8688a;--card-bg:rgba(255,255,255,.06);--track:#263034;--bad-soft:#3a251c;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0f1416;--bg-elevated:#161d21;--bg-card:#1a2226;--border:#2a3438;--text:#eef2f3;--text-dim:#9fb0b5;--text-faint:#6d7c80;--accent:#e8935a;--accent-soft:#e8935a33;--heart:#e8688a;--card-bg:rgba(255,255,255,.06);--track:#263034;--bad-soft:#3a251c;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding-block:26px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.page{max-width:1100px;margin:0 auto}
h1{font-size:26px;margin:0 0 6px;text-wrap:balance}
.lead{color:var(--text-dim);max-width:78ch;margin:0 0 6px}
button{font-family:inherit}
'''
def bub(v):
    c='var(--good)' if v>=8 else 'var(--okay)' if v>=5 else 'var(--poor)'
    ink='#3b2d05' if 5<=v<6.5 else '#fff'
    return f'<span class="ichip-bubble" style="background:{c};color:{ink}">{v:.1f}</span>'
def chip(e,label,v,active=False):
    return f'<button type="button" class="ichip{" active" if active else ""}"><span class="ichip-emoji">{e}</span><span class="ichip-reveal"><span class="ichip-inner"><span class="ichip-label">{label}</span></span></span>{bub(v)}</button>'
INT=[('🏕️','Camping',100,'Top'),('🏔️','Scenic landscapes',98,'Top'),('🥾','Hiking',96,'Top'),('✨','Stargazing',80,'Like'),('🐴','Horseback riding',73,'Like'),('🛶','Kayaking & rafting',60,'Like'),('🦜','Birding',53,'Top')]
def tone(p): return ('var(--good)','g') if p>=80 else ('var(--okay)','o') if p>=50 else ('var(--poor)','r')
def row(e,n,p,sel=False,cut=None,tall=False,ok=False):
    col,cl=tone(p)
    ghost=f'<span class="ghostfill" style="left:{p}%;width:{cut-p}%"></span>' if cut else ''
    i='<span class="i">i</span>' if cut else ''
    return f'<div class="sr{" sel" if sel else ""}{" tall" if tall else ""}">{ghost}<span class="fill" style="width:{p}%;background:{col}"></span><span class="e">{e}</span><span class="nm">{n}</span>{i}<span class="pc {cl}">{p}%</span></div>'
def sec(title,where,desc,before,after,op):
    return f'<div class="x-sec"><h2>{title}</h2><div class="where">{where}</div><p>{desc}</p></div><div class="x-grid"><div class="x-col"><div class="x-tag x-now">Now</div><div class="x-frame">{before}</div></div><div class="x-col"><div class="x-tag x-new">With option C bars</div><div class="x-frame">{after}</div></div></div><div class="x-opinion">{op}</div>'

# 1 chip row
chips_before='<div class="detail-section-title interest-chips-title">Your top interests · Tap to compare</div><div class="interest-chip-row-wrap"><div class="interest-chip-row">'+chip('🧬','My Interests',7.5,True)+chip('🏕️','Camping',10.0)+chip('🏔️','Scenic',9.8)+chip('🥾','Hiking',9.6)+chip('✨','Stars',8.0)+chip('🐴','Horse',7.3)+chip('🛶','Kayak',6.0)+chip('🦜','Birding',5.3)+chip('🐾','Wildlife',3.2)+'</div><div class="interest-chip-row-fade" aria-hidden="true"></div></div>'
rows1=''.join(row(e,n,p) for e,n,p,l in INT)+row('🐾','Wildlife viewing',32,cut=81)
chips_after='<div class="big" style="margin-bottom:10px"><span class="fill" style="width:75%;background:var(--good)"></span><div><b>🧬 My Interests</b><small class="g">Good match in December</small></div><div class="n g">7.5</div></div><div class="lbl2">Tap an interest for its details</div>'+rows1
s1=sec('1. The interest chips at the top of "For You"','Place sheet › For You tab, top row (the round chips with score bubbles)','Today the interests are a sideways-scrolling row of round chips, each with a small score bubble, and only about four are visible at once. With option C they become one short list you can read without scrolling, and tapping a row opens that interest, just as tapping a chip does today.',chips_before,chips_after,'<b>My view:</b> the best of the five. The chips hide most of your interests off the edge and the bubbles are tiny. The list shows everything at once, and the percent is easier to read than 7.3 next to 8.0.')

# 2 combined card + sentence + pills
before2='''<div class="interest-detail"><div class="month-detail-card month-detail-card-scored"><div class="month-detail-top"><div class="month-detail-text"><div class="month-detail-name">Your combined match in December</div><div class="month-detail-quality score-good">Good match</div></div><div class="month-detail-score score-good">7.5</div></div></div>
<p class="dna-sentence">December’s match score of 7.5 is based on your combined top interests.</p>
<div class="match-notes"><div class="detail-section-title">From your picks and answers</div><div class="match-note-row"><span class="match-reason">🐾 Not much for: Primates</span><span class="match-ok">🏔️ Matches: Mountains</span><span class="match-ok">🏔️ Matches: Landscape photography</span></div></div></div>'''
after2='''<div class="big"><span class="fill" style="width:75%;background:var(--good)"></span><div><b>Your combined match in December</b><small class="g">Good match</small></div><div class="n g">7.5</div></div>
<p class="okline" style="margin:10px 4px 0">The one thing holding it back: <b>🐾 Wildlife</b> was cut from 81% to 32% because you picked Primates and none live here.</p>'''
s2=sec('2. The combined match and the pills under it','Place sheet › For You tab › My Interests, below the month chart','Today: the score card, a sentence that restates it, and three pills (one orange, two green) that say what your picks did. Because the full list from idea 1 already shows every interest with its percent and its cut, this part shrinks to the score and one sentence that appears only when something was cut.',before2,after2,'<b>My view:</b> this is the part that was not working for you, and the fix is mostly deletion. The three pills collapse into one sentence that only exists when a score was cut. The "Matches" pills disappear because a high percent already says it.')

# 3 single interest cards
before3='''<div class="interest-detail"><div class="interest-detail-heading"><span class="interest-detail-icon">🐾</span>Wildlife viewing in Torres del Paine</div>
<div class="month-detail-card month-detail-card-scored"><div class="month-detail-top"><div class="month-detail-text"><div class="month-detail-name">Wildlife viewing in Torres del Paine in December</div><div class="month-detail-quality score-poor">Poor match</div></div><div class="month-detail-score score-poor">3.2</div></div></div>
<div class="match-notes"><div class="match-note-row"><span class="match-reason">🐾 Not much for: Primates</span></div></div></div>
<div class="interest-detail" style="margin-top:14px"><div class="interest-detail-heading"><span class="interest-detail-icon">🏔️</span>Scenic landscapes in Torres del Paine</div>
<div class="month-detail-card month-detail-card-scored"><div class="month-detail-top"><div class="month-detail-text"><div class="month-detail-name">Scenic landscapes in Torres del Paine in December</div><div class="month-detail-quality score-excellent">Excellent match</div></div><div class="month-detail-score score-excellent">9.8</div></div></div>
<div class="match-notes"><div class="match-note-row"><span class="match-ok">🏔️ Matches: Mountains</span><span class="match-ok">🏔️ Matches: Landscape photography</span></div></div></div>'''
after3='''<div class="lbl2">🐾 Wildlife viewing in Torres del Paine</div>
'''+row('🐾','December',32,cut=81,tall=True)+'''<div class="why2"><b>Was 81%.</b> You picked Primates, and none live here, so wildlife counts for a lot less.</div>
<div class="sepx" style="margin:16px 0 12px"></div>
<div class="lbl2">🏔️ Scenic landscapes in Torres del Paine</div>
'''+row('🏔️','December',98,tall=True)+'''<p class="okline">Fully matches what you picked: <b>Mountains</b>, <b>Landscape photography</b>.</p>'''
s3=sec('3. A single interest\'s card','Place sheet › For You tab, after tapping one interest chip','Today: a card with the score in large type and a quality word, then pills for what your picks did. With option C the card is the bar. A cut interest keeps its hatched ghost bar and one sentence. A fully matched one gets one quiet line, in place of two green pills.',before3,after3,'<b>My view:</b> good fit, and it fixes the muddy "Matches: Landscape photography" wording. Note the percent is for the month shown; the month chart under it stays as it is.')

# 4 results cards
def card_before(rank,name,emoji,region,s,cls):
    return f'<article class="card card-row"><div class="card-top-row"><span class="card-rank">#{rank}</span><div class="card-name">{name}</div><div class="card-score score-{cls}">{s:.1f}</div></div><div class="card-bottom-row"><div class="card-bottom-left"><span class="card-row-emoji">{emoji}</span><span class="card-region">{region}</span></div></div></article>'
def card_after(rank,name,emoji,region,s,cls):
    col='var(--good)' if s>=8 else 'var(--okay)' if s>=5 else 'var(--poor)'
    return f'<article class="card card-row cardfill"><span class="cf" style="width:{s*10}%;background:{col}"></span><div class="card-top-row"><span class="card-rank">#{rank}</span><div class="card-name">{name}</div><div class="card-score score-{cls}">{s:.1f}</div></div><div class="card-bottom-row"><div class="card-bottom-left"><span class="card-row-emoji">{emoji}</span><span class="card-region">{region}</span></div></div></article>'
cards=[(1,'Northern Tanzania','🦓','Tanzania',8.9,'excellent'),(2,'Patagonia','🏔️','Chile · Argentina',8.2,'excellent'),(3,'Torres del Paine','🏔️','Chile',7.5,'good'),(4,'Cape Town','🍷','South Africa',6.4,'okay')]
b4='<div class="xlist">'+''.join(card_before(*c) for c in cards)+'</div>'
a4='<div class="xlist">'+''.join(card_after(*c) for c in cards)+'</div>'
s4=sec('4. The place cards in the results list','Shortlist and results list (the main thing people see)','These show one overall score per place, not a score per interest, so they are the weakest match for option C. Shown here: the same shading across the top of each card, filled to the overall score, so a long list reads as a fading gradient. The 0 to 10 number stays.',b4,a4,'<b>My view:</b> I would not do this one. The list is already ordered best to worst and the number is clear, so the fill is decoration and makes busy cards busier. If you want it, a thin underline bar is the quietest version.')

# 5 search dropdown
def srow(e,n,r,rank,s,cls):
    return f'<div class="search-dropdown-row"><span>{e}</span><div><div class="search-dropdown-name">{n}</div><div class="search-dropdown-region">{r}</div></div><span class="search-dropdown-rank score-{cls}">#{rank} · {s:.1f}</span></div>'
def srow2(e,n,r,rank,s):
    col='var(--good)' if s>=8 else 'var(--okay)' if s>=5 else 'var(--poor)'
    return f'<div class="search-dropdown-row sfill"><span class="cf" style="width:{s*10}%;background:{col}"></span><span>{e}</span><div><div class="search-dropdown-name">{n}</div><div class="search-dropdown-region">{r}</div></div><span class="search-dropdown-rank">#{rank} · {s:.1f}</span></div>'
rows=[('🏔️','Torres del Paine','Chile',3,7.5,'good'),('🏔️','Patagonia','Chile · Argentina',2,8.2,'excellent'),('🌋','Patagonia Lakes','Argentina',11,6.3,'okay')]
b5='<div class="results-search-dropdown">'+''.join(srow(*r) for r in rows)+'</div>'
a5='<div class="results-search-dropdown">'+''.join(srow2(*r[:5]) for r in rows)+'</div>'
s5=sec('5. Search results','Search icon above the list, the drop-down of matching places','Today each match shows its rank and score as small coloured text on the right. Option C would shade the row to the score. Like the cards, this is one overall score per place.',b5,a5,'<b>My view:</b> not worth it here. The rows are small and the coloured number already does the job. I would leave search as it is.')

html=f'''<title>Score Bars Before And After</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>{TOKENS}
{real_css}
{MINE}</style>
<div class="page">
<h1>Where scores show, now and with option C</h1>
<p class="lead">Five places in the traveler-facing app show scores. The "Now" side is drawn with the app's own styles (copied from its stylesheet), the "With option C" side uses the shaded-row bars. Per-interest scores become percents; a place's overall score stays 0 to 10, as in the C mockup. Same example throughout: Torres del Paine in December.</p>
{s1}{s2}{s3}{s4}{s5}
<div class="x-sec"><h2>Left out on purpose</h2><p>The vertical month charts (J to D bars) on the For You and About tabs: they show change over the year, which a shaded row cannot, so they stay. The "DNA 50%" meter in the question box and the Calibration bar on the Travel DNA page are progress, not scores. Admin pages also show scores; I treated those as out of scope for the traveler look and can add them if you want.</p></div>
</div>'''
open('.cache/score-bars-before-after.html','w').write(html)
print(len(html),'bytes;',len(real),'real rules')
