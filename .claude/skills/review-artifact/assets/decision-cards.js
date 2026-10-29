
const el=(t,a,...k)=>{const e=document.createElement(t);for(const x in (a||{}))x==="class"?e.className=a[x]:x==="text"?e.textContent=a[x]:e.setAttribute(x,a[x]);k.forEach(c=>e.append(c));return e;};
const state={}, nodes={}; let col=null, editing=null;
DECS.forEach(d=>{
  const host=document.querySelector('.dec[data-id="'+d.id+'"]'); if(!host) return;
  host.append(el("div",{class:"q",text:d.t}),el("p",{text:d.b}));
  if(d.rec) host.append(el("div",{class:"rec",text:d.rec}));
  const btns=el("div",{class:"btns"}), bs={};
  [["approved","ok","Yes, approve"],["change","chg","Needs a change"],["later","later","Not now"]].forEach(([s,cl,lab])=>{
    const b=el("button",{class:"btn "+cl,type:"button","aria-pressed":"false",text:lab});
    b.addEventListener("click",()=>write(d.id,{status:(state[d.id]&&state[d.id].status)===s?"":s}));
    bs[s]=b;btns.append(b);
  });
  const ta=el("textarea",{placeholder:"Note (optional)",rows:"1"});
  ta.addEventListener("focus",()=>{editing=d.id});
  ta.addEventListener("blur",()=>{editing=null;const cur=(state[d.id]&&state[d.id].note)||"";if(ta.value!==cur)write(d.id,{note:ta.value});});
  const sv=el("div",{class:"saved"});
  host.append(btns,ta,sv);nodes[d.id]={c:host,bs,ta,sv};
});
function counts(){const by={};DECS.forEach(d=>{const k=d.id.split('-')[0];by[k]=by[k]||{n:0,a:0};by[k].n++;const s=(state[d.id]||{}).status;if(s)by[k].a++;});
  for(const k in by){const e=document.getElementById('st-'+k);if(e)e.textContent=by[k].a+'/'+by[k].n;}}
function paint(){DECS.forEach(d=>{const n=nodes[d.id];if(!n)return;const s=state[d.id]||{};n.c.dataset.s=s.status||"";for(const k in n.bs)n.bs[k].setAttribute("aria-pressed",String(s.status===k));if(editing!==d.id&&document.activeElement!==n.ta)n.ta.value=s.note||"";});counts();}
const q={};
function write(id,patch){
  if(!col)return;
  q[id]=(q[id]||Promise.resolve()).then(async()=>{
    const cur=Object.assign({},state[id]||{},patch,{at:new Date().toISOString()});state[id]=cur;paint();
    try{await col.doc(id).set(cur);nodes[id].sv.textContent="Saved";}catch(e){nodes[id].sv.textContent="Couldn't save ("+(e&&e.code||"error")+")";}
  });
}
paint();
(async()=>{
  let db=null;try{db=await claude.use("db");}catch(e){}
  if(!db){document.querySelectorAll(".btn,textarea").forEach(b=>b.disabled=true);return;}
  col=db.collection("decisions");
  col.onSnapshot(s=>{s.docs.forEach(d=>{if(nodes[d.id])state[d.id]=d.data();});paint();},()=>{});
})();
