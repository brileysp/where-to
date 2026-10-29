#!/usr/bin/env python3
"""Builds a review page (tables plus approve / change / not-now decision cards) from a JSON spec.
Usage: python3 build_review_page.py spec.json out.html

Spec:
{
 "title": "Six Interests Column Proposal",          # 2-4 word name, keep it the same on every republish
 "lead": "One or two plain sentences.",
 "boxes": ["**Bold** lead-in. Text.", ...],          # optional boxes at the top; **x** makes bold
 "sections": [{
    "id": "gf", "name": "Golf", "sub": "182 places, built",
    "intro": "text",                                   # optional
    "stats": ["182 places", "4 chips live"],           # optional pills
    "blocks": [                                        # any order
       {"type": "table", "heading": "Outliers first", "head": ["What","What stands out","What I did"], "rows": [["a","b","c"]]},
       {"type": "list", "heading": "What differs", "items": ["text", ...]},
       {"type": "text", "heading": "optional", "text": "paragraph"}
    ],
    "decisions": [{"id": "gf-r1", "title": "Question?", "body": "Why it matters.", "rec": "My recommendation: yes."}]
 }],
 "footer": "closing paragraph"                        # optional
}
Cell and text strings are plain text (escaped); only **bold** is allowed. Decision ids must be unique and are the keys in the page's
`decisions` collection, so keep the same id when a question is the same question (the owner's earlier answer then shows again).
"""
import json, html, re, sys, os
H = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(H, '..', 'assets')
E = html.escape
def t(s): return re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', E(str(s)))
def table(head, rows):
    h = ''.join('<th>%s</th>' % t(x) for x in head)
    r = ''.join('<tr>' + ''.join('<td>%s</td>' % t(c) for c in row) + '</tr>' for row in rows)
    return '<div class="tw"><table><tr>%s</tr>%s</table></div>' % (h, r)
def build(spec):
    css = open(os.path.join(A, 'style.css')).read()
    js = open(os.path.join(A, 'decision-cards.js')).read()
    decs, body, nav = [], '', ''
    ids = set()
    for s in spec['sections']:
        k = s['id']
        body += '<section class="set" id="%s"><h2>%s <span class="sub">%s</span></h2>' % (E(k), t(s['name']), t(s.get('sub', '')))
        if s.get('intro'): body += '<p>%s</p>' % t(s['intro'])
        if s.get('stats'): body += '<div class="stat">%s</div>' % ''.join('<span>%s</span>' % t(x) for x in s['stats'])
        for b in s.get('blocks', []):
            if b.get('heading'): body += '<h3>%s</h3>' % t(b['heading'])
            if b['type'] == 'table': body += table(b['head'], b['rows'])
            elif b['type'] == 'list': body += '<ul class="tight">%s</ul>' % ''.join('<li>%s</li>' % t(x) for x in b['items'])
            elif b['type'] == 'text': body += '<p>%s</p>' % t(b['text'])
        if s.get('decisions'):
            body += '<h3>Decisions</h3>'
            for d in s['decisions']:
                assert d['id'] not in ids, 'duplicate decision id ' + d['id']
                ids.add(d['id'])
                decs.append({'id': d['id'], 't': d['title'], 'b': d.get('body', ''), 'rec': d.get('rec', '')})
                body += '<div class="dec" data-id="%s"></div>' % E(d['id'])
        body += '</section>'
        n = len(s.get('decisions', []))
        nav += '<a href="#%s">%s<span class="st" id="st-%s">0/%d</span></a>' % (E(k), t(s['name']), E(k), n)
    boxes = ''.join('<div class="box">%s</div>' % t(b) for b in spec.get('boxes', []))
    foot = '<p>%s</p>' % t(spec['footer']) if spec.get('footer') else ''
    page = ('<title>%s</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
            '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
            '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">\n'
            '<style>%s</style>\n<div class="wrap"><h1>%s</h1><p class="lead">%s</p>%s<nav class="nav">%s</nav>%s%s</div>\n'
            '<script>const DECS = %s;\n%s</script>') % (E(spec['title']), css, t(spec['title']), t(spec.get('lead', '')), boxes, nav, body, foot, json.dumps(decs), js)
    return page, decs
if __name__ == '__main__':
    spec = json.load(open(sys.argv[1]))
    page, decs = build(spec)
    open(sys.argv[2], 'w').write(page)
    print(len(page), 'bytes,', len(decs), 'decisions')
