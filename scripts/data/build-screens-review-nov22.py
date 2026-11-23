# 22 Nov 2026: builds .cache/screens-review.html from the template plus the real screenshots in .cache/shots.
import base64,json,os
S={}
for f in sorted(os.listdir('.cache/shots')):
    if f.endswith('.jpg'): S[f[:-4]]='data:image/jpeg;base64,'+base64.b64encode(open('.cache/shots/'+f,'rb').read()).decode()
t=open('scripts/data/screens-review-template.html').read().replace('__SHOTS__',json.dumps(S))
css=open('src/components/results/results.css').read()
import re as _re
g=_re.search(r'--paper-grain:\s*(url\(.*?\));\n',css).group(1); w=_re.search(r'--paper-waves:\s*(url\(.*?\));\n',css).group(1)
t=t.replace('__PAPER_GRAIN__',g).replace('__PAPER_WAVES__',w)
open('.cache/screens-review.html','w').write(t); print(len(t)//1024,'KB',len(S),'shots')
