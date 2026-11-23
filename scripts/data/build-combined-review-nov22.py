# 22 Nov 2026: one review artifact for everything suggested and not yet built: the screens review's open items plus the place card review's open items.
import re,json,glob,base64
src=open('scripts/data/build-placecard-interactive-nov22.py').read()
js=src[src.index('body=r"""')+len('body=r"""'):src.index('"""\nout=head+body+tail')]
helpers=js[:js.index('var SCREENS=[')]
helpers=re.sub(r"var BUILT=\[\];var BUILT_TITLES=\[\];var DECIDED_NO=\[\];\n","",helpers)
pcs=js[js.index('var SCREENS=[')+len('var SCREENS=['):]
pcs=pcs[:pcs.rindex('];')]
pcs=pcs.replace("name:'One interest'","name:'Place card: One interest'").replace("name:'About'","name:'Place card: About'").replace("name:'Costs'","name:'Place card: Costs'")
t=open('scripts/data/screens-review-template.html').read()
t=t.replace("var BUILT=[","var BUILT=['pc_h1','pc_h2','pc_f1','pc_f2','pc_f3','pc_f4','pc_a1','pc_a2','pc_c4',",1)
t=t.replace("var SCREENS=[",helpers+"var SCREENS=[",1)
mark="/* what is built or decided no is not shown again"
t=t.replace(mark,"SCREENS=SCREENS.concat(["+pcs+"]);\n"+mark,1)
t=t.replace("<title>Screen By Screen Review</title>","<title>Open Design Changes</title>")
t=t.replace("Every screen, tidied: pick what you like","Everything still open: pick what you like")
t=t.replace("Each section has a phone you can tap, and a list of proposed changes. Mark each change Keep or Skip. The phone updates live, so Skip puts that one part back to how it is today. Tap Current to see the real screenshot.","Everything suggested so far that is not built yet, in one place: screens first, then the place card (its sections start with \"Place card\"). Each section has a phone you can tap and a list of proposed changes. Mark each change Keep or Skip and the phone updates live. Already-built changes are gone from this page.")
# screenshots for the place card sections
T='/Users/brendansalant-pearce/.claude/projects/-Users-brendansalant-pearce-Desktop-Claude-Code/7967b631-7de4-44fc-a69e-c242cec19f01/tool-results/'
S={}
for f in sorted(glob.glob('.cache/shots/*.jpg')): S[f.split('/')[-1][:-4]]='data:image/jpeg;base64,'+base64.b64encode(open(f,'rb').read()).decode()
for k,n in {'fy':'1795310811543-xk2z73','ab':'1795310843407-tz567p','co':'1795310851817-wokoij','co2':'1795310858273-nlq47q','si':'1795310867951-qkdlqi'}.items():
    S[k]='data:image/jpeg;base64,'+base64.b64encode(open(glob.glob(T+'mcp-Claude_Browser-blob-'+n+'.jpg')[0],'rb').read()).decode()
t=t.replace('__SHOTS__',json.dumps(S))
css=open('src/components/results/results.css').read()
g=re.search(r'--paper-grain:\s*(url\(.*?\));\n',css).group(1); w=re.search(r'--paper-waves:\s*(url\(.*?\));\n',css).group(1)
t=t.replace('__PAPER_GRAIN__',g).replace('__PAPER_WAVES__',w)
ts=open('src/lib/onboarding/world-map-data.ts').read()
paths=dict(re.findall(r'\b(na|csa|eu|af|as|oc): \"([^\"]+)\"',ts))
assert len(paths)==6,paths.keys()
t=t.replace('__MAPPATHS__',json.dumps(paths)).replace('__PTS__',open('.cache/place-points.json').read())
open('.cache/combined-review.html','w').write(t); print(len(t)//1024,'KB')
