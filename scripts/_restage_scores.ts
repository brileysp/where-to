// Recompute staged diving scores from Gemini's raw numbers with the corrected post-processing chain (see decimalize.ts holdFlatBands fix).
import { readFileSync, writeFileSync } from 'fs';
for (const l of readFileSync('.env.local','utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');let v=t.slice(i+1).trim().replace(/^["']|["']$/g,'');if(process.env[t.slice(0,i).trim()]===undefined)process.env[t.slice(0,i).trim()]=v;}
(async()=>{
const {db}=await import('../src/lib/db/client');
const {contentGenerations,places}=await import('../src/lib/db/schema');
const {eq}=await import('drizzle-orm');
const {decimalizeScores,flatScoresIfSingleBlurb,holdFlatBands,holdFlatMonths}=await import('../src/lib/gemini/decimalize');
const {flatBandMonths,isBlocky,smoothBlockyScores}=await import('../src/lib/gemini/smooth-scores');
const {validateContent,isNotApplicable}=await import('../src/lib/gemini/validate');
const nm=new Map((await db.select({id:places.id,name:places.name}).from(places)).map(p=>[p.id,p.name]));
const M=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
let changed=0,total=0; const report:any[]=[];
for(const batchId of process.argv.slice(2)){
 const rows=await db.select().from(contentGenerations).where(eq(contentGenerations.batchId,batchId));
 for(const r of rows){const o:any=r.parsedOutput;if(!o||isNotApplicable(o))continue;total++;
  const txt=(r.rawResponse as any)?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text).join('')||'';let j:any;try{j=JSON.parse(txt)}catch{continue}
  const raw=M.map(m=>j['score_'+m]) as number[]; if(raw.some(v=>typeof v!=='number'))continue;
  const texts=o.monthly.map((m:any)=>m.text);
  const useSmoother=isBlocky(raw);
  const next=flatScoresIfSingleBlurb(texts,raw) ?? (useSmoother?smoothBlockyScores(raw,texts):holdFlatBands(raw,holdFlatMonths(texts,raw,decimalizeScores(raw,r.placeId)),flatBandMonths(raw)));
  const cur=o.monthly.map((m:any)=>m.score);
  const diff=Math.max(...next.map((v:number,i:number)=>Math.abs(v-cur[i])));
  if(diff<0.005)continue;
  o.monthly.forEach((m:any,i:number)=>{m.score=next[i];});
  const issues=validateContent(o,'diving',r.placeId); const rejects=issues.filter((i:any)=>i.severity==='reject');
  await db.update(contentGenerations).set({parsedOutput:o,validationStatus:rejects.length?'invalid':'valid',validationErrors:issues as any}).where(eq(contentGenerations.id,r.id));
  changed++; if(diff>=0.3) report.push({name:nm.get(r.placeId),diff:+diff.toFixed(1),before:cur,after:next});
 }}
console.log('checked',total,'restaged',changed,'with a change of 0.3 or more:',report.length);
for(const x of report) console.log(String(x.name).padEnd(28),x.diff,'\n   before',x.before.join(' '),'\n   after ',x.after.join(' '));
process.exit(0);})();
