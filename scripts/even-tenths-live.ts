/* eslint-disable @typescript-eslint/no-explicit-any, prefer-const */
// usage: npx tsx scripts/even-tenths-live.ts [--apply] [--only=interestKey,...] [--backup=path]
// Evens out the last digit of the LIVE monthly scores, interest by interest (owner rule, see src/lib/gemini/even-tenths.ts):
// each digit about a tenth, no strings of x.5. Only interests that are noticeably skewed (any digit over 14% or under 6%) are touched,
// diving is skipped (its staged replacement is already evened), and a place is only changed when the refitted curve reproduces the
// nudged months within 0.11. Dry run unless --apply. With --apply the old curves of every changed place are saved first.
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
for (const l of readFileSync('.env.local','utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');let v=t.slice(i+1).trim().replace(/^["']|["']$/g,'');if(process.env[t.slice(0,i).trim()]===undefined)process.env[t.slice(0,i).trim()]=v;}
const SKIP=new Set(['diving','crowds','deals']);
(async()=>{
const apply=process.argv.includes('--apply');
const only=(process.argv.find(a=>a.startsWith('--only='))??'').slice(7).split(',').filter(Boolean);
const backupPath=(process.argv.find(a=>a.startsWith('--backup='))??'').slice(9)||'docs/backups/slider-curves-before-even-tenths.json';
const {db}=await import('../src/lib/db/client');
const {places}=await import('../src/lib/db/schema');
const {eq}=await import('drizzle-orm');
const {scorePlace}=await import('../src/lib/db/queries/places');
const {SLIDERS}=await import('../src/lib/scoring/constants');
const {evenTenthsCatalog,countDigits}=await import('../src/lib/gemini/even-tenths');
const {curveValue,parseSliderCurve}=await import('../src/lib/scoring/curve');
const {applyAdminEdits}=await import('../src/lib/admin/apply-edits');
const {SYSTEM_ACTOR}=await import('../src/lib/gemini/apply');
const rows=(await db.select().from(places)).filter((r:any)=>r.isPrimaryDestination) as any[];
const scored=new Map(rows.map(r=>[r.id,scorePlace(r) as any]));
const pct=(c:number[])=>{const n=c.reduce((a,b)=>a+b,0)||1;return c.map(x=>String(Math.round(100*x/n)).padStart(2)+'%').join(' ');};
const r1=(x:number)=>Math.round(x*10)/10;
const changes=new Map<string,Record<string,any>>(); // placeId -> interest -> new curve
const changesOvr=new Map<string,Record<string,Record<string,number>>>(); // placeId -> interest -> new month overrides
const backupOvr:Record<string,Record<string,any>>={};
const backup:Record<string,Record<string,any>>={};
const byId=new Map(rows.map(r=>[r.id,r]));
const stat={n:0,sum:0,max:0,big:0};
const evalCurve=(c:any)=>Array.from({length:12},(_,i)=>r1(curveValue(i+1,parseSliderCurve(c))));
// What the app shows for one interest of one place: the curve, then seasonal hazards and admin overrides (see curveScoring.ts).
const shown=(row:any,key:string,curve:any,ovr:Record<string,number>)=>(scorePlace({...row,sliderCurves:{...row.sliderCurves,[key]:curve},scoreOverrides:{...(row.scoreOverrides??{}),[key]:ovr}} as any) as any).monthly[key].map(r1) as number[];
console.log('interest'.padEnd(22),'places changed skipped   before (.0 .1 .2 .3 .4 .5 .6 .7 .8 .9)           after');
for(const s of SLIDERS){
 if(SKIP.has(s.key)||(only.length&&!only.includes(s.key)))continue;
 const curves:Record<string,any>={};const ovrs:Record<string,Record<string,number>>={};const series:Record<string,number[]>={};const skipped=new Set<string>();
 for(const r of rows){
  if(!(r.authoredCurves??[]).includes(s.key)||r.naSliders.includes(s.key))continue;
  const c=r.sliderCurves?.[s.key];if(!c)continue;
  const m=(scored.get(r.id) as any).monthly?.[s.key]?.map(r1) as number[];if(!m||m.length!==12||m.every(v=>v===0))continue;
  curves[r.id]=JSON.parse(JSON.stringify(c));series[r.id]=m;ovrs[r.id]={...(r.scoreOverrides?.[s.key]??{})};
 }
 const ids=Object.keys(series);if(ids.length<10)continue;
 const before=countDigits(Object.values(series));const n=before.reduce((a,b)=>a+b,0)||1;
 const shares=before.map(x=>x/n);
 if(!(shares.some(x=>x>0.14)||shares.some(x=>x<0.06)))continue; // already about even
 const orig:Record<string,number[]>=JSON.parse(JSON.stringify(series));
 const touched=new Set<string>();
 for(let pass=0;pass<3;pass++){
  const exempt=new Set(skipped);
  const target=evenTenthsCatalog(series,exempt,{maxMove:4});
  let any=false;
  for(const id of ids){
   if(skipped.has(id))continue;
   const want=target[id],cur=series[id];
   if(want.every((v,i)=>v===cur[i]))continue;
   const raw=evalCurve(curves[id]);
   const next=JSON.parse(JSON.stringify(curves[id]));const ovrNext={...ovrs[id]};
   let moved=0;
   for(let i=0;i<12;i++){
    if(want[i]===cur[i])continue;
    if(ovrNext[String(i)]!==undefined){ovrNext[String(i)]=want[i];moved++;continue;} // an admin-set month: move the override itself
    for(const a of next.anchors){if(a.month-1===i&&cur[i]>0&&raw[i]>0&&Math.abs(a.value-raw[i])<0.06){const ratio=cur[i]/raw[i];a.value=Math.min(10,Math.max(0,Math.round((a.value+(want[i]-cur[i])/ratio)*100)/100));moved++;}}
   }
   if(moved===0){skipped.add(id);continue;}
   let got:number[];try{got=shown(byId.get(id),s.key,next,ovrNext);}catch{skipped.add(id);continue;}
   const bad=got.some((v,i)=>want[i]!==cur[i]?Math.abs(v-want[i])>0.12:Math.abs(v-cur[i])>0.45)||cur.some((v,i)=>v>=9.95&&got[i]<9.95); // a true 10 must stay a 10
   if(bad){skipped.add(id);continue;}
   ovrs[id]=ovrNext;
   curves[id]=next;series[id]=got;touched.add(id);any=true;
  }
  if(!any)break;
 }
 for(const id of touched){(changes.get(id)??changes.set(id,{}).get(id)!)[s.key]=curves[id];(backup[id]??={})[s.key]=byId.get(id).sliderCurves[s.key];(changesOvr.get(id)??changesOvr.set(id,{}).get(id)!)[s.key]=ovrs[id];(backupOvr[id]??={})[s.key]=byId.get(id).scoreOverrides?.[s.key]??{};}
 for(const id of touched)series[id].forEach((v,i)=>{const d=Math.abs(v-orig[id][i]);if(d>0){stat.n++;stat.sum+=d;stat.max=Math.max(stat.max,d);if(d>0.3)stat.big++;}});
 const after=countDigits(Object.values(series));
 console.log(s.key.padEnd(22),String(ids.length).padStart(6),String(touched.size).padStart(7),String(skipped.size).padStart(7),'  ',pct(before),'  ',pct(after));
}
console.log(`\nmonths changed ${stat.n}, average change ${(stat.sum/Math.max(stat.n,1)).toFixed(2)}, largest ${stat.max.toFixed(2)}, changes over 0.3: ${stat.big}`);
console.log(`${changes.size} places would be rewritten`);
if(apply){
 mkdirSync('docs/backups',{recursive:true});
 writeFileSync(backupPath,JSON.stringify({savedAt:new Date().toISOString(),note:'old sliderCurves and scoreOverrides entries for every place+interest changed by scripts/even-tenths-live.ts',curves:backup,overrides:backupOvr}));
 console.log('backup written to',backupPath);
 let done=0,problems=0;
 for(const [id,byInterest] of changes){
  const fresh=(await db.select().from(places).where(eq(places.id,id)))[0] as any;
  const next={...fresh.sliderCurves,...byInterest};
  const ovrAll={...(fresh.scoreOverrides??{})};for(const [k,v] of Object.entries(changesOvr.get(id)??{})){if(Object.keys(v).length>0)ovrAll[k]=v;else delete ovrAll[k];}
  const patches:any[]=[{entityType:'destination',entityId:id,field:'sliderCurves',value:next,loadedUpdatedAt:fresh.updatedAt.toISOString()}];
  if(JSON.stringify(ovrAll)!==JSON.stringify(fresh.scoreOverrides??{}))patches.push({entityType:'destination',entityId:id,field:'scoreOverrides',value:ovrAll,loadedUpdatedAt:fresh.updatedAt.toISOString()});
  const res=await applyAdminEdits(patches,SYSTEM_ACTOR);
  if(res.errors.length||res.conflicts.length){problems++;console.log('PROBLEM',id,JSON.stringify(res.errors),JSON.stringify(res.conflicts));}else done++;
 }
 console.log(`wrote ${done} places, ${problems} problems`);
}
process.exit(0);})();
