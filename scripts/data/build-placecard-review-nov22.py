# 22 Nov 2026: builds .cache/placecard-review.html. "Before" = real screenshots of the place card (embedded), "After" = drawn mockups in the app's tokens.
import base64
D='/Users/brendansalant-pearce/.claude/projects/-Users-brendansalant-pearce-Desktop-Claude-Code/7967b631-7de4-44fc-a69e-c242cec19f01/tool-results/'
def img(n): return 'data:image/jpeg;base64,'+base64.b64encode(open(D+'mcp-Claude_Browser-blob-'+n+'.jpg','rb').read()).decode()
IM={'fy':img('1795310811543-xk2z73'),'fy2':img('1795310827039-1txu23'),'ab':img('1795310843407-tz567p'),'co':img('1795310851817-wokoij'),'co2':img('1795310858273-nlq47q'),'si':img('1795310867951-qkdlqi')}
W=340; K=W/390
def crop(key,y0,y1):
    return f'<div class="shot" style="height:{round((y1-y0)*K)}px;background-image:url({IM[key]});background-size:{W}px auto;background-position:0 -{round(y0*K)}px"></div>'
def sec(num,title,why,before,after):
    items=''.join(f'<li>{w}</li>' for w in why)
    return f'<section class="sec"><h2>{num}. {title}</h2><ul class="why">{items}</ul><div class="pair"><div><div class="tag now">Before (real screenshot)</div><div class="ph">{before}</div></div><div><div class="tag new">After</div><div class="ph">{after}</div></div></div></section>'
CSS='''
:root{--bg:#f6f4f1;--card:#fff;--fg:#21201d;--dim:#5a5650;--faint:#8b867d;--line:#e3ddd4;--accent:#c76a35;--accent-soft:#c76a3522;--good:#4caf7d;--okay:#d8b45c;--poor:#d97b4f;--track:#ece7df}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f1416;--card:#1a2226;--fg:#eef2f3;--dim:#9fb0b5;--faint:#6d7c80;--line:#2a3438;--accent:#e8935a;--accent-soft:#e8935a33;--track:#263034;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0f1416;--card:#1a2226;--fg:#eef2f3;--dim:#9fb0b5;--faint:#6d7c80;--line:#2a3438;--accent:#e8935a;--accent-soft:#e8935a33;--track:#263034;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding-block:26px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.page{max-width:860px;margin:0 auto}
h1{font-size:26px;margin:0 0 6px}h2{font-size:20px;margin:0 0 6px}.lead{color:var(--dim);max-width:72ch;margin:0 0 14px}
.sum{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 18px;margin:14px 0 6px}.sum ol{margin:6px 0 0;padding-left:20px;color:var(--dim)}.sum li{margin:4px 0}.sum b{color:var(--fg)}
.sec{margin-top:34px}ul.why{margin:0 0 12px;padding-left:20px;color:var(--dim);font-size:14px;max-width:75ch}ul.why li{margin:3px 0}
.pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:18px;align-items:start}
.tag{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px}.now{color:var(--faint)}.new{color:var(--accent)}
.ph{width:340px;max-width:100%;border:1px solid var(--line);border-radius:18px;overflow:hidden;background:var(--card)}
.shot{background-repeat:no-repeat;width:100%}
/* after mocks */
.m{padding:0 16px 14px;font-size:14px}
.hd{display:flex;align-items:center;gap:10px;padding:14px 16px 8px}.hd .e{font-size:22px}.hd .nm{font-weight:800;font-size:19px;line-height:1.15}.hd .sub{font-size:13px;color:var(--dim)}.hd .sub b{color:var(--accent);font-weight:700}
.hd .t{flex:1}.ic{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;color:var(--dim);font-size:17px}
.tabs{display:flex;border-bottom:1px solid var(--line);padding:0 16px}.tabs div{flex:1;text-align:center;padding:10px 0;font-size:12px;font-weight:800;letter-spacing:.08em;color:var(--faint)}.tabs .on{color:var(--fg);box-shadow:inset 0 -2px 0 var(--accent)}
.chips{display:flex;gap:8px;padding:12px 16px 6px;overflow:hidden}
.ch{height:36px;min-width:36px;border-radius:18px;background:var(--track);display:inline-flex;align-items:center;gap:7px;padding:0 10px;font-size:17px;white-space:nowrap;position:relative}
.ch.on{background:var(--accent-soft);box-shadow:inset 0 0 0 1.5px var(--accent);font-size:13.5px;font-weight:700}
.ch small{font-size:10.5px;font-weight:800;color:#fff;background:var(--good);border-radius:9px;padding:0 6px;line-height:16px}
.bars{display:flex;align-items:flex-end;gap:5px;height:84px;margin:8px 0 4px}.bars i{flex:1;border-radius:5px;display:block}
.mo{display:flex;gap:5px;font-size:11px;color:var(--faint);text-align:center}.mo span{flex:1}.mo .on{color:var(--accent);font-weight:800}
.sumline{display:flex;align-items:baseline;gap:10px;margin:12px 0 4px}.sumline .n{font-size:30px;font-weight:800;color:var(--good);font-variant-numeric:tabular-nums}.sumline .w{font-weight:700}.sumline .m2{color:var(--dim);font-size:13px}
.lab{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--faint);margin:14px 0 6px}
.row{position:relative;display:flex;align-items:center;gap:10px;height:38px;padding:0 12px;margin-bottom:6px;border-radius:10px;background:var(--track);overflow:hidden}
.row .f{position:absolute;left:0;top:0;bottom:0;opacity:.34}.row>*:not(.f):not(.g){position:relative}.row .g{position:absolute;top:0;bottom:0;background:repeating-linear-gradient(135deg,#d97b4f30 0 4px,transparent 4px 8px);border-right:1.5px dashed var(--poor)}
.row .nm{flex:1;font-weight:600}.row b{font-variant-numeric:tabular-nums}
.why2{margin:-2px 2px 8px;padding:9px 12px;border-radius:10px;background:#d97b4f1f;font-size:13px}.why2 b{color:var(--poor)}
p{margin:8px 0}.dimp{color:var(--dim)}
.tag2{display:inline-block;font-size:11.5px;font-weight:700;color:var(--dim);border:1px solid var(--line);border-radius:99px;padding:1px 9px;margin-left:6px}
.dollars{font-size:24px;font-weight:800;letter-spacing:2px}.dollars span{color:var(--line)}.dollars b{color:var(--fg)}
.item{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)}.item:last-child{border:0}.item .nm{flex:1;color:var(--dim)}.item b{font-variant-numeric:tabular-nums}
'''
def bars(sel,hs,colors):
    return '<div class="bars">'+''.join(f'<i style="height:{h}%;background:{c};{"box-shadow:0 0 0 2px var(--accent)" if i==sel else ""}"></i>' for i,(h,c) in enumerate(zip(hs,colors)))+'</div>'
MO='<div class="mo">'+''.join(f'<span{" class=on" if i==8 else ""}>{m}</span>' for i,m in enumerate('JFMAMJJASOND'))+'</div>'
cmb=[55,60,58,64,66,70,80,82,92,80,60,58]; cc=['#e8d3a0','#e0b09a','#e8d3a0','#e8d3a0','#e8d3a0','#e8d3a0','#bcd9c3','#bcd9c3','#7fb995','#bcd9c3','#e8d3a0','#e8d3a0']
wh=[40,36,44,44,44,52,60,58,52,50,46,44]; wc=['#e8b8a4']*12

# 1 header
b1=crop('fy',52,210)
a1='''<div class="hd"><span class="e">🏜️</span><div class="t"><div class="nm">Namibia</div><div class="sub">Southern Africa · <b>September ⌄</b></div></div><span class="ic">🔖</span><span class="ic">✕</span></div><div class="tabs"><div class="on">FOR YOU</div><div>ABOUT</div><div>COSTS</div></div>'''
s1=sec(1,'The header: one row less, one control less loud',['The month dropdown is a loud filled pill on its own row, and it competes with the orange chips below it. It is really a setting for the whole card, so it should read like one.','Bookmark and close sit on different rows. Together on the title row they use less height and are easier to find.','The drag handle, the tab underline and the content edge give three horizontal lines. This keeps one.'],b1,a1)

# 2 for you top
b2=crop('fy',210,700)
a2=('<div class="chips"><span class="ch on">🧬 My Interests <small>6.8</small></span><span class="ch">🐋 <small style="background:var(--poor)">3.3</small></span></div><div class="m">'
 + bars(8,cmb,cc)+MO+
 '<div class="sumline"><span class="n">6.8</span><span class="w">Good match</span><span class="m2">September</span></div>'
 '<div class="lab">Match by interest</div><div class="lab" style="margin-top:2px;color:var(--dim)">Top interests</div>'
 '<div class="row"><span class="g" style="left:33%;width:55%"></span><span class="f" style="width:33%;background:var(--poor)"></span><span>🐋</span><span class="nm">Whale Watching</span><span style="color:var(--poor);font-weight:800">ⓘ</span><b style="color:var(--poor)">33%</b></div>'
 '<div class="lab" style="margin-top:8px;color:var(--dim)">Also liked</div><div class="row"><span class="f" style="width:100%;background:var(--good)"></span><span>✨</span><span class="nm">Stargazing</span><b style="color:var(--good)">100%</b></div></div>')
s2=sec(2,'"For You": say it once, show it once',['Four separate instructions say "tap" (the heading, two hint lines and the chart title). The first-time tips now teach this, so they can all go.','"🧬 My Interests" appears again as a heading right under the chip that is already selected.','The month is stated three times and the score three times: the chip bubble, the card, and a sentence that repeats the card. One summary line is enough.','The sentence ("based on your combined top interests") only matters when budget or weather lowered the score, so it appears only then.'],b2,a2)

# 3 single interest
b3=crop('si',210,844)
a3=('<div class="chips"><span class="ch">🧬 <small>6.8</small></span><span class="ch on">🐋 Whale Watching <small style="background:var(--poor)">3.3</small></span></div><div class="m">'
 + bars(8,wh,wc)+MO+
 '<div class="sumline"><span class="n" style="color:var(--poor)">3.3</span><span class="w">Weak match</span><span class="m2">September</span></div>'
 '<div class="row"><span class="g" style="left:33%;width:30%"></span><span class="f" style="width:33%;background:var(--poor)"></span><span class="nm">Lowered by your picks</span><span style="color:var(--poor);font-weight:800">ⓘ</span></div>'
 '<div class="why2"><b>Not your kind of boat.</b> No swimming with whales.</div>'
 '<p><b>Humpback and southern right whales</b> are regularly seen passing offshore during their winter migration, adding to the reliable sightings of Heaviside’s and bottlenose dolphins on Walvis Bay cruises.</p>'
 '<p class="dimp" style="font-size:13px">Bottlenose and endemic Heaviside’s dolphins are reliably seen on marine cruises from Walvis Bay…</p></div>')
s3=sec(3,'One interest: chart first, no repeated names',['The page repeats "Whale Watching in Namibia" as a heading, then again in the card title. The chip above already says it.','The long place paragraph pushes the chart below the fold, but the chart is the thing to tap. Chart first, then this month, then the background.','The orange "From your picks and answers" pills become the same shaded row and reason used on My Interests, so both views speak one language.'],b3,a3)

# 4 about
b4=crop('ab',205,720)
a4=('<div class="m" style="padding-top:14px"><p>A self-drive road-trip country of desert, dunes, and wildlife-ringed waterholes, built for exploring independently rather than only by guided safari.</p><p>Dry season May–Oct concentrates wildlife at waterholes for classic sightings; wet season Nov–Apr brings dramatic skies and migratory birds.</p>'
 '<div class="lab">Best months for most visitors</div>'+bars(8,[70,72,74,76,88,90,92,94,96,70,66,60],['#bcd9c3']*12)+MO+
 '<div class="sumline" style="margin-top:12px"><span class="w">September · Excellent time to go</span><span class="tag2">Dry season</span></div><p class="dimp">September in Namibia is warming up, dry with excellent wildlife viewing at waterholes.</p></div>')
s4=sec(4,'About: no boxes, clearer chart name',['Two bordered cards, one inside the other, make a lot of frame for a little text. Plain sections with space between them feel lighter.','The chart is called "Best months overall", but the For You tab has a personal version of the same chart. Name this one "Best months for most visitors" so the two never look like the same thing.','The month card stacks four labels (name, verdict, tag, text). One line with the tag beside it says the same.'],b4,a4)

# 5 costs
b5=crop('co',205,844)
a5=('<div class="m" style="padding-top:14px"><div style="display:flex;align-items:baseline;gap:10px"><span class="dollars"><span>$</span><b>$$$$</b></span><span class="dimp" style="font-size:13px">daily, budget to luxury</span></div>'
 '<p class="dimp">Uniquely great as a self-drive trip in a rented camper van, though luxe lodge options exist too for those who want them.</p>'
 '<div class="lab">What things cost</div><div class="item"><span>☕</span><span class="nm">Coffee</span><b>$2</b></div><div class="item"><span>🍺</span><span class="nm">Windhoek Lager</span><b>$3</b></div><div class="item"><span>🥩</span><span class="nm">Game meat dinner</span><b>$15</b></div><div class="item"><span>🚙</span><span class="nm">4x4 rental, self-drive, per day</span><b>$100</b></div>'
 '<div class="lab">Hotel prices through the year</div>'+bars(8,[60,60,60,60,62,64,70,72,72,70,66,62],['#c76a3555']*8+['#c76a35']+['#c76a3555']*3)+MO+
 '<p class="dimp" style="font-size:13px">Prices barely change. Slightly higher July to October. The month you are viewing is marked.</p></div>')
s5=sec(5,'Costs: show the range, match the palette',['"$$ – $$$$$" is hard to read. Five dollar signs with the range darkened shows at a glance where the place sits between budget and luxury.','The seasonality chart is bright blue, the only blue in the app. In the app\'s orange it belongs with everything else, and the month you are viewing is marked so it connects to the month you chose.','The "Mild" tag and the ⓘ add a second explanation on top of the sentence under them. The sentence is enough.','Cards inside the sheet lose their borders, matching the other tabs.'],b5,a5)

html=f'''<title>Place Card Design Review</title><meta name="claude:viewport-fit-sides" content="cover"><style>{CSS}</style>
<div class="page"><h1>The place card, as a designer would tidy it</h1>
<p class="lead">I went through every part of the card (header, For You, one interest, About, Costs). The "before" images are real screenshots of Namibia in September from your app; the "after" images are drawn. The aim throughout: say each thing once, fewer boxes and lines, one loud color for one job.</p>
<div class="sum"><b>The short list</b><ol><li><b>Header:</b> month becomes a quiet link under the name; bookmark joins close; one row less.</li><li><b>For You:</b> delete the four "tap to…" lines, the repeated "My Interests" heading, the repeated score card and the sentence. Keep chips, chart, one summary line, the shaded rows.</li><li><b>One interest:</b> chart first, no repeated names, the shaded row replaces the pills.</li><li><b>About:</b> no boxed cards; rename the chart "Best months for most visitors".</li><li><b>Costs:</b> show the price range as filled dollar signs; recolor the chart to the app orange and mark the viewed month.</li><li><b>Everywhere:</b> fewer borders and lines; orange only for what you can tap or have chosen.</li></ol></div>
{s1}{s2}{s3}{s4}{s5}</div>'''
open('.cache/placecard-review.html','w').write(html)
print(len(html)//1024,'KB')
